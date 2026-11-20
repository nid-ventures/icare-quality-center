import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Popup de l'application pour une saisie non enregistrée (ConsultationDraftService, composant
 * app-draft-confirm créé sur document.body) :
 *  - quitter la page : « CONSULTATION NON ENREGISTRÉE » (consultation, gardée en brouillon) ou
 *    « MODIFICATIONS NON ENREGISTRÉES » (bilan, imagerie, vaccination) — Rester sur la page / Quitter quand même ;
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

/** Bandeau « Consultation non enregistrée retrouvée » de la page Consultations du patient. */
export class DraftBanner {
  readonly root: Locator;
  readonly resume: Locator;
  readonly discard: Locator;

  constructor(page: Page) {
    this.root = page.locator('.draft-banner');
    this.resume = this.root.getByRole('button', { name: /Reprendre/ });
    this.discard = this.root.getByRole('button', { name: /Supprimer/ });
  }
}
