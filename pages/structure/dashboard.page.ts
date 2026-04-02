import { type Page, type Locator, expect } from '@playwright/test';

export class DashboardPage {
  private readonly userHeading: Locator;
  private readonly structuresLink: Locator;
  private readonly utilisateursLink: Locator;
  private readonly medecinsLink: Locator;
  private readonly planningsLink: Locator;
  private readonly userProfileButton: Locator;
  private readonly logoutLink: Locator;

  constructor(private readonly page: Page) {
    this.userHeading = page.locator('h6');
    this.structuresLink = page.getByRole('link', { name: 'Structures' });
    this.utilisateursLink = page.getByRole('link', { name: 'Utilisateurs' });
    this.medecinsLink = page.getByRole('link', { name: 'Medecins' });
    this.planningsLink = page.getByRole('link', { name: 'Plannings' });
    this.userProfileButton = page.getByRole('button', { name: 'userProfile' });
    this.logoutLink = page.getByRole('link', { name: 'Déconnexion' });
  }

  async expectUserName(expectedName: string) {
    await expect(this.userHeading).toContainText(expectedName);
  }

  async goToStructures() {
    await this.structuresLink.click();
  }

  async goToUtilisateurs() {
    await this.utilisateursLink.click();
  }

  async goToMedecins() {
    await this.medecinsLink.click();
  }

  async goToPlannings() {
    await this.planningsLink.click();
  }

  async logout() {
    await this.userProfileButton.click();
    await this.logoutLink.click();
  }
}
