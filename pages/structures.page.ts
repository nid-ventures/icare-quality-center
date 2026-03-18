import { type Page, type Locator, expect } from '@playwright/test';

export class StructuresPage {
  private readonly tableBody: Locator;

  constructor(private readonly page: Page) {
    this.tableBody = page.locator('tbody');
  }

  async expectStructureVisible(structureName: string) {
    await expect(this.tableBody).toContainText(structureName);
  }
}
