import { type Page, type Locator } from '@playwright/test';
import { test, expect } from '../../fixtures/structure.fixture';
import { createDossierPatient, openDossier, DOSSIER_SETUP_TIMEOUT, type DossierPatient } from '../../fixtures/dossier-patient';
import { PortalPage } from '../../pages/structure/portal/portal.page';
import { CarePathwayPage } from '../../pages/structure/patient/care-pathway.page';
import { CarePathwayTemplatePage, ACT_DOMAINS, type CarePathwayTemplate } from '../../pages/structure/my-space/care-pathway-template.page';
import { ConsultationFormPage } from '../../pages/structure/consultation/consultation-form.page';
import { isoDate } from '../../test-data/consultation-fields';

test.setTimeout(300000);

// Suivi complet d'un parcours de soins, sur 3 parcours paramétrés par les tests, un par sexe cible.
// Chaque parcours a 2 étapes contenant chacune les 4 types d'actes (consultation, échographie,
// vaccination, bilan). Ils sont démarrés sur une patiente et un patient dédiés.
const stamp = Date.now().toString().slice(-6);
const allTypesStep = (plannedPeriod: string) => ({ plannedPeriod, groups: ACT_DOMAINS.map(domain => ({ domain, acts: 1 })) });

const FEMMES: CarePathwayTemplate = {
  name: `QA-SUIVI-F-${stamp}`, description: 'Suivi femmes : tous les types d\'actes', targetSex: 'Femmes uniquement',
  steps: [allTypesStep('0'), allTypesStep('7')],
};
const HOMMES: CarePathwayTemplate = {
  name: `QA-SUIVI-H-${stamp}`, description: 'Suivi hommes : tous les types d\'actes', targetSex: 'Hommes uniquement',
  steps: [allTypesStep('0'), allTypesStep('7')],
};
const TOUS: CarePathwayTemplate = {
  name: `QA-SUIVI-T-${stamp}`, description: 'Suivi tous les sexes : tous les types d\'actes', targetSex: 'Tous les sexes',
  steps: [allTypesStep('0'), allTypesStep('7')],
};

const confirm = async (page: Page) => {
  const button = page.getByRole('button', { name: /^\W*Confirmer$/ }).last();
  await expect(button).toBeVisible({ timeout: 10000 });
  await button.click();
  await expect(button).toBeHidden({ timeout: 30000 });
};

/** Message de succès de l'application (modale de message ou toast). */
const success = (page: Page) =>
  page.locator('.toast-success').or(page.getByText(/r[ée]ussi|succès|bien enregistré/i)).first();

async function openTemplates(page: Page) {
  await new PortalPage(page).enterModule('Administration');
  const templates = new CarePathwayTemplatePage(page);
  await templates.open();
  return templates;
}

/** Ouvre le dashboard médical du patient (rafraîchit au passage le cache des modèles). */
async function openPatientFile(page: Page, patient: DossierPatient) {
  await new PortalPage(page).enterModule('Dossier médical');
  await openDossier(page, patient);
  await expect(page.getByRole('heading', { name: /Parcours de soins/ })).toBeVisible();
}

/** Tuile (lien actif ou bouton grisé) d'un type de parcours sur le dashboard. */
const pathwayTile = (page: Page, name: string) =>
  page.locator('.pathway-actions .qa-btn').filter({ hasText: name });

/** Ouvre le détail du parcours en cours `name` depuis le dashboard du patient. */
async function openPathway(page: Page, patient: DossierPatient, name: string) {
  await openPatientFile(page, patient);
  await page.getByRole('link', { name: new RegExp(`${name}\\s*Voir le parcours`) }).first().click();
  await page.waitForURL('**/patient/patient-care-pathway-detail/**');
  await expect(page.locator('.pw-hero')).toBeVisible({ timeout: 20000 });
}

/** Démarre le parcours `name` (date du jour + premier praticien) sur le patient ouvert. */
async function startPathway(page: Page, name: string) {
  const carePathway = new CarePathwayPage(page);
  await carePathway.openStartForm(name);
  await expect(page.locator('ul.iq-timeline > li'), 'Aperçu : 2 étapes').toHaveCount(2);
  await carePathway.fillStartForm(isoDate());
  await carePathway.start();
  await expect(page.getByRole('button', { name: /^Étape \d+$/ })).toHaveCount(2);
}

/** Bouton de navigation de l'étape n dans le bandeau. */
const stepButton = (page: Page, n: number) => page.locator('.pw-steps-track button.pw-step').filter({ hasText: `Étape ${n}` });
/** Contenu de l'étape affichée. */
const activeStep = (page: Page) => page.locator('.pw-tab-pane--active');

/** Ouvre la tuile de prestation `domain` de l'étape affichée et déplie son acte ; renvoie le corps. */
async function openAct(page: Page, domain: RegExp): Promise<Locator> {
  const step = activeStep(page);
  const tile = step.locator('.quick-actions a.qa-btn').filter({ hasText: domain });
  await expect(tile, `Prestation ${domain}`).toBeVisible();
  await tile.click();
  const content = step.locator('.embed-block > div:not([hidden])');
  const item = content.locator('.acc-item').first();
  await expect(item).toBeVisible();
  const body = item.locator('.acc-item-body');
  if (!(await body.isVisible().catch(() => false))) await item.locator('.acc-item-header').click();
  await expect(body).toBeVisible();
  return body;
}

/** L'acte de la prestation `domain` est réalisé : son en-tête porte un N° de bon. */
async function expectActDone(page: Page, domain: RegExp) {
  await expect(async () => {
    const step = activeStep(page);
    await step.locator('.quick-actions a.qa-btn').filter({ hasText: domain }).click();
    await expect(step.locator('.embed-block > div:not([hidden]) .acc-item-badge').first()).toContainText('N°', { timeout: 3000 });
  }).toPass({ timeout: 30000 });
}

test.describe('Module Dossier médical — Suivi des parcours de soins (homme, femme, tous les sexes)', () => {
  test.describe.configure({ mode: 'serial' });
  let woman: DossierPatient;
  let man: DossierPatient;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(DOSSIER_SETUP_TIMEOUT * 2);
    woman = await createDossierPatient(browser);
    man = await createDossierPatient(browser, 'HOMME');
  });

  test.beforeEach(async ({ portal }) => {
    await portal.goto();
  });

  // ---------------- Paramétrage et proposition selon le sexe ----------------
  test('Paramétrer 3 parcours (femmes, hommes, tous les sexes) avec tous les types d\'actes', async ({ page }) => {
    const templates = await openTemplates(page);
    for (const template of [FEMMES, HOMMES, TOUS]) {
      await test.step(`Parcours ${template.name} (${template.targetSex})`, async () => {
        const acts = await templates.create(template);
        for (const [i, stepActs] of acts.entries()) {
          expect(stepActs.length, `Étape ${i + 1} : un acte par type`).toBe(ACT_DOMAINS.length);
        }
      });
    }
  });

  test('La patiente voit les parcours femmes et tous les sexes, pas celui des hommes', async ({ page }) => {
    const carePathway = new CarePathwayPage(page);
    await openTemplates(page);
    await openPatientFile(page, woman);
    await expect(carePathway.startLink(FEMMES.name)).toHaveCount(1);
    await expect(carePathway.startLink(TOUS.name)).toHaveCount(1);
    await expect(pathwayTile(page, HOMMES.name), 'Parcours hommes ni proposé ni grisé').toHaveCount(0);
  });

  test('Le patient voit les parcours hommes et tous les sexes, pas celui des femmes', async ({ page }) => {
    const carePathway = new CarePathwayPage(page);
    await openTemplates(page);
    await openPatientFile(page, man);
    await expect(carePathway.startLink(HOMMES.name)).toHaveCount(1);
    await expect(carePathway.startLink(TOUS.name)).toHaveCount(1);
    await expect(pathwayTile(page, FEMMES.name), 'Parcours femmes ni proposé ni grisé').toHaveCount(0);
  });

  // ---------------- Démarrage ----------------
  test('Démarrer le parcours femmes et le parcours tous les sexes chez la patiente', async ({ page }) => {
    await openTemplates(page);
    for (const template of [FEMMES, TOUS]) {
      await test.step(`Démarrer ${template.name}`, async () => {
        await openPatientFile(page, woman);
        await startPathway(page, template.name);
      });
    }
  });

  test('Démarrer le parcours hommes et le parcours tous les sexes chez le patient', async ({ page }) => {
    await openTemplates(page);
    for (const template of [HOMMES, TOUS]) {
      await test.step(`Démarrer ${template.name}`, async () => {
        await openPatientFile(page, man);
        await startPathway(page, template.name);
      });
    }
  });

  test('Les parcours en cours sont grisés et consultables sur le dashboard', async ({ page }) => {
    for (const [patient, templates] of [[woman, [FEMMES, TOUS]], [man, [HOMMES, TOUS]]] as const) {
      await openPatientFile(page, patient);
      for (const template of templates) {
        await expect(pathwayTile(page, template.name).first(), `${template.name} grisé`).toBeDisabled();
        await expect(page.getByRole('link', { name: new RegExp(`${template.name}\\s*Voir le parcours`) })).toBeVisible();
      }
    }
  });

  // ---------------- Détail du parcours et navigation ----------------
  test('Détail du parcours : état, informations, actes prévus par étape', async ({ page }) => {
    await openPathway(page, woman, FEMMES.name);
    await expect(page.locator('.pw-hero-status')).toHaveText(/Courant/);
    await expect(page.locator('.pw-state')).toHaveText(/En cours/);
    await expect(page.locator('.pw-info-line').filter({ hasText: "Date d'enregistrement" })).not.toContainText(/^\s*-?\s*$/);
    const planned = page.locator('.pw-acts-item');
    await expect(planned, 'Actes prévus : une ligne par étape').toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      await expect(planned.nth(i)).toContainText(`Étape ${i + 1}`);
      await expect(planned.nth(i).locator('.pw-act-badge'), `Étape ${i + 1} : 4 actes`).toHaveCount(ACT_DOMAINS.length);
    }
  });

  test('Naviguer entre les étapes', async ({ page }) => {
    await openPathway(page, woman, FEMMES.name);
    await expect(activeStep(page)).toContainText('Étape 1');
    await stepButton(page, 2).click();
    await expect(activeStep(page)).toContainText('Étape 2');
    await stepButton(page, 1).click();
    await expect(activeStep(page)).toContainText('Étape 1');
  });

  test("Chaque étape propose les 4 types de prestations", async ({ page }) => {
    await openPathway(page, woman, FEMMES.name);
    for (const n of [1, 2]) {
      await stepButton(page, n).click();
      await expect(activeStep(page).locator('.quick-actions a.qa-btn'), `Étape ${n}`).toHaveCount(ACT_DOMAINS.length);
    }
  });

  // ---------------- Réalisation des actes de l'étape 1 ----------------
  test("Réaliser la consultation de l'étape 1", async ({ page }) => {
    await openPathway(page, woman, FEMMES.name);
    const body = await openAct(page, /Consultation/i);
    await new ConsultationFormPage(page, body).activate('date');
    const caregiver = body.locator('ng-select[formcontrolname="caregiverId"]').first();
    if (await caregiver.locator('.ng-value').count() === 0) {
      await new ConsultationFormPage(page, body).fill([{ name: 'caregiverId', kind: 'select' }]);
    }
    await body.getByRole('button', { name: /Mettre à jour la consultation|Enregistrer la consultation/ }).click();
    await confirm(page);
    await expect(success(page)).toBeVisible({ timeout: 20000 });
    await expectActDone(page, /Consultation/i);
  });

  test("Réaliser l'échographie de l'étape 1", async ({ page }) => {
    await openPathway(page, woman, FEMMES.name);
    const body = await openAct(page, /chographie/i);
    const form = new ConsultationFormPage(page, body);
    await form.activate('date');
    await form.fill([
      { name: 'caregiverId', kind: 'select' },
      { name: 'date', kind: 'date', value: isoDate() },
      { name: 'region', kind: 'select' },
    ]);
    await body.locator('button.btn-success').last().click();
    await confirm(page);
    await expect(success(page)).toBeVisible({ timeout: 20000 });
    await expectActDone(page, /chographie/i);
  });

  test("Réaliser la vaccination de l'étape 1 (première dose)", async ({ page }) => {
    await openPathway(page, woman, FEMMES.name);
    const body = await openAct(page, /Vaccination/i);
    await body.getByRole('button', { name: /Nouvelle dose/ }).click();
    const doseForm = body.locator('app-vaccination-simple-item-static');
    await expect(doseForm).toBeVisible();
    // Dans un parcours, la dose porte aussi le terme
    await new ConsultationFormPage(page, doseForm).fill([
      { name: 'date', kind: 'date', value: isoDate() },
      { name: 'terme', kind: 'text', value: 'Rappel QA' },
      { name: 'dose', kind: 'select' },
    ]);
    await doseForm.getByRole('button', { name: /Enregistrer la dose/ }).click();
    await confirm(page);
    await expect(success(page)).toBeVisible({ timeout: 20000 });
    await expectActDone(page, /Vaccination/i);
  });

  test("Réaliser le bilan de l'étape 1", async ({ page }) => {
    await openPathway(page, woman, FEMMES.name);
    const body = await openAct(page, /Bilan/i);
    const create = body.locator('app-create-health-check');
    await expect(create, 'Formulaire de création du bilan').toBeVisible();
    await new ConsultationFormPage(page, create).fill([
      { name: 'caregiverId', kind: 'select' },
      { name: 'diagnostic', kind: 'textarea', value: 'Bilan du parcours QA' },
    ]);
    await create.getByRole('button', { name: /^\s*Enregistrer\s*$/ }).click();
    await expect(success(page)).toBeVisible({ timeout: 20000 });
    await expectActDone(page, /Bilan/i);
  });

  // ---------------- Clôture des étapes ----------------
  test("Clôturer l'étape 1 (tous les actes réalisés) : étape terminée", async ({ page }) => {
    await openPathway(page, woman, FEMMES.name);
    await activeStep(page).getByRole('button', { name: /Clôturer cette étape/ }).click();
    await confirm(page);
    await expect(page.getByText(/clôture de cet étape a\s+reussi/i).first()).toBeVisible({ timeout: 20000 });
    await expect(stepButton(page, 1)).toHaveClass(/pw-step-success/, { timeout: 20000 });
    await expect(activeStep(page).getByRole('button', { name: /Clôturer cette étape/ })).toHaveCount(0);
  });

  test("Clôturer l'étape 2 sans acte réalisé : étape incomplète", async ({ page }) => {
    await openPathway(page, woman, FEMMES.name);
    await stepButton(page, 2).click();
    await expect(activeStep(page)).toContainText('Étape 2');
    await activeStep(page).getByRole('button', { name: /Clôturer cette étape/ }).click();
    await confirm(page);
    await expect(page.getByText(/clôture de cet étape a\s+reussi/i).first()).toBeVisible({ timeout: 20000 });
    await expect(stepButton(page, 2)).toHaveClass(/pw-step-warning/, { timeout: 20000 });
  });

  // ---------------- Résumé et modification ----------------
  test('Ouvrir le résumé du parcours', async ({ page }) => {
    await openPathway(page, woman, FEMMES.name);
    await page.getByRole('button', { name: /Voir résumé/ }).click();
    const summary = page.locator('#bd-summary');
    await expect(summary).toBeVisible();
    await expect(summary.getByText('Résumé du parcours')).toBeVisible();
    await summary.getByRole('button', { name: /Close|×/ }).first().click();
    await expect(summary).toBeHidden();
  });

  test('Modifier le parcours (praticien et date de début)', async ({ page }) => {
    await openPathway(page, woman, FEMMES.name);
    await page.getByRole('button', { name: new RegExp(`Modifier ${FEMMES.name}`) }).click();
    const modal = page.locator('#bd-careplan');
    await expect(modal).toBeVisible();
    await new ConsultationFormPage(page, modal).fill([
      { name: 'startDate', kind: 'date', value: isoDate(-1) },
      { name: 'caregiverId', kind: 'select', index: 1 },
    ]);
    await modal.getByRole('button', { name: /^\s*Enregistrer\s*$/ }).click();
    await confirm(page);
    await expect(page.getByText(/modification de ce parcours .* a réussi/i).first()).toBeVisible({ timeout: 20000 });
  });

  // ---------------- Archivage ----------------
  test("Archiver sans renseigner l'année ni le sexe de l'enfant est refusé", async ({ page }) => {
    await openPathway(page, woman, FEMMES.name);
    await page.getByRole('button', { name: new RegExp(`Archiver ${FEMMES.name}`) }).click();
    const modal = page.locator('#obstetrical');
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: /^\s*Enregistrer\s*$/ }).click();
    await expect(modal.getByText("L'année est obligatoire")).toBeVisible();
    await expect(modal.getByText("Le sexe de l'enfant 1 est obligatoire")).toBeVisible();
    await expect(modal.getByText('Veuillez remplir tous les champs obligatoires')).toBeVisible();
    await expect(page).toHaveURL(/patient-care-pathway-detail/);
  });

  test("Archiver un parcours non prénatal ne demande pas d'antécédent obstétrical", async ({ page }) => {
    test.fail(true, "Anomalie : l'archivage de tout parcours (vaccinal, pédiatrique, parcours d'un homme…) ouvre le formulaire d'issue de grossesse et crée un antécédent obstétrical (care-pathways-step openModalArchive / openModalAntecedentObstetrical).");
    await openPathway(page, man, HOMMES.name);
    await page.getByRole('button', { name: new RegExp(`Archiver ${HOMMES.name}`) }).click();
    const modal = page.locator('#obstetrical');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Issue de la grossesse'), 'Pas de question de grossesse').toHaveCount(0, { timeout: 3000 });
  });

  test('Archiver le parcours de la patiente avec tous les champs', async ({ page }) => {
    await openPathway(page, woman, FEMMES.name);
    await page.getByRole('button', { name: new RegExp(`Archiver ${FEMMES.name}`) }).click();
    const modal = page.locator('#obstetrical');
    await expect(modal).toBeVisible();
    await new ConsultationFormPage(page, modal).fill([
      { name: 'annee', kind: 'number', value: String(new Date().getFullYear()) },
      { name: 'issue', kind: 'select' },
      { name: 'terme', kind: 'text', value: '39 SA + 2 jours' },
      { name: 'complications', kind: 'multiselect', count: 1 },
      { name: 'sexe', kind: 'select' },
      { name: 'poids', kind: 'number', value: '3200' },
      { name: 'accouchement_delivrance', kind: 'select' },
      { name: 'allaitement', kind: 'select' },
      { name: 'evolution_commentaire', kind: 'select' },
      { name: 'precisions', kind: 'textarea', value: 'Archivage du parcours de suivi QA' },
    ]);
    await modal.getByRole('button', { name: /^\s*Enregistrer\s*$/ }).click();
    await expect(page.getByText(/archivage a reussie/i).first()).toBeVisible({ timeout: 20000 });
    await page.waitForURL('**/patient/patient-care-pathway-list/**');
  });

  test('Le parcours archivé est listé dans les archives et consultable en lecture seule', async ({ page }) => {
    const carePathway = new CarePathwayPage(page);
    await openPatientFile(page, woman);
    await carePathway.openArchivesFromDashboard();
    const rows = page.locator('table.cpl-table tbody tr').filter({ has: page.locator('.cpl-action-btn') });
    await expect(rows.first()).toBeVisible();
    const row = rows.filter({ hasText: /clôtur/i }).first();
    await row.locator('.cpl-action-btn').click();
    await row.getByRole('link', { name: /Voir les détails/ }).click();
    await page.waitForURL('**/patient/patient-care-pathway-detail/**');
    await expect(page.locator('.pw-hero-status')).toHaveText(/Archivé/);
    await expect(page.getByRole('button', { name: /Clôturer cette étape/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Archiver/ })).toHaveCount(0);
  });

  test("Après archivage, le parcours femmes est de nouveau proposé à la patiente", async ({ page }) => {
    await openTemplates(page);
    await openPatientFile(page, woman);
    await expect(new CarePathwayPage(page).startLink(FEMMES.name)).toHaveCount(1);
  });

  // ---------------- Parcours du patient homme ----------------
  test("Patient homme : réaliser la consultation de l'étape 1 du parcours hommes", async ({ page }) => {
    await openPathway(page, man, HOMMES.name);
    const body = await openAct(page, /Consultation/i);
    await new ConsultationFormPage(page, body).activate('date');
    const caregiver = body.locator('ng-select[formcontrolname="caregiverId"]').first();
    if (await caregiver.locator('.ng-value').count() === 0) {
      await new ConsultationFormPage(page, body).fill([{ name: 'caregiverId', kind: 'select' }]);
    }
    await body.getByRole('button', { name: /Mettre à jour la consultation|Enregistrer la consultation/ }).click();
    await confirm(page);
    await expect(success(page)).toBeVisible({ timeout: 20000 });
    await expectActDone(page, /Consultation/i);
  });

  // ---------------- Nettoyage : archivage des parcours restants puis suppression des modèles ----------------
  test('Archiver les parcours restants et supprimer les 3 modèles', async ({ page }) => {
    test.setTimeout(600000);
    for (const [patient, template] of [[woman, TOUS], [man, HOMMES], [man, TOUS]] as const) {
      await test.step(`Archiver ${template.name}`, async () => {
        await openPathway(page, patient, template.name);
        await page.getByRole('button', { name: new RegExp(`Archiver ${template.name}`) }).click();
        const modal = page.locator('#obstetrical');
        await expect(modal).toBeVisible();
        await new ConsultationFormPage(page, modal).fill([
          { name: 'annee', kind: 'number', value: String(new Date().getFullYear()) },
          { name: 'sexe', kind: 'select' },
        ]);
        await modal.getByRole('button', { name: /^\s*Enregistrer\s*$/ }).click();
        await page.waitForURL('**/patient/patient-care-pathway-list/**', { timeout: 30000 });
      });
    }
    const templates = await openTemplates(page);
    for (const template of [FEMMES, HOMMES, TOUS]) {
      await test.step(`Supprimer le modèle ${template.name}`, async () => templates.remove(template.name));
    }
  });
});
