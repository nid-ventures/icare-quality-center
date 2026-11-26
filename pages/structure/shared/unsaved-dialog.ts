import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Popup de l'application pour une saisie non enregistrée (ConsultationDraftService, composant
 * app-draft-confirm créé sur document.body) :
 *  - quitter la page : « CONSULTATION NON ENREGISTRÉE » (consultation, gardée en brouillon) ou
 *    « MODIFICATIONS NON ENREGISTRÉES » (bilan, imagerie, vaccination) — Rester sur la page / Quitter quand même,
 *    ou, depuis le frontend 344f7eda, quand le formulaire sait s'enregistrer : Sauvegarder et quitter /
 *    Rester sur la page / Quitter sans sauvegarder (F5 : Sauvegarder et actualiser / Actualiser sans sauvegarder ;
 *    fenêtre : Enregistrer et fermer / Revenir à la saisie / Fermer sans enregistrer) ;
 *  - saisie gardée en brouillon et retrouvée à la réouverture : « SAISIE NON ENREGISTRÉE RETROUVÉE »
 *    (Reprendre / Ignorer ; « Ignorer » automatique, cf. fixtures/structure.fixture.ts) ;
 *  - Annuler / changer de type pendant la saisie d'une consultation — Revenir à la saisie / Abandonner la saisie ;
 *  - supprimer le brouillon retrouvé — Annuler / Supprimer ;
 *  - reprendre les modifications retrouvées d'une consultation existante — Les supprimer / Les reprendre.
 */
export class UnsavedDialog {
  readonly root: Locator;
  readonly title: Locator;
  readonly body: Locator;

  constructor(readonly page: Page) {
    this.root = page.locator('app-draft-confirm .dc-card');
    this.title = this.root.locator('.dc-title');
    this.body = this.root.locator('.dc-body');
  }

  async expectOpen(title: RegExp, text?: RegExp) {
    await expect(this.root, `Popup « ${title.source} »`).toBeVisible({ timeout: 10000 });
    await expect(this.title).toHaveText(title);
    if (text) await expect(this.body).toContainText(text);
  }

  async expectClosed() {
    await expect(this.root).toHaveCount(0);
  }

  async answer(label: RegExp) {
    await this.root.getByRole('button', { name: label }).click();
    await this.expectClosed();
  }
}

/** Popup de reprise d'un brouillon de formulaire (frontend 344f7eda). */
export const RECOVERED_DRAFT = (page: Page) =>
  page.locator('app-draft-confirm .dc-card').filter({ has: page.locator('.dc-title', { hasText: /SAISIE NON ENREGISTRÉE RETROUVÉE/ }) });

/**
 * Depuis le frontend 344f7eda, une saisie laissée sans enregistrer est gardée en brouillon sur le
 * poste et reproposée à la réouverture du formulaire (« SAISIE NON ENREGISTRÉE RETROUVÉE » :
 * Reprendre / Ignorer). Répond « Ignorer » chaque fois qu'elle apparaît, comme un utilisateur qui ne
 * veut pas la reprendre. Automatique sur la page des tests (fixtures/structure.fixture.ts) ; à appeler
 * sur chaque page ouverte à la main (browser.newContext). Un test qui vérifie la reprise le retire :
 * page.removeLocatorHandler(RECOVERED_DRAFT(page)).
 */
export async function ignoreRecoveredDrafts(page: Page) {
  await page.addLocatorHandler(RECOVERED_DRAFT(page), async popup => {
    await popup.getByRole('button', { name: /^W*Ignorers*$/ }).click();
    await expect(popup).toHaveCount(0);
  });
}

/**
 * Bandeau « Consultation non enregistrée retrouvée » de la page Consultations du patient : une ligne
 * par brouillon depuis le frontend 344f7eda (plusieurs brouillons par patient). `root` désigne toutes
 * les lignes ; Reprendre / Supprimer agissent sur la plus récente (première ligne).
 */
export class DraftBanner {
  readonly root: Locator;
  readonly resume: Locator;
  readonly discard: Locator;

  constructor(page: Page) {
    this.root = page.locator('.draft-banner');
    this.resume = this.root.first().getByRole('button', { name: /Reprendre/ });
    this.discard = this.root.first().getByRole('button', { name: /Supprimer/ });
  }
}
