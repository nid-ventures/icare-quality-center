import { type Page, type Locator, expect } from '@playwright/test';

export class PatientPage {
  private readonly firstChildRowTablePatient: Locator;
  private readonly patientLink: Locator;
  private readonly patientHeading: Locator;
  private readonly menuButton: Locator;
  private readonly patientUrl: Promise<void>;

  constructor(private readonly page: Page) {
    this.firstChildRowTablePatient = page.locator('.compact-table tbody tr:first-child');
    this.patientHeading = page.getByRole('heading', { name: 'Patients' });
    this.patientLink = page.getByRole('link', { name: ' Patients' });
    this.menuButton = page.getByText('Menu').nth(1);
    this.patientUrl = page.waitForURL('**/patient/patients');

  }
  async chooseFirstPatient() {  
    // Attendre la page d'accueil et ouvrir le menu
    await expect(this.patientHeading).toBeVisible();
    await this.patientLink.click();
    await this.patientUrl;    
    // Attendre que le tableau soit chargé
    await expect(this.firstChildRowTablePatient).toBeVisible();    
    // Cliquer sur la première ligne (dashboard patient)
    await this.firstChildRowTablePatient.click();
    await this.menuButton.click();
  }
 

}


