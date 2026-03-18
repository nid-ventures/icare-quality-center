import { type Page, type Locator, expect } from '@playwright/test';

export class MedecinsPage {
  private readonly tableBody: Locator;
  private readonly firtNameFiled: Locator;
  private readonly searchButtonFiled:Locator;

  constructor(private readonly page: Page) {
    this.firtNameFiled = page.getByRole('textbox', { name: 'Rechercher par nom' });
    this.searchButtonFiled = page.getByRole('button', { name: 'Rechercher' });
    this.tableBody = page.locator('tbody');
  }

  async searchMedecin(medecinName: string) {
    await this.firtNameFiled.fill(medecinName)
    await this.searchButtonFiled.click();
  }

  async expectMedecinVisible(medecinCompletName : string){
    await expect(this.tableBody).toContainText(medecinCompletName);
 }
  
}
