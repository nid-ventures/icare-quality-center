import { type Browser, type Page, expect } from '@playwright/test';
import { PortalPage } from '../pages/structure/portal/portal.page';
import { PatientPage } from '../pages/structure/patient/patient.page';
import { BillingInvoicePage } from '../pages/structure/billing/billing-invoice.page';
import { RemunerationProfilePage } from '../pages/structure/my-space/remuneration-profile.page';
import { CreateHonorairePage } from '../pages/structure/honoraire/create-honoraire.page';
import { ADMIN_STORAGE_STATE } from '../test-data/structure-users';

/**
 * Prérequis des relevés d'honoraires, créés par les tests eux-mêmes si besoin :
 *  1. un profil de rémunération (Administration > Paramètres > Rémunération médecin) pour une
 *     spécialité et le premier acte paramétré pour celle-ci ;
 *  2. un médecin de cette spécialité, proposé dans "Nouveau relevé" ;
 *  3. des actes de ce médecin facturés dans la période (voir billActForMedecin, appelé par chaque
 *     test qui crée un relevé : un acte déjà relevé n'est plus éligible).
 */
export const HONORAIRE_SPECIALITY = 'pédiatrie';

export type HonoraireContext = { medecin: string; patientIdentifier: string; act: string; category: string };

export const HONORAIRE_SETUP_TIMEOUT = Number(process.env.SLOWMO) > 0 ? 300000 * 6 : 300000;

function isoDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function referencePatientIdentifier(portal: PortalPage, page: Page): Promise<string> {
  const patientPage = new PatientPage(page);
  await portal.enterModule('Base patients');
  await patientPage.gotoPatientsList();
  const identifier = await patientPage.getFirstPatientId();
  expect(identifier, 'Un patient est nécessaire pour facturer des actes').not.toBe('');
  return identifier;
}

/** Garantit le profil de rémunération et renvoie le médecin à utiliser pour les relevés. */
export async function ensureHonorairePrerequisites(browser: Browser): Promise<HonoraireContext> {
  const context = await browser.newContext({
    baseURL: process.env.BASE_URL,
    storageState: ADMIN_STORAGE_STATE,
    viewport: null,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  try {
    const portal = new PortalPage(page);
    await portal.goto();
    const patientIdentifier = await referencePatientIdentifier(portal, page);

    // Premier acte paramétré pour la spécialité, puis profil de rémunération (créé une seule fois)
    await portal.enterModule('Administration');
    const profiles = new RemunerationProfilePage(page);
    await profiles.open();
    // Un acte déjà couvert par un profil n'est plus proposé : on réutilise d'abord le profil existant.
    let profile = await profiles.findActiveProfile(HONORAIRE_SPECIALITY);
    if (!profile) {
      profile = await profiles.firstProposition(HONORAIRE_SPECIALITY);
      await profiles.create({
        speciality: HONORAIRE_SPECIALITY, act: profile.act, coverage: '15', mount: '5000',
        startDate: isoDate(-730), endDate: isoDate(730),
      });
    }
    const { category, act } = profile;

    // Médecin de cette spécialité proposé dans "Nouveau relevé"
    await portal.enterModule('Honoraires');
    const createPage = new CreateHonorairePage(page);
    await createPage.gotoViaMenu();
    expect(await createPage.hasMedecinDisponible(), 'Un médecin doit être proposé après création du profil').toBeTruthy();
    // Médecin de la spécialité du profil, pas le premier de la liste : la liste reprend aussi les
    // médecins dont la rémunération est désactivée (anomalie : profils lus sans filtre "actif")
    const medecins = await createPage.listMedecins();
    await page.keyboard.press('Escape');
    const pediatre = medecins.find(m => new RegExp(HONORAIRE_SPECIALITY, 'i').test(m.specialite));
    expect(pediatre, `Un médecin de spécialité "${HONORAIRE_SPECIALITY}" proposé`).toBeDefined();
    await createPage.selectMedecin(pediatre!.nom);
    const medecin = pediatre!.nom;
    return { medecin, patientIdentifier, act, category };
  } finally {
    await context.close();
  }
}

/** Facture au patient de référence l'acte du profil, réalisé par le médecin du relevé. */
export async function billActForMedecin(page: Page, ctx: HonoraireContext) {
  const portal = new PortalPage(page);
  await portal.enterModule('Facturation');
  await page.waitForURL('**/billing/billings-create');
  await new BillingInvoicePage(page).createInvoiceForPractitioner(ctx.patientIdentifier, ctx.medecin, { category: ctx.category, act: ctx.act });
}
