import { type Page } from '@playwright/test';
import { test, expect } from '../../fixtures/structure.fixture';
import { createDossierPatient, openDossier, DOSSIER_SETUP_TIMEOUT, type DossierPatient } from '../../fixtures/dossier-patient';
import { DossierSearchPage } from '../../pages/structure/patient/dossier-search.page';
import { VaccinationPage } from '../../pages/structure/vaccination/vaccination.page';
import { ConsultationFormPage, type FieldSpec, type FilledValues } from '../../pages/structure/consultation/consultation-form.page';
import { isoDate } from '../../test-data/consultation-fields';

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

test.describe('Module Dossier médical — Vaccination', () => {
  test.describe.configure({ mode: 'serial' });
  let patient: DossierPatient;
  let created: FilledValues = {};
  let edited: FilledValues = {};
  let dose1: FilledValues = {};
  let dose2: FilledValues = {};

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

  test('Rouvrir la vaccination : les champs sont conservés et la dose initiale est listée', async ({ page }) => {
    const item = await openVaccination(page);
    await new ConsultationFormPage(page, item).expectValues(
      createFields().filter(f => ['type', 'caregiverId', 'date', 'commentary', 'billableActs'].includes(f.name)), created);
    const initialDose = await openDose(item, created.date as string);
    await expect(initialDose.locator('[formcontrolname="lot"]')).toHaveValue(created.lot as string);
  });

  test('Modifier la vaccination (consultant, date, commentaire)', async ({ page }) => {
    const item = await openVaccination(page);
    await item.getByRole('button', { name: /Modifier la vaccination/ }).click();
    edited = await new ConsultationFormPage(page, item).fill(editFields());
    await item.getByRole('button', { name: /^\W*Enregistrer$/ }).click();
    await confirm(page);
    await expect(page.getByText('Vaccination mise à jour avec succès').first()).toBeVisible({ timeout: 15000 });
  });

  test('Rouvrir la vaccination : les modifications sont conservées', async ({ page }) => {
    const item = await openVaccination(page);
    await new ConsultationFormPage(page, item).expectValues(editFields(), edited);
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
  });

  test('Supprimer la vaccination', async ({ page }) => {
    const vaccination = new VaccinationPage(page);
    await vaccination.deleteFirstVaccination();
    await expect(vaccination.firstVaccinationHeader).toHaveCount(0, { timeout: 15000 });
  });

  test("Une vaccination sans type, consultant ni dose n'est pas enregistrée", async ({ page }) => {
    const vaccination = new VaccinationPage(page);
    await vaccination.openNewVaccinationModal();
    await vaccination.validerButton.click();
    for (const message of ['Le type est obligatoire', 'Le consultant est obligatoire', 'La dose est obligatoire']) {
      await expect(vaccination.modal.getByText(message), message).toBeVisible();
    }
  });
});
