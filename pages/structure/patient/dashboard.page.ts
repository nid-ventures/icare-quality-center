import { type Page, type Locator, expect } from '@playwright/test';

export class DashboardPage {
  private readonly patientStat: Locator;
  private readonly medecinStat: Locator;
  private readonly secretaireStat: Locator;
  // Compteurs numériques (span.counter) affichés au-dessus de chaque libellé de statistique
  // (cf. dashboard.component.html : <h2><span class="counter">{{count}}</span></h2><h5>Libellé</h5>)
  private readonly patientCounterValue: Locator;
  private readonly medecinCounterValue: Locator;
  private readonly secretaireCounterValue: Locator;
  private readonly dashboardLink: Locator;
  private readonly patientLink: Locator;
  private readonly facturationLink: Locator;
  private readonly facturationPatientLink: Locator;
  private readonly facturationGarantLink: Locator;
  private readonly rdvLink: Locator;
  private readonly honorairesLink: Locator;
  private readonly releveHonorairesLink: Locator;
  private readonly reportingLink: Locator;
  private readonly reportingPrestationLink: Locator;
  private readonly reportingActeLink: Locator;
  private readonly usersLink: Locator;
  private readonly settingsLink: Locator;


  constructor(private readonly page: Page) {
    this.patientStat = page.getByRole('heading', { name: 'Patients' });
    this.medecinStat = page.getByRole('heading', { name: 'Médecins' });
    this.secretaireStat = page.getByRole('heading', { name: 'Sécretaires médicaux' });
    this.patientCounterValue = page.locator('div.text-right').filter({ has: this.patientStat }).locator('span.counter');
    this.medecinCounterValue = page.locator('div.text-right').filter({ has: this.medecinStat }).locator('span.counter');
    this.secretaireCounterValue = page.locator('div.text-right').filter({ has: this.secretaireStat }).locator('span.counter');
    this.dashboardLink = page.getByRole('link', { name: ' Dashboard' });
    this.patientLink = page.getByRole('link', { name: ' Patients' });
    this.facturationLink = page.getByRole('link', { name: ' Facturations ' });
    this.facturationPatientLink = page.getByRole('link', { name: ' Factures-Patient' });
    this.facturationGarantLink = page.getByRole('link', { name: ' Factures-Garant' });
    this.rdvLink = page.getByRole('link', { name: ' Rendez-vous' });
    this.honorairesLink = page.getByRole('link', { name: ' Honoraires ' });
    this.releveHonorairesLink = page.getByRole('link', { name: ' Relevés honoraires' });
    this.reportingLink = page.getByRole('link', { name: ' Reporting ' });
    this.reportingPrestationLink = page.getByRole('link', { name: ' Prestations' });
    this.reportingActeLink = page.getByRole('link', { name: ' Liste des actes' });
    this.usersLink = page.getByRole('link', { name: ' Utilisateurs' });
    this.settingsLink = page.getByRole('link', { name: ' Paramètres' });


  }

  async statisticIsVisible() {
  await expect(this.patientStat).toBeVisible();
  await expect(this.medecinStat).toBeVisible();
  await expect(this.secretaireStat).toBeVisible();
  }

  async modulesDashboardIsVisible() {
    await expect(this.dashboardLink).toBeVisible();

  }
  async modulesPatientIsVisible() {
    await expect(this.patientLink).toBeVisible();

  }
  async modulesUsersIsVisible() {
    await expect(this.usersLink).toBeVisible();

  }

  async modulesSettingsIsVisible() {
    await expect(this.settingsLink).toBeVisible();

  }
  async modulesHonoraireIsVisible() {
    await expect(this.honorairesLink).toBeVisible();
    await this.honorairesLink.click();
    await expect(this.releveHonorairesLink).toBeVisible();
    await this.honorairesLink.click();

  }
async rdvLinkIsVisible() {
    await expect(this.rdvLink).toBeVisible();

  }
  async modulesFacturationIsVisible() {
  await expect(this.facturationLink).toBeVisible();
  await this.facturationLink.click();
  await expect(this.facturationPatientLink).toBeVisible();
  await expect(this.facturationGarantLink).toBeVisible();
  await this.facturationLink.click();

  }

  async modulesReportingIsVisible() {
  await expect(this.reportingLink).toBeVisible();
  await this.reportingLink.click();
  await expect(this.reportingPrestationLink).toBeVisible();
  await expect(this.reportingActeLink).toBeVisible();
  await this.reportingLink.click();

  }

  // ======================== NAVIGATION FACTURATION ========================
  // Le lien principal " Facturations " pointe lui-même vers /billing/billings-create
  // (routerLink sur le <a> parent) tout en dépliant le sous-menu (Bootstrap collapse).
  // Cliquer dessus une fois suffit donc à la fois pour atterrir sur l'assistant de création
  // de facture et pour révéler les liens Factures-Patient / Factures-Garant du sous-menu.
  async goToFacturationCreate() {
    await expect(this.facturationLink).toBeVisible();
    await this.facturationLink.click();
    await this.page.waitForURL('**/billing/billings-create');
  }

  async goToFacturationPatientList() {
    await this.goToFacturationCreate();
    await expect(this.facturationPatientLink).toBeVisible();
    await this.facturationPatientLink.click();
    await this.page.waitForURL('**/billing/billings-patients');
  }

  async goToFacturationGarantList() {
    await this.goToFacturationCreate();
    await expect(this.facturationGarantLink).toBeVisible();
    await this.facturationGarantLink.click();
    await this.page.waitForURL('**/billing/billings-garants');
  }

  // ======================== MY-SPACE : DASHBOARD STATISTIQUES ========================
  /**
   * Vérifie que les 3 compteurs du dashboard (`/my-space/dashboard`) affichent bien des nombres
   * valides et non négatifs (le composant est purement statique : pas de filtre à manipuler).
   */
  async expectStatisticsAreValidNumbers() {
    for (const counter of [this.patientCounterValue, this.medecinCounterValue, this.secretaireCounterValue]) {
      await expect(counter).toBeVisible();
      const text = (await counter.textContent())?.trim() ?? '';
      const value = Number(text);
      expect(Number.isFinite(value), `La valeur du compteur "${text}" n'est pas un nombre valide`).toBeTruthy();
      expect(value).toBeGreaterThanOrEqual(0);
    }
  }

  // ======================== NAVIGATION MY-SPACE / REPORTING & PARAMÈTRES ========================
  async goToReportingPrestations() {
    await expect(this.reportingLink).toBeVisible();
    await this.reportingLink.click();
    await expect(this.reportingPrestationLink).toBeVisible();
    await this.reportingPrestationLink.click();
    await this.page.waitForURL('**/my-space/reporting/prestations');
  }

  async goToReportingBillableBilling() {
    await expect(this.reportingLink).toBeVisible();
    await this.reportingLink.click();
    await expect(this.reportingActeLink).toBeVisible();
    await this.reportingActeLink.click();
    await this.page.waitForURL('**/my-space/reporting/billable-billing');
  }

  async goToConfiguration() {
    await expect(this.settingsLink).toBeVisible();
    await this.settingsLink.click();
    await this.page.waitForURL('**/my-space/configuration');
  }

}

