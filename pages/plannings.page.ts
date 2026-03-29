import { type Page, type Locator } from '@playwright/test';

export class PlanningsPage {
  private readonly medecinDropdown: Locator;
  private readonly modifierCreneauButton: Locator;
  private readonly appliquerButton: Locator;
  private readonly ouiButton: Locator;

  constructor(private readonly page: Page) {
    this.medecinDropdown = page.locator('.css-8mmkcg').first();
    this.modifierCreneauButton = page.getByRole('button', { name: 'Modifier le créneau' });
    this.appliquerButton = page.getByRole('button', { name: 'Appliquer' });
    this.ouiButton = page.getByRole('button', { name: 'Oui' });
  }

  async selectMedecin(name: string) {
    await this.medecinDropdown.click();
    await this.page.getByRole('option', { name }).click();
  }

  async modifierCreneau() {
    await this.modifierCreneauButton.click();
  }

  async setMorningSlot(day: string, startHour: string, startMin: string, endHour: string, endMin: string) {
    const dayBlock = this.page.locator('div.border').filter({ hasText: day });
    const picker = dayBlock.locator('.react-timerange-picker').nth(0);
    await picker.locator('input[name="hour24"]').nth(0).focus();
    await picker.locator('input[name="hour24"]').nth(0).fill(startHour);
    await picker.locator('input[name="minute"]').nth(0).focus();
    await picker.locator('input[name="minute"]').nth(0).fill(startMin);
    await picker.locator('input[name="hour24"]').nth(1).focus();
    await picker.locator('input[name="hour24"]').nth(1).fill(endHour);
    await picker.locator('input[name="minute"]').nth(1).focus();
    await picker.locator('input[name="minute"]').nth(1).fill(endMin);
  }

  async appliquerEtConfirmer() {
    await this.appliquerButton.click();
    await this.ouiButton.click();
  }
}
