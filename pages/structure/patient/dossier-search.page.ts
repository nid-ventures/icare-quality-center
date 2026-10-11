import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Écran "Dossiers patients" du module Dossier médical (`/patient/patients`, mode "recherche
 * d'abord" de PatientsListComponent) : rien n'est chargé avant une recherche, les dossiers
 * récemment ouverts sont proposés en accès direct, et un clic sur un résultat ouvre le
 * dashboard médical du patient (`/patient/patient-dashboard/:id`).
 *
 * Convention de l'application : le champ "Nom" alimente searchPatient().firstName et "Prénom"
 * searchPatient().lastName (le modèle patient stocke le nom de famille dans firstName). Les
 * tests privilégient la recherche par identifiant, sans ambiguïté.
 */
export class DossierSearchPage {
  readonly heading: Locator;
  readonly newPatientButton: Locator;
  readonly identifierInput: Locator;
  readonly folderOrderInput: Locator;
  readonly emailInput: Locator;
  readonly searchButton: Locator;
  readonly clearButton: Locator;
  readonly searchHint: Locator;
  readonly recentsHeading: Locator;
  readonly results: Locator;
  readonly noResult: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Dossiers patients', level: 1 });
    this.newPatientButton = page.getByRole('banner').getByRole('button', { name: /Nouveau patient/ });
    this.identifierInput = page.getByRole('textbox', { name: 'Identifiant', exact: true });
    this.folderOrderInput = page.getByRole('textbox', { name: 'N° dossier', exact: true });
    this.emailInput = page.getByRole('textbox', { name: 'Email', exact: true });
    this.searchButton = page.locator('form.sp-search').getByRole('button', { name: /Rechercher/ });
    this.clearButton = page.locator('form.sp-search').getByRole('button', { name: /Effacer/ });
    this.searchHint = page.getByText('Saisissez au moins un critère de recherche.');
    this.recentsHeading = page.getByRole('heading', { name: /Récemment ouverts/ });
    this.results = page.locator('li.sp-result:not(.sp-skeleton)');
    this.noResult = page.getByText('Aucun patient ne correspond à cette recherche.');
  }

  async expectLoaded() {
    await this.page.waitForURL('**/patient/patients');
    await expect(this.heading).toBeVisible();
    await expect(this.searchButton).toBeVisible();
  }

  async searchByIdentifier(identifier: string) {
    await this.identifierInput.fill(identifier);
    await this.searchButton.click();
  }

  async searchByFolderOrder(folderOrder: string) {
    await this.folderOrderInput.fill(folderOrder);
    await this.searchButton.click();
  }

  result(text: string): Locator {
    return this.results.filter({ hasText: text });
  }

  async expectResult(text: string) {
    await expect(this.result(text).first()).toBeVisible({ timeout: 15000 });
  }

  /** Ouvre le dossier médical d'un résultat de recherche. */
  async openDossier(text: string) {
    await this.result(text).first().click();
    await this.page.waitForURL('**/patient/patient-dashboard/**');
  }

  recent(text: string): Locator {
    return this.page.locator('button.sp-recent').filter({ hasText: text });
  }

  /** Recherche un patient par identifiant puis ouvre son dossier médical. */
  async openPatientByIdentifier(identifier: string) {
    await this.searchByIdentifier(identifier);
    await this.expectResult(identifier);
    await this.openDossier(identifier);
  }
}
