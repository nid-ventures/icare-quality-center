import { type Page, type Locator, expect } from '@playwright/test';

export class DashboardPage {
  private readonly patientStat: Locator;
  private readonly medecinStat: Locator;
  private readonly secretaireStat: Locator;
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

  }async modulesSettingsIsVisible() {
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

}

