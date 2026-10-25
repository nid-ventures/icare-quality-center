import { type Locator, type Page, type Response, expect } from '@playwright/test';

/**
 * Confirme un enregistrement (bouton "Confirmer" de la fenêtre d'avertissement) et attend la
 * réponse du serveur. Sans cette attente, un test qui se termine juste après le clic ferme la page
 * pendant que la requête est en cours : sur un serveur distant, l'enregistrement était alors perdu
 * (consultation jamais créée, actes jamais à facturer).
 */
export async function confirmSave(page: Page, confirmButton: Locator, what = 'Enregistrement'): Promise<Response> {
  const saved = page.waitForResponse(
    r => r.url().includes('/nid-api/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.request().method()),
    { timeout: 60000 },
  );
  await confirmButton.click();
  const res = await saved;
  expect(res.status(), `${what} : réponse du serveur (${res.request().method()} ${new URL(res.url()).pathname})`).toBeLessThan(400);
  return res;
}
