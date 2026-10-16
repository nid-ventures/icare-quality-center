import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Ouvre depuis le dashboard médical une page du patient (`/<route>/:patientId`). Le raccourci
 * n'est affiché sur le dashboard que si le patient a déjà des éléments de ce type (ex:
 * `*ngIf="countAnalysePrescrite"`) : pour un patient neuf, on ouvre la page par son URL.
 */
export async function openFromDashboard(page: Page, route: string) {
  const link = page.locator(`a[href*="/${route}/"]`).first();
  if (await link.isVisible().catch(() => false)) {
    await link.click();
  } else {
    const patientId = page.url().split('/patient/patient-dashboard/')[1]?.split(/[?#/]/)[0];
    expect(patientId, "Cette action doit partir du dashboard médical d'un patient").toBeTruthy();
    await page.goto(`/${route}/${patientId}`);
  }
  await page.waitForURL(`**/${route}/**`);
}

/**
 * Parcours de soins d'un patient, depuis son dashboard médical :
 *  - démarrage d'un parcours (`/patient/create-careplan/:id?type=...`, CreateCareplanPrenatalComponent)
 *  - détail du parcours (`/patient/patient-care-pathway-detail/:id/:careplanId`)
 *  - archives (`/patient/patient-care-pathway-list/:id`)
 */
export class CarePathwayPage {
  readonly startButton: Locator;
  readonly detailHeading: Locator;
  readonly archivesHeading: Locator;

  constructor(private readonly page: Page) {
    this.startButton = page.getByRole('button', { name: 'Démarrer', exact: true });
    this.detailHeading = page.getByRole('heading', { name: 'Parcours de soin', level: 2 });
    this.archivesHeading = page.getByRole('heading', { name: 'Archives des parcours de soins' });
  }

  /** Lien de démarrage d'un type de parcours dans la carte "Parcours de soins" du dashboard. */
  startLink(type: string): Locator {
    return this.page.locator(`a[href*="/patient/create-careplan/"][href*="type=${type}"]`);
  }

  async openStartForm(type: string) {
    await this.startLink(type).first().click();
    await this.page.waitForURL('**/patient/create-careplan/**');
    await expect(this.page.getByRole('heading', { name: new RegExp(`Démarrage du parcours ${type}`) })).toBeVisible();
  }

  /** Renseigne la date de début et le premier praticien proposé (parcours non prénatal). */
  async fillStartForm(startDate: string) {
    await this.page.locator('#startDate').fill(startDate);
    const caregiver = this.page.locator('ng-select[formcontrolname="caregiverId"]');
    await caregiver.click();
    await this.page.locator('.ng-dropdown-panel .ng-option:not(.ng-option-disabled)').first().click();
  }

  async start() {
    await this.startButton.click();
    // "Démarrer" ouvre une fenêtre de confirmation avant l'enregistrement du parcours.
    await this.confirmButton().click();
    await this.page.waitForURL('**/patient/patient-care-pathway-detail/**', { timeout: 20000 });
    await this.expectDetailLoaded();
  }

  private confirmButton(): Locator {
    return this.page.getByRole('button', { name: /^\W*(Confirmer|Oui|Valider)$/ }).last();
  }

  async expectDetailLoaded() {
    // Le détail charge le parcours, ses étapes et ses actes : plus de 5 s quand le backend est chargé
    await expect(this.detailHeading).toBeVisible({ timeout: 30000 });
    await expect(this.page.getByRole('button', { name: 'Étape 1', exact: true })).toBeVisible();
    await expect(this.page.getByRole('heading', { name: /Actes médicaux prévus/ })).toBeVisible();
  }

  async openArchivesFromDashboard() {
    await openFromDashboard(this.page, 'patient/patient-care-pathway-list');
    await expect(this.archivesHeading).toBeVisible();
  }

  archiveRows(): Locator {
    return this.page.locator('table tbody tr').filter({ hasNot: this.page.getByText(/Aucun/) });
  }
}

/** Listes des prescriptions d'analyses / d'imagerie d'un patient, ouvertes depuis son dashboard. */
export class PatientPrescriptionsPage {
  constructor(private readonly page: Page) {}

  async openAnalysesFromDashboard() {
    await openFromDashboard(this.page, 'patient/patient-analyses-prescrites');
    await expect(this.page.getByRole('heading', { name: /Prescriptions d'analyses \(\d+\)/ })).toBeVisible();
  }

  async openImagingFromDashboard() {
    await openFromDashboard(this.page, 'patient/patient-imagerie-prescrite');
    await expect(this.page.getByRole('heading', { name: /Prescriptions d'imagerie \(\d+\)/ })).toBeVisible();
  }

  async expectColumns(columns: string[]) {
    for (const column of columns) {
      await expect(this.page.getByRole('columnheader', { name: column, exact: true })).toBeVisible();
    }
  }

  async searchAndRefresh() {
    await expect(this.page.getByRole('heading', { name: 'Formulaire de recherche' })).toBeVisible();
    await this.page.getByRole('button', { name: /Rechercher$/ }).click();
    await this.page.getByRole('button', { name: /Actualiser$/ }).click();
  }

  async backToDashboard() {
    await this.page.getByRole('button', { name: /Retour$/ }).click();
    await this.page.waitForURL('**/patient/patient-dashboard/**');
  }
}
