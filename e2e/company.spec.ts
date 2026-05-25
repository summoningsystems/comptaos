import { test, expect } from "@playwright/test";

/**
 * Tests du wizard de création d'entreprise.
 * Hypothèse : aucune entreprise existante dans le workspace de test
 * (CI utilise un workspace éphémère).
 */
test.describe("Wizard création entreprise", () => {
  test("affiche le wizard automatiquement si aucune entreprise", async ({ page }) => {
    await page.goto("/");
    // Le wizard s'ouvre automatiquement quand il n'y a pas d'entreprise
    await expect(page.getByText("Créer votre entreprise")).toBeVisible({ timeout: 10_000 });
  });

  test("peut créer une entreprise et atteindre le dashboard", async ({ page }) => {
    await page.goto("/");
    // Étape 1 : formulaire entreprise
    await page.getByLabel(/Nom de l'entreprise/i).fill("Test SARL");
    await page.getByRole("button", { name: /suivant|continuer/i }).click();

    // Étape 2 : git sync (optionnel — passer)
    await page.getByRole("button", { name: /passer|skip|suivant/i }).click();

    // Étape 3 : page de confirmation
    await expect(page.getByText(/entreprise créée|commencer/i)).toBeVisible({ timeout: 8_000 });
    await page.getByRole("button", { name: /commencer|accéder/i }).click();

    // Dashboard visible
    await expect(page.getByText(/dashboard|tableau de bord/i)).toBeVisible({ timeout: 8_000 });
  });
});
