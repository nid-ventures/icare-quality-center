import { type Page, type Locator, expect } from '@playwright/test';

export class DashboardPage {
  private readonly userHeading: Locator;
  private readonly structuresLink: Locator;
  private readonly utilisateursLink: Locator;

  constructor(private readonly page: Page) {
    this.userHeading = page.locator('h6');
    this.structuresLink = page.getByRole('link', { name: 'Structures' });
    this.utilisateursLink = page.getByRole('link', { name: 'Utilisateurs' });
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
}
