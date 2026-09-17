// pages/structure/prsnl-infos/prsnl-infos.page.ts
import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page object pour /policy/prsnl-infos/:id (guardée par authGuard, cf. app.routes.ts).
 *
 * PrsnlInfosComponent est purement statique : les deux onglets Bootstrap affichent
 * directement <app-prsnl-pcd> et <app-prsnl-cgu> et n'exploitent jamais :id.
 *
 * Le lien de pied de page présent sur tout l'espace connecté (my-space.component.html)
 * pointe vers ['/policy/prsnl-infos', userID] : on l'utilise pour naviguer comme le
 * ferait un vrai utilisateur, plutôt que de fabriquer un id arbitraire.
 */
export class PrsnlInfosPage {
  private readonly footerPcdLink: Locator;
  private readonly cguTabLink: Locator;
  private readonly pcdHeading: Locator;
  private readonly cguHeading: Locator;

  constructor(private readonly page: Page) {
    // Portée sur <footer> : le même libellé existe aussi comme onglet une fois sur la page.
    this.footerPcdLink = page.locator('footer').getByRole('link', { name: 'Politique de confidentialité des données' });
    // Portée sur les onglets nav-pills de PrsnlInfosComponent.
    this.cguTabLink = page.locator('ul.nav-pills').getByRole('link', { name: "Conditions générales d'utilisation" });
    this.pcdHeading = page.getByRole('heading', { name: 'Politique de confidentialité', exact: true });
    this.cguHeading = page.getByRole('heading', { name: "Conditions générales d'utilisation" });
  }

  /**
   * Ouvre la page de politique depuis le lien de pied de page (nécessite d'être sur une
   * page de l'espace connecté, ex. le dashboard, juste après la connexion).
   */
  async openFromFooterLink() {
    await expect(this.footerPcdLink).toBeVisible();
    await this.footerPcdLink.click();
  }

  async expectPcdTabContentVisible() {
    await expect(this.pcdHeading).toBeVisible();
  }

  async openCguTab() {
    await this.cguTabLink.click();
  }

  async expectCguTabContentVisible() {
    await expect(this.cguHeading).toBeVisible();
  }
}
