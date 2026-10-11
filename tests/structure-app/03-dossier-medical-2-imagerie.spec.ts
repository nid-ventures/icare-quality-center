import { type Page, type Locator } from '@playwright/test';
import { test, expect } from '../../fixtures/structure.fixture';
import { createDossierPatient, openDossier, DOSSIER_SETUP_TIMEOUT, type DossierPatient } from '../../fixtures/dossier-patient';
import { DossierSearchPage } from '../../pages/structure/patient/dossier-search.page';
import { ImagerieDashboardPage, type ImagingActeKind } from '../../pages/structure/imagerie/imagerie-dashboard.page';
import { ConsultationFormPage, type FieldSpec, type FilledValues } from '../../pages/structure/consultation/consultation-form.page';
import { ImagingWorklistPage } from '../../pages/structure/imagerie/imaging-worklist.page';
import { ImagingDataGenerator } from '../../pages/structure/generator/imaging-data-generator';
import { isoDate } from '../../test-data/consultation-fields';

test.setTimeout(300000);

/** Fichier joint de test (PDF minimal généré en mémoire). */
const attachment = (name: string) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%QA iCare\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n') });

// Champs généraux, communs aux 4 types et modifiables après création (app-imaging-item / echographie-simple-item)
const generalFields = (v: 1 | 2, withExamDate = true): FieldSpec[] => [
  { name: 'caregiverId', kind: 'select', index: v === 1 ? 0 : 1 },
  { name: 'date', kind: 'date', value: isoDate(v === 1 ? -3 : -2) },
  ...(withExamDate ? [{ name: 'dateExam', kind: 'date', value: isoDate(v === 1 ? -1 : 0) } as FieldSpec] : []),
  { name: 'region', kind: 'select', index: v === 1 ? 0 : 1 },
];
// Vérification après réouverture : la date d'examen n'est pas conservée (test d'anomalie dédié)
const checkedGeneralFields = (v: 1 | 2) => generalFields(v).filter(f => f.name !== 'dateExam');

// Scanner, IRM et radiographie : à la création, l'application n'affiche que les champs généraux,
// les actes à facturer et les pièces jointes ; tous les paramètres techniques (protocole, contraste,
// kV, séquences, incidence, résultats…) sont masqués dans les formulaires (attribut hidden).
type ImagingType = {
  kind: ImagingActeKind;
  key: 'scanner' | 'irm' | 'radiographie';
  label: string;
  createRoot: string;
  submit: RegExp;
};

const TYPES: ImagingType[] = [
  { kind: 'SCANNER', key: 'scanner', label: 'Scanner', createRoot: 'app-scanner-static', submit: /Enregistrer le scanner/ },
  { kind: 'IRM', key: 'irm', label: 'IRM', createRoot: 'app-irm-static', submit: /Enregistrer l'IRM|Enregistrer/ },
  { kind: 'RADIOGRAPHIE', key: 'radiographie', label: 'Radiographie', createRoot: 'app-radiographie-static', submit: /Enregistrer la radiographie|Enregistrer/ },
];

const billableActs: FieldSpec[] = [{ name: 'billableActs', kind: 'multiselect', count: 1 }];

// Fiche d'un foetus (échographie obstétricale)
const foetusFields = (n: number): FieldSpec[] => [
  { name: 'presentation', kind: 'text', value: `Céphalique F${n}` },
  { name: 'epf', kind: 'text', value: `${1500 + n * 10} g` },
  { name: 'placenta', kind: 'text', value: `Antérieur F${n}` },
  { name: 'la', kind: 'text', value: `Normal F${n}` },
  { name: 'lcc', kind: 'text', value: `${60 + n} mm` },
  { name: 'cn', kind: 'text', value: `${2 + n} mm` },
  { name: 'bip', kind: 'text', value: `${75 + n} mm` },
  { name: 'ca', kind: 'text', value: `${260 + n} mm` },
  { name: 'lf', kind: 'text', value: `${55 + n} mm` },
  { name: 'opn', kind: 'text', value: `Présents F${n}` },
  { name: 'morphologie', kind: 'text', value: `Sans anomalie F${n}` },
  { name: 'conclusion', kind: 'textarea', value: `Foetus ${n} : croissance harmonieuse QA` },
];

const confirm = async (page: Page) => {
  const button = page.getByRole('button', { name: /^\W*Confirmer$/ }).last();
  await expect(button).toBeVisible({ timeout: 10000 });
  await button.click();
  await expect(button).toBeHidden({ timeout: 30000 });
};

const visible = (page: Page, selector: string) => page.locator(selector).filter({ visible: true }).first();

/** Ligne de l'historique d'imagerie (la plus récente du type), dépliée ; renvoie son formulaire. */
async function openHistoryItem(page: Page, kind: string): Promise<Locator> {
  const item = page.locator(`.imaging-item.imaging-item--${kind}`).first();
  await expect(item, `Acte "${kind}" dans l'historique`).toBeVisible({ timeout: 15000 });
  const body = item.locator('.imaging-item-body');
  if (!(await body.isVisible().catch(() => false))) await item.locator('.imaging-item-header').click();
  await expect(body).toBeVisible();
  return body.locator(kind === 'echographie' ? 'app-echographie-simple-item' : 'app-imaging-item');
}

test.describe('Module Dossier médical — Imagerie', () => {
  let patient: DossierPatient;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(DOSSIER_SETUP_TIMEOUT);
    patient = await createDossierPatient(browser);
  });

  test.beforeEach(async ({ portal, page }) => {
    await portal.enterModule('Dossier médical');
    await new DossierSearchPage(page).expectLoaded();
    await openDossier(page, patient);
    await new ImagerieDashboardPage(page).gotoFromPatientDashboard();
  });

  /** Ouvre le formulaire de création d'un type d'acte (premier sous-type proposé). */
  async function startActe(page: Page, kind: ImagingActeKind, root: string) {
    const imagerie = new ImagerieDashboardPage(page);
    await imagerie.openNewActeModal();
    await imagerie.chooseType(kind);
    const form = visible(page, root);
    await expect(form).toBeVisible();
    return form;
  }

  // ======================================================================
  // Scanner, IRM, radiographie : création complète -> modification -> pièces jointes -> suppression
  // ======================================================================
  for (const type of TYPES) {
    test.describe(type.label, () => {
      test.describe.configure({ mode: 'serial' });
      let general1: FilledValues = {};
      let general2: FilledValues = {};

      test(`Créer un acte "${type.label}" avec tous les champs affichés et une pièce jointe`, async ({ page }) => {
        const root = await startActe(page, type.kind, type.createRoot);
        const form = new ConsultationFormPage(page, root);
        general1 = await form.fill(generalFields(1));
        await form.fill(billableActs);
        await root.locator('input[type="file"]').first().setInputFiles(attachment(`compte-rendu-${type.key}.pdf`));
        await expect(root.getByText(`compte-rendu-${type.key}.pdf`)).toBeVisible();
        await root.getByRole('button', { name: type.submit }).last().click();
        await confirm(page);
        await expect(page.locator(`.imaging-item.imaging-item--${type.key}`).first()).toBeVisible({ timeout: 20000 });
      });

      test(`Rouvrir l'acte "${type.label}" : champs généraux et pièce jointe conservés`, async ({ page }) => {
        const item = await openHistoryItem(page, type.key);
        await new ConsultationFormPage(page, item).expectValues(checkedGeneralFields(1), general1);
        await expect(page.locator(`.imaging-item.imaging-item--${type.key}`).first().locator('.imaging-item-attachments')).toContainText('1');
      });

      test(`La date d'examen du "${type.label}" est conservée`, async ({ page }) => {
        test.fail(true, "Anomalie : la date d'examen saisie n'est pas conservée ; à la réouverture, la fiche affiche la date de l'acte (imaging-item : dateExam absent de la réponse, repli sur date).");
        const item = await openHistoryItem(page, type.key);
        await expect(item.locator('[formcontrolname="dateExam"]')).toHaveValue(general1.dateExam as string, { timeout: 5000 });
      });


      test(`Modifier les champs de l'acte "${type.label}" et ajouter une pièce jointe`, async ({ page }) => {
        const item = await openHistoryItem(page, type.key);
        const form = new ConsultationFormPage(page, item);
        await form.activate('date');
        general2 = await form.fill(generalFields(2));
        await item.locator('input[type="file"]').first().setInputFiles(attachment(`complement-${type.key}.pdf`));
        await expect(item.getByText(`complement-${type.key}.pdf`)).toBeVisible();
        await item.locator('button.btn-success').last().click();
        await confirm(page);
      });

      test(`Rouvrir l'acte "${type.label}" : modifications et 2 pièces jointes conservées`, async ({ page }) => {
        const item = await openHistoryItem(page, type.key);
        await new ConsultationFormPage(page, item).expectValues(checkedGeneralFields(2), general2);
        await expect(page.locator(`.imaging-item.imaging-item--${type.key}`).first().locator('.imaging-item-attachments')).toContainText('2');
      });

      test(`Supprimer l'acte "${type.label}"`, async ({ page }) => {
        const before = await page.locator(`.imaging-item.imaging-item--${type.key}`).count();
        const item = await openHistoryItem(page, type.key);
        await item.getByRole('button', { name: /^\W*Supprimer$/ }).first().click();
        await confirm(page);
        await expect(page.locator(`.imaging-item.imaging-item--${type.key}`)).toHaveCount(before - 1, { timeout: 20000 });
      });
    });
  }

  // ======================================================================
  // Échographie : standard et obstétricale (fiches foetus)
  // ======================================================================
  test.describe('Échographie', () => {
    test.describe.configure({ mode: 'serial' });
    let obstetric: FilledValues = {};
    let foetus1: FilledValues = {};
    let foetus2: FilledValues = {};
    let edited: FilledValues = {};

    test('Créer une échographie standard avec tous les champs', async ({ page }) => {
      const root = await startActe(page, 'ECHOGRAPHIE', 'app-echographie-simple-static');
      const form = new ConsultationFormPage(page, root);
      await form.fill([{ name: 'type', kind: 'select', option: 'Standard' }]);
      await form.fill([
        ...generalFields(1, false),
        { name: 'conclusion', kind: 'text', value: 'Échographie standard normale QA' },
        { name: 'notice', kind: 'textarea', value: 'Foie, rate et reins sans particularité QA' },
        { name: 'billableActs', kind: 'multiselect', count: 1 },
      ]);
      await root.getByRole('button', { name: /Enregistrer l'échographie/ }).click();
      await confirm(page);
      await expect(page.locator('.imaging-item.imaging-item--echographie').first()).toBeVisible({ timeout: 20000 });
    });

    test('Créer une échographie obstétricale avec 2 foetus (tous les champs)', async ({ page }) => {
      const root = await startActe(page, 'ECHOGRAPHIE', 'app-echographie-simple-static');
      const form = new ConsultationFormPage(page, root);
      await form.fill([{ name: 'type', kind: 'select', option: 'Obst' }]);
      obstetric = await form.fill([
        ...generalFields(1, false),
        { name: 'ddr', kind: 'date', value: isoDate(-150) },
        { name: 'billableActs', kind: 'multiselect', count: 1 },
      ]);

      await test.step("Nombre d'embryons : 1 -> une fiche foetus, à remplir", async () => {
        await root.locator('[formcontrolname="nombreEmbryon"]').fill('1');
        const foetuses = root.locator('app-echographie-simple-foetus');
        await expect(foetuses).toHaveCount(1);
        foetus1 = await new ConsultationFormPage(page, foetuses.nth(0)).fill(foetusFields(1));
      });

      await test.step('Ajouter le foetus 2 et remplir sa fiche', async () => {
        await root.getByRole('button', { name: /Ajouter un foetus/ }).click();
        const foetuses = root.locator('app-echographie-simple-foetus');
        await expect(foetuses).toHaveCount(2);
        // Le nombre d'embryons suit le nombre de fiches foetus
        await expect(root.locator('[formcontrolname="nombreEmbryon"]')).toHaveValue('2');
        foetus2 = await new ConsultationFormPage(page, foetuses.nth(1)).fill(foetusFields(2));
      });

      await root.getByRole('button', { name: /Enregistrer l'échographie/ }).click();
      await confirm(page);
    });

    test("Rouvrir l'échographie obstétricale : champs et fiches des 2 foetus conservés", async ({ page }) => {
      const item = await openHistoryItem(page, 'echographie');
      await new ConsultationFormPage(page, item).expectValues([
        { name: 'caregiverId', kind: 'select' }, { name: 'date', kind: 'date', value: '' }, { name: 'ddr', kind: 'date', value: '' },
      ], obstetric);
      const foetuses = item.locator('app-echographie-simple-foetus');
      await expect(foetuses).toHaveCount(2);
      await new ConsultationFormPage(page, foetuses.nth(0)).expectValues(foetusFields(1), foetus1);
      await new ConsultationFormPage(page, foetuses.nth(1)).expectValues(foetusFields(2), foetus2);
    });

    test("Modifier l'échographie : champs généraux et fiche du foetus 1", async ({ page }) => {
      const item = await openHistoryItem(page, 'echographie');
      const form = new ConsultationFormPage(page, item);
      await form.activate('date');
      edited = await form.fill([
        { name: 'caregiverId', kind: 'select', index: 1 },
        { name: 'date', kind: 'date', value: isoDate(-1) },
        { name: 'ddr', kind: 'date', value: isoDate(-140) },
      ]);
      foetus1 = await new ConsultationFormPage(page, item.locator('app-echographie-simple-foetus').nth(0))
        .fill(foetusFields(1).map(f => (f.kind === 'text' || f.kind === 'textarea') ? { ...f, value: `${f.value} (modifié)` } : f));
      await item.locator('button.btn-success').last().click();
      await confirm(page);
    });

    test("Rouvrir l'échographie : modifications des champs généraux conservées", async ({ page }) => {
      const item = await openHistoryItem(page, 'echographie');
      await new ConsultationFormPage(page, item).expectValues([
        { name: 'caregiverId', kind: 'select' }, { name: 'date', kind: 'date', value: '' }, { name: 'ddr', kind: 'date', value: '' },
      ], edited);
    });

    test("Rouvrir l'échographie : modifications de la fiche du foetus 1 conservées", async ({ page }) => {
      test.fail(true, "Anomalie : les modifications d'une fiche foetus d'une échographie existante ne sont pas enregistrées (le front les envoie dans la mise à jour, les anciennes valeurs reviennent à la réouverture).");
      const item = await openHistoryItem(page, 'echographie');
      await new ConsultationFormPage(page, item.locator('app-echographie-simple-foetus').nth(0))
        .expectValues(foetusFields(1), foetus1);
    });

    test('Supprimer les échographies', async ({ page }) => {
      for (let i = 0; i < 2; i++) {
        const before = await page.locator('.imaging-item.imaging-item--echographie').count();
        const item = await openHistoryItem(page, 'echographie');
        await item.getByRole('button', { name: /^\W*Supprimer$/ }).first().click();
        await confirm(page);
        await expect(page.locator('.imaging-item.imaging-item--echographie')).toHaveCount(before - 1, { timeout: 20000 });
      }
    });
  });

  // ======================================================================
  // Modification et suppression depuis la worklist d'imagerie
  // ======================================================================
  test.describe("Depuis la worklist d'imagerie", () => {
    async function createEchographie(page: Page) {
      const imagerie = new ImagerieDashboardPage(page);
      await imagerie.openNewActeModal();
      await imagerie.chooseType('ECHOGRAPHIE');
      await imagerie.fillEchographieCreateForm(ImagingDataGenerator.generateEchographie());
      await imagerie.submitEchographieCreateForm();
      await expect(imagerie.confirmButton).not.toBeVisible();
      await expect(imagerie.newActeButton).toBeVisible();
    }

    test("Modifier une échographie depuis la worklist d'imagerie", async ({ page }) => {
      const worklist = new ImagingWorklistPage(page);
      const updated = ImagingDataGenerator.generateEchographieUpdate();
      await createEchographie(page);
      await worklist.goto();
      const found = await worklist.findFirstRowOfKind('echographie');
      expect(found).not.toBeNull();
      await worklist.echoActiverButton(found!.expandedRow).click();
      const resume = worklist.echoResumeInput(found!.expandedRow);
      const compteRendu = worklist.echoCompteRenduTextarea(found!.expandedRow);
      if (await resume.isVisible().catch(() => false)) await resume.fill(updated.resume);
      if (await compteRendu.isVisible().catch(() => false)) await compteRendu.fill(updated.compteRendu);
      await worklist.echoSubmitButton(found!.expandedRow).click();
      await worklist.confirmModal();
      await expect(worklist.confirmButton).not.toBeVisible();
    });

    test("Supprimer une échographie depuis la worklist d'imagerie", async ({ page }) => {
      const worklist = new ImagingWorklistPage(page);
      await createEchographie(page);
      await worklist.goto();
      const found = await worklist.findFirstRowOfKind('echographie');
      expect(found).not.toBeNull();
      const fingerprint = (await found!.row.locator('td').nth(5).innerText()).trim();
      await worklist.echoSupprimerButton(found!.expandedRow).click();
      await worklist.confirmModal();
      await expect(worklist.confirmButton).not.toBeVisible();
      await worklist.goto();
      await expect(page.locator('table.compact-table tbody tr.table-row', { hasText: fingerprint })).toHaveCount(0);
    });
  });

  // ======================================================================
  // Historique et cas d'exception
  // ======================================================================
  test.describe("Historique et cas d'exception", () => {
    test("Filtrer l'historique par type d'imagerie et l'actualiser", async ({ page }) => {
      const filter = page.locator('.imaging-filter-select');
      await expect(filter).toBeVisible();
      await filter.locator('.ng-select-container').click();
      const options = page.locator('.ng-dropdown-panel .ng-option');
      expect(await options.count(), 'Types proposés dans le filtre').toBeGreaterThan(1);
      await options.nth(1).click();
      await page.getByRole('button', { name: /Actualiser/ }).click();
      await expect(page.locator('.imaging-history')).toBeVisible();
    });

    test("Un scanner sans praticien ni région n'est pas enregistré", async ({ page }) => {
      const root = await startActe(page, 'SCANNER', 'app-scanner-static');
      await root.getByRole('button', { name: /Enregistrer le scanner/ }).click();
      await expect(root.locator('.invalid-feedback-modern').first()).toBeVisible();
      await expect(page.getByRole('button', { name: /^\W*Confirmer$/ })).toHaveCount(0);
    });

    test("Valider un acte d'imagerie sans type est refusé", async ({ page }) => {
      test.fail(true, "Anomalie : \"Valider\" sans type d'acte ferme la fenêtre et ouvre le formulaire sans type (imagerie-dashboard.component.ts, onAddEchographie sans contrôle).");
      const imagerie = new ImagerieDashboardPage(page);
      await imagerie.openNewActeModal();
      await page.locator('.modal.show').getByRole('button', { name: /Valider/ }).click();
      await expect(page.locator('.modal.show'), 'La fenêtre doit rester ouverte avec un message').toBeVisible({ timeout: 3000 });
    });
  });
});
