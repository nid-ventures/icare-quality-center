import { type Page, type Locator, expect } from '@playwright/test';

export class UtilisateursPage {
  private readonly tableBody: Locator;

  constructor(private readonly page: Page) {
    this.tableBody = page.locator('tbody');
  }

  async expectUserVisible(userName: string) {
    await expect(this.tableBody).toContainText(userName);
  }
}
