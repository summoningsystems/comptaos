import Stripe from "stripe";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { getCompaniesRoot } from "./companiesService.js";

// ── Client Stripe ─────────────────────────────────────────────────────────────

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY non configurée");
  return new Stripe(key);
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

// ── Stockage des licences émises ──────────────────────────────────────────────

export interface IssuedLicense {
  key: string;
  plan: "pro" | "pro_plus";
  email: string;
  stripeSessionId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  issuedAt: string;
  activatedAt?: string;
}

const ISSUED_FILE = () => path.join(getCompaniesRoot(), ".issued_licenses.json");

async function loadIssued(): Promise<IssuedLicense[]> {
  try {
    const raw = await fs.readFile(ISSUED_FILE(), "utf-8");
    return JSON.parse(raw) as IssuedLicense[];
  } catch {
    return [];
  }
}

async function saveIssued(list: IssuedLicense[]): Promise<void> {
  await fs.mkdir(path.dirname(ISSUED_FILE()), { recursive: true });
  await fs.writeFile(ISSUED_FILE(), JSON.stringify(list, null, 2));
}

/** Génère une clé de licence au format PRO-XXXX-XXXX-XXXX */
function generateKey(plan: "pro" | "pro_plus"): string {
  const prefix = plan === "pro_plus" ? "PROPLUS" : "PRO";
  const part = () => crypto.randomBytes(2).toString("hex").toUpperCase();
  return `${prefix}-${part()}-${part()}-${part()}`;
}

/** Enregistre et retourne une nouvelle licence émise */
export async function issueLicense(
  plan: "pro" | "pro_plus",
  email: string,
  stripeIds?: { sessionId?: string; customerId?: string; subscriptionId?: string }
): Promise<IssuedLicense> {
  const issued = await loadIssued();

  // Eviter les doublons pour le même email + plan
  const existing = issued.find(
    (l) => l.email.toLowerCase() === email.toLowerCase() && l.plan === plan
  );
  if (existing) return existing;

  const license: IssuedLicense = {
    key: generateKey(plan),
    plan,
    email: email.toLowerCase(),
    stripeSessionId: stripeIds?.sessionId,
    stripeCustomerId: stripeIds?.customerId,
    stripeSubscriptionId: stripeIds?.subscriptionId,
    issuedAt: new Date().toISOString(),
  };

  issued.push(license);
  await saveIssued(issued);
  return license;
}

/** Cherche une licence par email (pour auto-activation) */
export async function findLicenseByEmail(email: string): Promise<IssuedLicense | null> {
  const issued = await loadIssued();
  return issued.find((l) => l.email.toLowerCase() === email.toLowerCase()) ?? null;
}

// ── Stripe Checkout ───────────────────────────────────────────────────────────

interface CheckoutResult {
  url: string;
  sessionId: string;
}

/**
 * Résout un Price ID depuis une valeur env qui peut être :
 *   - un price_xxx  → utilisé directement
 *   - un prod_xxx   → premier prix actif du produit récupéré via l'API
 */
async function resolvePriceId(stripe: Stripe, value: string): Promise<string> {
  if (value.startsWith("price_")) return value;
  if (value.startsWith("prod_")) {
    const prices = await stripe.prices.list({ product: value, active: true, limit: 1 });
    if (!prices.data.length) throw new Error(`Aucun prix actif trouvé pour le produit ${value}`);
    return prices.data[0].id;
  }
  throw new Error(`Valeur invalide pour un prix Stripe : ${value}`);
}

export async function createCheckoutSession(
  plan: "pro" | "pro_plus",
  email: string,
  successUrl: string,
  cancelUrl: string
): Promise<CheckoutResult> {
  const stripe = getStripe();

  const rawPriceOrProduct =
    plan === "pro_plus"
      ? process.env.STRIPE_PRICE_PROPLUS
      : process.env.STRIPE_PRICE_PRO;

  if (!rawPriceOrProduct) {
    throw new Error(
      `STRIPE_PRICE_${plan === "pro_plus" ? "PROPLUS" : "PRO"} non configuré dans .env`
    );
  }

  const priceId = await resolvePriceId(stripe, rawPriceOrProduct);
  const isSubscription = plan === "pro_plus";

  const session = await stripe.checkout.sessions.create({
    mode: isSubscription ? "subscription" : "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: email || undefined,
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    metadata: { plan, comptaos: "1" },
    ...(isSubscription
      ? {}
      : { payment_intent_data: { metadata: { plan, comptaos: "1" } } }),
  });

  return { url: session.url!, sessionId: session.id };
}

// ── Stripe Webhook ────────────────────────────────────────────────────────────

/**
 * Traite un événement Stripe webhook et émet la licence si le paiement est confirmé.
 * Retourne la licence émise ou null si l'événement n'est pas pertinent.
 */
export async function handleWebhookEvent(
  rawBody: string,
  signature: string
): Promise<IssuedLicense | null> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET non configuré");

  const stripe = getStripe();
  const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

  // Paiement unique (Pro)
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.comptaos !== "1") return null;

    const plan = session.metadata.plan as "pro" | "pro_plus";
    const email = session.customer_email ?? (session.customer_details?.email ?? "");
    if (!email) return null;

    return issueLicense(plan, email, {
      sessionId: session.id,
      customerId: session.customer as string | undefined,
      subscriptionId: session.subscription as string | undefined,
    });
  }

  // Renouvellement abonnement Pro+
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice & {
      subscription?: string | Stripe.Subscription | null;
    };

    const subscriptionId =
      typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription?.id;

    if (!subscriptionId) return null;

    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    if (sub.metadata?.comptaos !== "1" && sub.items.data[0]?.price.id !== process.env.STRIPE_PRICE_PROPLUS) {
      return null;
    }

    const customer = await stripe.customers.retrieve(invoice.customer as string) as Stripe.Customer;
    const email = customer.email ?? "";
    if (!email) return null;

    return issueLicense("pro_plus", email, {
      customerId: customer.id,
      subscriptionId,
    });
  }

  return null;
}

/** Vérifie un paiement par session_id Stripe (retour de Stripe Checkout) */
export async function verifyCheckoutSession(sessionId: string): Promise<{
  paid: boolean;
  plan?: "pro" | "pro_plus";
  email?: string;
  license?: IssuedLicense;
}> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid" && session.status !== "complete") {
    return { paid: false };
  }

  const plan = session.metadata?.plan as "pro" | "pro_plus" | undefined;
  const email = session.customer_email ?? session.customer_details?.email ?? "";

  if (!plan || !email) return { paid: true };

  // Émettre ou retrouver la licence
  const license = await issueLicense(plan, email, {
    sessionId: session.id,
    customerId: session.customer as string | undefined,
  });

  return { paid: true, plan, email, license };
}
