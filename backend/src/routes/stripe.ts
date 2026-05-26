import { FastifyInstance } from "fastify";
import {
  isStripeConfigured,
  createCheckoutSession,
  verifyCheckoutSession,
  handleWebhookEvent,
  findLicenseByEmail,
} from "../services/stripeService.js";
import { activateLicense } from "../services/licenseService.js";

export async function stripeRoutes(app: FastifyInstance) {
  // ── Statut Stripe ─────────────────────────────────────────────────────────

  app.get("/api/stripe/status", async () => ({
    configured: isStripeConfigured(),
    plans: {
      pro: !!process.env.STRIPE_PRICE_PRO,
      pro_plus: !!process.env.STRIPE_PRICE_PROPLUS,
    },
  }));

  // ── Créer une session Stripe Checkout ─────────────────────────────────────

  app.post("/api/stripe/checkout", async (req, reply) => {
    if (!isStripeConfigured()) {
      return reply.status(503).send({ error: "Paiement non configuré sur ce serveur" });
    }

    const { plan, email, successUrl, cancelUrl } = req.body as {
      plan?: "pro" | "pro_plus";
      email?: string;
      successUrl?: string;
      cancelUrl?: string;
    };

    if (!plan || !successUrl || !cancelUrl) {
      return reply.status(400).send({ error: "plan, successUrl et cancelUrl requis" });
    }
    if (plan !== "pro" && plan !== "pro_plus") {
      return reply.status(400).send({ error: "plan invalide" });
    }

    try {
      return await createCheckoutSession(plan, email ?? "", successUrl, cancelUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur Stripe";
      return reply.status(502).send({ error: msg });
    }
  });

  // ── Vérifier le paiement après retour Stripe ──────────────────────────────
  // Appelé par le frontend avec ?session_id=... après la redirection Stripe

  app.get("/api/stripe/verify", async (req, reply) => {
    const { session_id } = req.query as { session_id?: string };
    if (!session_id) return reply.status(400).send({ error: "session_id requis" });

    if (!isStripeConfigured()) {
      return reply.status(503).send({ error: "Stripe non configuré" });
    }

    try {
      const result = await verifyCheckoutSession(session_id);
      if (!result.paid) {
        return reply.status(402).send({ error: "Paiement non finalisé" });
      }

      // Auto-activer la licence dans le workspace local
      if (result.license) {
        try {
          await activateLicense(result.license.key, result.license.email);
        } catch {
          // Peut échouer si déjà activée — pas grave
        }
      }

      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur de vérification";
      return reply.status(502).send({ error: msg });
    }
  });

  // ── Vérifier une licence par email ────────────────────────────────────────

  app.post("/api/stripe/check-email", async (req, reply) => {
    const { email } = req.body as { email?: string };
    if (!email) return reply.status(400).send({ error: "email requis" });

    const license = await findLicenseByEmail(email);
    if (!license) return { found: false };

    // Auto-activer si trouvée
    try {
      await activateLicense(license.key, license.email);
    } catch {/* déjà activée */}

    return { found: true, plan: license.plan, key: license.key };
  });

  // ── Webhook Stripe ────────────────────────────────────────────────────────
  // IMPORTANT : Stripe envoie le body en raw bytes — le parser JSON est
  // enregistré dans un scope enfant pour ne pas écraser le parser global.

  app.register(async (scope) => {
    scope.addContentTypeParser(
      "application/json",
      { parseAs: "string" },
      (req, body, done) => done(null, body)
    );

    scope.post("/api/stripe/webhook", async (req, reply) => {
      const sig = req.headers["stripe-signature"] as string | undefined;
      if (!sig) return reply.status(400).send({ error: "stripe-signature manquant" });

      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        return reply.status(503).send({ error: "STRIPE_WEBHOOK_SECRET non configuré" });
      }

      try {
        const license = await handleWebhookEvent(req.body as string, sig);
        if (license) {
          scope.log.info(`Licence émise : ${license.key} pour ${license.email}`);
        }
        return reply.status(200).send({ received: true });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erreur webhook";
        scope.log.error(`Stripe webhook error: ${msg}`);
        return reply.status(400).send({ error: msg });
      }
    });
  });
}
