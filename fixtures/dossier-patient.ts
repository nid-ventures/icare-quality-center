import { type Browser, type Page } from '@playwright/test';
import { PortalPage } from '../pages/structure/portal/portal.page';
import { PatientPage } from '../pages/structure/patient/patient.page';
import { DossierSearchPage } from '../pages/structure/patient/dossier-search.page';
import { PatientDataGenerator } from '../pages/structure/generator/data-generator';
import { ADMIN_STORAGE_STATE } from '../test-data/structure-users';
import { ensureFreshAdminSession } from './admin-login';

export type DossierPatient = { identifier: string; firstName: string; lastName: string };

/** Codes du référentiel sexe de l'application (le dashboard affiche FEMME pour '1'). */
const SEX_CODES = { FEMME: '1', HOMME: '2' } as const;

/**
 * Crée un patient adulte dédié aux tests du dossier médical (jamais un patient existant) et
 * renvoie son identifiant. Par défaut une FEMME : nécessaire pour les consultations prénatales et
 * de planification familiale ; HOMME pour les parcours de soins ciblés par sexe.
 */
export async function createDossierPatient(browser: Browser, sex: keyof typeof SEX_CODES = 'FEMME'): Promise<DossierPatient> {
  await ensureFreshAdminSession(browser);
  const context = await browser.newContext({
    baseURL: process.env.BASE_URL,
    storageState: ADMIN_STORAGE_STATE,
    // Même fenêtre que les projets (cf. playwright.config.ts) : la page suit la taille de la fenêtre.
    viewport: null,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  try {
    const portal = new PortalPage(page);
    const patientPage = new PatientPage(page);
    const data = { ...PatientDataGenerator.generate(), sex: SEX_CODES[sex] };

    await portal.goto();
    await portal.enterModule('Base patients');
    await patientPage.createPatient(data);
    await portal.enterModule('Base patients');
    await patientPage.searchByName(data.firstName, data.lastName);
    await patientPage.expectPatientInList(data.lastName);
    const identifier = await patientPage.getPatientIdentifier(data.lastName);
    return { identifier, firstName: data.firstName, lastName: data.lastName };
  } finally {
    await context.close();
  }
}

/**
 * Délai du beforeAll de création de patiente (allongé en mode ralenti SLOWMO). 5 min : la liste des
 * patients (/patients/getAll), consultée après la création, peut dépasser une minute en local.
 */
export const DOSSIER_SETUP_TIMEOUT = Number(process.env.SLOWMO) > 0 ? 300000 * 6 : 300000;

/** Ouvre le dashboard médical de la patiente depuis la recherche du module Dossier médical. */
export async function openDossier(page: Page, patient: DossierPatient) {
  await new DossierSearchPage(page).openPatientByIdentifier(patient.identifier);
}

/** Revient sur la recherche du module puis rouvre le dossier de la patiente. */
export async function openDossierAgain(page: Page, patient: DossierPatient) {
  await new PortalPage(page).openMenu('Dossiers patients', '**/patient/patients');
  await openDossier(page, patient);
}
