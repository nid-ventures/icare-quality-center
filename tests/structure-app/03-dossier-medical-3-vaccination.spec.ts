import { type Page } from '@playwright/test';
import { test, expect } from '../../fixtures/structure.fixture';
import { createDossierPatient, openDossier, DOSSIER_SETUP_TIMEOUT, type DossierPatient } from '../../fixtures/dossier-patient';
import { DossierSearchPage } from '../../pages/structure/patient/dossier-search.page';
import { VaccinationPage } from '../../pages/structure/vaccination/vaccination.page';
import { PortalPage } from '../../pages/structure/portal/portal.page';
import { ConsultationFormPage, type FieldSpec, type FilledValues } from '../../pages/structure/consultation/consultation-form.page';
import { isoDate } from '../../test-data/consultation-fields';
import { clearPrefilledConsultant } from '../../pages/structure/shared/consultant';
import { UnsavedDialog } from '../../pages/structure/shared/unsaved-dialog';

test.setTimeout(240000);

// Champs de la création (modale "Veuillez choisir le type de vaccination") ; "terme" y est masqué.
const createFields = (): FieldSpec[] => [
  { name: 'type', kind: 'select' },
  { name: 'caregiverId', kind: 'select' },
  { name: 'dose', kind: 'select' },
  { name: 'date', kind: 'date', value: isoDate(-2) },
  { name: 'lot', kind: 'text', value: `LOT-QA-${Date.now()}` },
  { name: 'commentary', kind: 'textarea', value: 'Vaccination de test : tous les champs QA' },
  { name: 'billableActs', kind: 'multiselect', count: 1 },
];

// Champs de la vaccination modifiables ("Modifier la vaccination")
const editFields = (): FieldSpec[] => [
  { name: 'caregiverId', kind: 'select', index: 1 },
  { name: 'date', kind: 'date', value: isoDate(-1) },
  { name: 'commentary', kind: 'textarea', value: 'Commentaire modifié QA' },
];

// Champs d'une dose (ajout "Nouvelle dose" et modification d'une dose) ; le terme n'est affiché que
// pour une dose de parcours de soins (IsCarePlan), et masqué en modification.
const doseFields = (v: 1 | 2): FieldSpec[] => [
  { name: 'date', kind: 'date', value: isoDate(v === 1 ? 0 : 1) },
  { name: 'dose', kind: 'select', index: v === 1 ? 0 : 1 },
  { name: 'lot', kind: 'text', value: v === 1 ? `DOSE-QA-${Date.now()}` : `DOSE-QA-MODIF-${Date.now()}` },
];

/** AAAA-MM-JJ -> JJ/MM/AAAA (format des en-têtes de doses). */
const frDate = (iso: string) => iso.split('-').reverse().join('/');

/**
 * Dose de la vaccination dépliée, repérée par la date affichée dans son en-tête ("type -- date") :
 * le lot est une valeur de champ, pas du texte affiché. Déplie le volet et renvoie son formulaire.
 */
async function openDose(item: ReturnType<Page['locator']>, isoDay: string) {
  const card = item.locator('.card[id^="accordionItemV_"]').filter({ hasText: frDate(isoDay) }).first();
  await expect(card, `Dose du ${frDate(isoDay)}`).toBeVisible();
  const body = card.locator('app-vaccination-simple-item-item');
  if (!(await body.isVisible().catch(() => false))) await card.locator('.card-header button').click();
  await expect(body).toBeVisible();
  return body;
}

const confirm = async (page: Page) => {
  const button = page.getByRole('button', { name: /^\W*Confirmer$/ }).last();
  await expect(button).toBeVisible({ timeout: 10000 });
  await button.click();
};

const DOSE = 'app-vaccination-simple-item-item';
const doseCards = (item: ReturnType<Page['locator']>) => item.locator('.card[id^="accordionItemV_"]');

// Champs de la vaccination (hors doses) relus après chaque enregistrement
const vaccinationFields = (): FieldSpec[] => createFields().filter(f => ['type', 'caregiverId', 'date', 'commentary', 'billableActs'].includes(f.name));
const doseSpec: FieldSpec[] = [
  { name: 'date', kind: 'date', value: '' },
  { name: 'dose', kind: 'select' },
  { name: 'lot', kind: 'text', value: '' },
];

/** Une dose (repérée par sa date) restitue sa date, sa dose et son lot. */
async function expectDose(page: Page, item: ReturnType<Page['locator']>, values: FilledValues) {
  const dose = await openDose(item, values.date as string);
  await new ConsultationFormPage(page, dose).expectValues(doseSpec, values);
}

/** Doses attendues : exactement ce nombre, chacune avec toutes ses valeurs. */
async function expectDoses(page: Page, item: ReturnType<Page['locator']>, expected: FilledValues[]) {
  await expect(doseCards(item), `${expected.length} dose(s)`).toHaveCount(expected.length, { timeout: 15000 });
  for (const values of expected) await expectDose(page, item, values);
}

test.describe('Module Dossier médical — Vaccination', () => {
  test.describe.configure({ mode: 'serial' });
  let patient: DossierPatient;
  let created: FilledValues = {};
  let edited: FilledValues = {};
  let dose1: FilledValues = {};
  let dose2: FilledValues = {};
  // Dose initiale (saisie à la création de la vaccination) et actes à facturer ajoutés en modification
  const initialDose = (): FilledValues => ({ date: created.date, dose: created.dose, lot: created.lot });
  let addedActs: string[] = [];
  /** Vaccination après modification : champs modifiés, type inchangé, actes d'origine + ajoutés. */
  const afterEdit = (): FilledValues => ({ ...created, ...edited, billableActs: [...(created.billableActs as string[]), ...addedActs] });

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(DOSSIER_SETUP_TIMEOUT);
    patient = await createDossierPatient(browser);
  });

  test.beforeEach(async ({ portal, page }) => {
    await portal.enterModule('Dossier médical');
    await new DossierSearchPage(page).expectLoaded();
    await openDossier(page, patient);
    await new VaccinationPage(page).gotoFromPatientDashboard();
  });

  /** Repart de la recherche des dossiers et rouvre la vaccination : données relues sur le serveur. */
  async function reopenDossier(page: Page) {
    await new PortalPage(page).openMenu('Dossiers patients', '**/patient/patients');
    await openDossier(page, patient);
    await new VaccinationPage(page).gotoFromPatientDashboard();
  }

  /** Déplie la (seule) vaccination de la patiente. */
  async function openVaccination(page: Page) {
    const vaccination = new VaccinationPage(page);
    await vaccination.openFirstVaccination();
    return page.locator('app-vaccination-simple-item').filter({ visible: true }).first();
  }

  test('Créer une vaccination avec tous les champs', async ({ page }) => {
    const vaccination = new VaccinationPage(page);
    await vaccination.openNewVaccinationModal();
    created = await new ConsultationFormPage(page, vaccination.modal).fill(createFields());
    await vaccination.validerButton.click();
    await expect(vaccination.modal).toBeHidden({ timeout: 20000 });
    await expect(vaccination.firstVaccinationHeader).toBeVisible();
    await expect(vaccination.firstVaccinationHeader).toContainText(created.type as string, { ignoreCase: true });
  });

  test('Rouvrir la vaccination : tous les champs, actes à facturer et dose initiale (date, dose, lot) conservés', async ({ page }) => {
    const item = await openVaccination(page);
    await new ConsultationFormPage(page, item).expectValues(vaccinationFields(), created, { exact: true });
    await expectDoses(page, item, [initialDose()]);
  });

  test("Annuler une modification de la vaccination : rien n'est enregistré", async ({ page }) => {
    let item = await openVaccination(page);
    const form = () => new ConsultationFormPage(page, item);
    const before = await form().snapshot(DOSE);
    await item.getByRole('button', { name: /Modifier la vaccination/ }).click();
    await form().fill([...editFields(), { name: 'billableActs', kind: 'multiselect', count: 1 }]);
    await item.getByRole('button', { name: /^\W*Annuler$/ }).click();
    await test.step('Valeurs restaurées à l\'écran', async () => {
      await expect.poll(() => form().snapshot(DOSE), { timeout: 15000, message: 'Valeurs restaurées' }).toEqual(before);
    });
    await test.step('Après rechargement : valeurs de la création', async () => {
      await reopenDossier(page);
      item = await openVaccination(page);
      await form().expectValues(vaccinationFields(), created, { exact: true });
      await expectDoses(page, item, [initialDose()]);
    });
  });

  test('Quitter la vaccination en cours de modification : avertissement, rien n\'est enregistré', async ({ page }) => {
    const item = await openVaccination(page);
    await item.getByRole('button', { name: /Modifier la vaccination/ }).click();
    const commentary = item.locator('[formcontrolname="commentary"]');
    await commentary.fill('Commentaire non enregistré QA');
    const dialog = new UnsavedDialog(page);
    const leave = () => page.locator('.btn-back').filter({ visible: true }).first().click();
    await test.step('Retour : avertissement « Modifications non enregistrées »', async () => {
      await leave();
      await dialog.expectOpen(/MODIFICATIONS NON ENREGISTRÉES/, /seront perdues si vous quittez la page/);
    });
    await test.step('« Rester sur la page » : saisie intacte', async () => {
      await dialog.answer(/Rester sur la page/);
      await expect(page).toHaveURL(/vaccinations\//);
      await expect(commentary).toHaveValue('Commentaire non enregistré QA');
    });
    await test.step('« Quitter quand même » : tableau de bord, la vaccination garde ses valeurs', async () => {
      await leave();
      await dialog.answer(/Quitter quand même/);
      await expect(page).toHaveURL(/patient-dashboard/);
      await new VaccinationPage(page).gotoFromPatientDashboard();
      const reopened = await openVaccination(page);
      await new ConsultationFormPage(page, reopened).expectValues(vaccinationFields(), created, { exact: true });
    });
  });

  test('Modifier la vaccination (consultant, date, commentaire) et ajouter un acte à facturer', async ({ page }) => {
    const item = await openVaccination(page);
    await item.getByRole('button', { name: /Modifier la vaccination/ }).click();
    const form = new ConsultationFormPage(page, item);
    edited = await form.fill(editFields());
    addedActs = (await form.fill([{ name: 'billableActs', kind: 'multiselect', count: 1 }])).billableActs as string[];
    await item.getByRole('button', { name: /^\W*Enregistrer$/ }).click();
    await confirm(page);
    await expect(page.getByText('Vaccination mise à jour avec succès').first()).toBeVisible({ timeout: 15000 });
  });

  test('Rouvrir la vaccination : modifications conservées, type et actes d\'origine inchangés, dose initiale intacte', async ({ page }) => {
    const item = await openVaccination(page);
    await new ConsultationFormPage(page, item).expectValues(vaccinationFields(), afterEdit(), { exact: true });
    // Non-régression (bug backend corrigé le 2026-11-19 : mettre à jour une vaccination vidait ses
    // doses en base) : la dose initiale, et elle seule, est toujours là avec toutes ses valeurs.
    await expectDoses(page, item, [initialDose()]);
  });

  test('Ajouter une dose avec tous les champs', async ({ page }) => {
    const vaccination = new VaccinationPage(page);
    const item = await openVaccination(page);
    const doses = item.locator('.card[id^="accordionItemV_"]');
    // Les doses se chargent après l'ouverture : compter une fois le nombre stable (sinon 0)
    let before = -1;
    await expect(async () => {
      const first = await doses.count();
      await page.waitForTimeout(1000);
      expect(await doses.count()).toBe(first);
      before = first;
    }).toPass({ timeout: 15000 });
    await vaccination.nouvelleDoseButton.click();
    await expect(vaccination.doseForm).toBeVisible();
    dose1 = await new ConsultationFormPage(page, vaccination.doseForm).fill(doseFields(1));
    await vaccination.enregistrerDoseButton.click();
    await expect(page.getByText('Voulez-vous ajouter cette dose')).toBeVisible();
    await confirm(page);
    await expect(vaccination.doseAddedToast).toBeVisible({ timeout: 15000 });
    await expect(doses).toHaveCount(before + 1, { timeout: 15000 });
  });

  test('Rouvrir la vaccination : dose ajoutée complète, dose initiale et vaccination inchangées', async ({ page }) => {
    const item = await openVaccination(page);
    await expectDoses(page, item, [initialDose(), dose1]);
    await new ConsultationFormPage(page, item).expectValues(vaccinationFields(), afterEdit(), { exact: true });
  });

  test('Modifier une dose (tous les champs)', async ({ page }) => {
    const item = await openVaccination(page);
    const dose = await openDose(item, dose1.date as string);
    const form = new ConsultationFormPage(page, dose);
    await form.activate('lot');
    dose2 = await form.fill(doseFields(2));
    await dose.locator('button.btn-success').click();
    await confirm(page);
    await expect(page.getByText(/r[ée]ussi/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('Rouvrir la dose : les modifications sont conservées', async ({ page }) => {
    const item = await openVaccination(page);
    const dose = await openDose(item, dose2.date as string);
    await new ConsultationFormPage(page, dose).expectValues(doseFields(2), dose2);
    // Non-régression : modifier une dose ne retire ni ne modifie l'autre (dose initiale + dose modifiée)
    await expectDoses(page, item, [initialDose(), dose2]);
    await new ConsultationFormPage(page, item).expectValues(vaccinationFields(), afterEdit(), { exact: true });
  });

  test('Enregistrer la vaccination sans rien modifier : aucune donnée ni dose ne change', async ({ page }) => {
    let item = await openVaccination(page);
    const before = await new ConsultationFormPage(page, item).snapshot(DOSE);
    await item.getByRole('button', { name: /Modifier la vaccination/ }).click();
    await item.getByRole('button', { name: /^\W*Enregistrer$/ }).click();
    await confirm(page);
    await expect(page.getByText('Vaccination mise à jour avec succès').first()).toBeVisible({ timeout: 15000 });
    await reopenDossier(page);
    item = await openVaccination(page);
    await expect.poll(() => new ConsultationFormPage(page, item).snapshot(DOSE), { timeout: 20000, message: 'Champs inchangés' }).toEqual(before);
    await expectDoses(page, item, [initialDose(), dose2]);
  });

  test("Enregistrer une dose sans rien modifier : ni elle ni l'autre dose ne change", async ({ page }) => {
    let item = await openVaccination(page);
    const dose = await openDose(item, dose2.date as string);
    const form = new ConsultationFormPage(page, dose);
    await form.activate('lot');
    await dose.locator('button.btn-success').click();
    await confirm(page);
    await expect(page.getByText(/r[ée]ussi/i).first()).toBeVisible({ timeout: 15000 });
    await reopenDossier(page);
    item = await openVaccination(page);
    await expectDoses(page, item, [initialDose(), dose2]);
    await new ConsultationFormPage(page, item).expectValues(vaccinationFields(), afterEdit(), { exact: true });
  });

  test('Une dose sans date ni dose est refusée', async ({ page }) => {
    const vaccination = new VaccinationPage(page);
    await openVaccination(page);
    await vaccination.nouvelleDoseButton.click();
    await expect(vaccination.doseForm).toBeVisible();
    await vaccination.doseDateInput.fill('');
    await vaccination.enregistrerDoseButton.click();
    await expect(vaccination.doseForm.getByText('La dose est obligatoire').first()).toBeVisible();
    await expect(vaccination.doseForm.getByText('La date est obligatoire').first()).toBeVisible();
  });

  test('Supprimer une dose', async ({ page }) => {
    const item = await openVaccination(page);
    const doses = item.locator('.card[id^="accordionItemV_"]');
    // Les doses se chargent après l'ouverture : compter une fois le nombre stable (sinon 0)
    let before = -1;
    await expect(async () => {
      const first = await doses.count();
      await page.waitForTimeout(1000);
      expect(await doses.count()).toBe(first);
      before = first;
    }).toPass({ timeout: 15000 });
    const dose = await openDose(item, dose2.date as string);
    await dose.getByRole('button', { name: /Supprimer/ }).click();
    await confirm(page);
    await expect(doses).toHaveCount(before - 1, { timeout: 15000 });
    await test.step('Après rechargement : seule la dose initiale reste, intacte, et la vaccination est inchangée', async () => {
      await reopenDossier(page);
      const reopened = await openVaccination(page);
      await expectDoses(page, reopened, [initialDose()]);
      await new ConsultationFormPage(page, reopened).expectValues(vaccinationFields(), afterEdit(), { exact: true });
    });
  });

  test('Supprimer la vaccination', async ({ page }) => {
    const vaccination = new VaccinationPage(page);
    await vaccination.deleteFirstVaccination();
    await expect(vaccination.firstVaccinationHeader).toHaveCount(0, { timeout: 15000 });
  });

  test("Une vaccination sans type, consultant ni dose n'est pas enregistrée", async ({ page }) => {
    const vaccination = new VaccinationPage(page);
    await vaccination.openNewVaccinationModal();
    // Consultant prérempli si l'utilisateur connecté est soignant (selon la structure)
    await clearPrefilledConsultant(vaccination.modal);
    await vaccination.validerButton.click();
    for (const message of ['Le type est obligatoire', 'Le consultant est obligatoire', 'La dose est obligatoire']) {
      await expect(vaccination.modal.getByText(message), message).toBeVisible();
    }
  });
});
