import { type Page } from '@playwright/test';
import { test, expect } from '../../fixtures/structure.fixture';
import { createDossierPatient, openDossier, DOSSIER_SETUP_TIMEOUT, type DossierPatient } from '../../fixtures/dossier-patient';
import { PortalPage } from '../../pages/structure/portal/portal.page';
import { CarePathwayPage } from '../../pages/structure/patient/care-pathway.page';
import { CarePathwayTemplatePage, ACT_DOMAINS, type CarePathwayTemplate, type SelectedActs } from '../../pages/structure/my-space/care-pathway-template.page';
import { ADMIN_STORAGE_STATE } from '../../test-data/structure-users';

test.setTimeout(300000);

// Parcours de soins créés par les tests (Administration > Paramètres > Parcours de soins),
// couvrant tous les types d'actes et tous les actes de leurs catalogues, puis démarrés sur une
// patiente dédiée. Mode série : les modèles sont supprimés à la fin.
const stamp = Date.now().toString().slice(-6);

const ALL_ACTS: CarePathwayTemplate = {
  name: `QA-TOUS-ACTES-${stamp}`,
  description: 'Une étape par type d\'acte, tous les actes de chaque catalogue',
  targetSex: 'Tous les sexes',
  startDateLabel: 'Début du suivi QA',
  steps: ACT_DOMAINS.map((domain, i) => ({ plannedPeriod: String(i * 7), groups: [{ domain, acts: 'all' as const }] })),
};

const COMBINED: CarePathwayTemplate = {
  name: `QA-COMBINE-${stamp}`,
  description: 'Une seule étape combinant tous les types d\'actes',
  targetSex: 'Femmes uniquement',
  steps: [{ plannedPeriod: '0', groups: ACT_DOMAINS.map(domain => ({ domain, acts: 'all' as const })) }],
};

const MEN_ONLY: CarePathwayTemplate = {
  name: `QA-HOMMES-${stamp}`,
  description: 'Parcours réservé aux hommes',
  targetSex: 'Hommes uniquement',
  steps: [{ plannedPeriod: '0', groups: [{ domain: 'Consultation', acts: 1 }] }],
};

const OTHER_SESSION: CarePathwayTemplate = {
  name: `QA-AUTRE-SESSION-${stamp}`,
  description: 'Créé depuis une autre session',
  targetSex: 'Tous les sexes',
  steps: [{ plannedPeriod: '0', groups: [{ domain: 'Vaccination', acts: 1 }] }],
};

const isoDate = (days = 0) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };

async function openTemplates(page: Page) {
  await new PortalPage(page).enterModule('Administration');
  const templates = new CarePathwayTemplatePage(page);
  await templates.open();
  return templates;
}

async function openPatientFile(page: Page, patient: DossierPatient) {
  await new PortalPage(page).enterModule('Dossier médical');
  await openDossier(page, patient);
}

/** Bouton (lien actif ou bouton grisé) d'un type de parcours dans la carte "Parcours de soins". */
const pathwayButton = (page: Page, name: string) =>
  page.locator('.pathway-actions .qa-btn').filter({ hasText: name });

/** Vérifie l'aperçu des étapes (écran de démarrage) : nombre d'étapes et actes de chacune. */
async function expectPreview(page: Page, selected: SelectedActs) {
  const steps = page.locator('ul.iq-timeline > li');
  await expect(steps).toHaveCount(selected.length);
  for (let i = 0; i < selected.length; i++) {
    for (const act of selected[i]) {
      await expect(steps.nth(i), `Étape ${i + 1} : acte "${act}"`).toContainText(act, { ignoreCase: true });
    }
  }
}

/** Démarre le parcours (date du jour + premier praticien) et vérifie le nombre d'étapes créées. */
async function startPathway(page: Page, stepCount: number) {
  const carePathway = new CarePathwayPage(page);
  await carePathway.fillStartForm(isoDate());
  await carePathway.start();
  await expect(page.getByRole('button', { name: /^Étape \d+$/ })).toHaveCount(stepCount);
}

test.describe('Module Dossier médical — Parcours de soins paramétrés', () => {
  test.describe.configure({ mode: 'serial' });
  let patient: DossierPatient;
  let allActs: SelectedActs = [];
  let combined: SelectedActs = [];

  let man: DossierPatient;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(DOSSIER_SETUP_TIMEOUT * 2);
    patient = await createDossierPatient(browser);
    man = await createDossierPatient(browser, 'HOMME');
  });

  test.beforeEach(async ({ portal }) => {
    await portal.goto();
  });

  test('Créer un parcours couvrant tous les actes de chaque type (4 étapes) et le démarrer', async ({ page }) => {
    const carePathway = new CarePathwayPage(page);

    await test.step('Paramétrer le modèle : 1 étape par type d\'acte, tous les actes', async () => {
      const templates = await openTemplates(page);
      allActs = await templates.create(ALL_ACTS);
      for (let i = 0; i < ACT_DOMAINS.length; i++) {
        expect(allActs[i].length, `Actes du type ${ACT_DOMAINS[i]}`).toBeGreaterThan(0);
      }
    });

    await test.step('Le parcours est proposé dans le dossier de la patiente', async () => {
      await openPatientFile(page, patient);
      await expect(carePathway.startLink(ALL_ACTS.name)).toHaveCount(1);
    });

    await test.step("Vérifier l'aperçu : 4 étapes et tous les actes", async () => {
      await carePathway.openStartForm(ALL_ACTS.name);
      await expect(page.getByText(ALL_ACTS.startDateLabel!).first(), 'Libellé de date de début paramétré').toBeVisible();
      await expectPreview(page, allActs);
    });

    await test.step('Démarrer le parcours : 4 étapes créées', async () => {
      await startPathway(page, 4);
    });
  });

  test('Créer un parcours combinant tous les types en une étape (femmes) et le démarrer', async ({ page }) => {
    const carePathway = new CarePathwayPage(page);

    await test.step('Paramétrer le modèle : 1 étape, 4 types d\'actes, tous les actes', async () => {
      const templates = await openTemplates(page);
      combined = await templates.create(COMBINED);
      expect(combined[0].length).toBe(allActs.flat().length);
    });

    await test.step('Proposé à la patiente, aperçu complet, démarrage', async () => {
      await openPatientFile(page, patient);
      await carePathway.openStartForm(COMBINED.name);
      await expectPreview(page, combined);
      await startPathway(page, 1);
    });
  });

  test("Un parcours réservé aux hommes n'est ni proposé ni grisé pour une patiente", async ({ page }) => {
    const carePathway = new CarePathwayPage(page);
    const templates = await openTemplates(page);
    await templates.create(MEN_ONLY);
    await openPatientFile(page, patient);
    await expect(page.getByRole('heading', { name: /Parcours de soins/ })).toBeVisible();
    await expect(carePathway.startLink(MEN_ONLY.name)).toHaveCount(0);
    // Sexe cible différent : le parcours est caché, pas seulement grisé
    await expect(pathwayButton(page, MEN_ONLY.name)).toHaveCount(0);
  });

  test('Un parcours en cours n\'est plus proposé au démarrage', async ({ page }) => {
    const carePathway = new CarePathwayPage(page);
    await openTemplates(page); // rafraîchit le cache des modèles dans ce navigateur
    await openPatientFile(page, patient);
    await expect(carePathway.startLink(ALL_ACTS.name)).toHaveCount(0);
    await expect(carePathway.startLink(COMBINED.name)).toHaveCount(0);
    // En cours : toujours affiché, mais grisé
    await expect(pathwayButton(page, ALL_ACTS.name)).toBeDisabled();
  });

  // ---------------- Patient homme : parcours selon le sexe cible du modèle ----------------
  test('La carte "Parcours de soins" est affichée pour un patient homme', async ({ page }) => {
    await openTemplates(page);
    await openPatientFile(page, man);
    await expect(page.getByRole('banner').getByText('HOMME', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Parcours de soins/ })).toBeVisible();
  });

  test('Un parcours réservé aux hommes est proposé à un patient homme (aperçu de démarrage)', async ({ page }) => {
    const carePathway = new CarePathwayPage(page);
    await openTemplates(page);
    await openPatientFile(page, man);
    await expect(carePathway.startLink(MEN_ONLY.name)).toHaveCount(1);
    await carePathway.openStartForm(MEN_ONLY.name);
    await expect(page.locator('ul.iq-timeline > li')).toHaveCount(1);
  });

  test("Un parcours réservé aux femmes n'est ni proposé ni grisé pour un patient homme", async ({ page }) => {
    const carePathway = new CarePathwayPage(page);
    await openTemplates(page);
    await openPatientFile(page, man);
    await expect(page.getByRole('heading', { name: /Parcours de soins/ })).toBeVisible();
    await expect(carePathway.startLink(COMBINED.name)).toHaveCount(0);
    await expect(pathwayButton(page, COMBINED.name)).toHaveCount(0);
  });

  test('Un parcours pour tous les sexes, en cours chez une patiente, reste proposé à un patient homme', async ({ page }) => {
    const carePathway = new CarePathwayPage(page);
    await openTemplates(page);
    await openPatientFile(page, man);
    await expect(carePathway.startLink(ALL_ACTS.name)).toHaveCount(1);
  });

  test('Modifier un parcours non utilisé : ajouter une étape et changer la description', async ({ page }) => {
    const templates = await openTemplates(page);
    await templates.openEdit(MEN_ONLY.name);
    const acts = await templates.addStepAndDescribe('Description modifiée QA', { plannedPeriod: '30', groups: [{ domain: 'Bilan', acts: 1 }] });
    expect(acts).toHaveLength(1);
    await templates.save();
    await expect(templates.row(MEN_ONLY.name)).toContainText('2 étape(s) configurée(s)');
    await expect(templates.row(MEN_ONLY.name)).toContainText('Description modifiée QA');
  });

  test("Un parcours utilisé est verrouillé : type et étapes figés", async ({ page }) => {
    // Un parcours patient retrouve son modèle par le type : type et étapes d'un modèle utilisé (en
    // cours ou archivé) ne sont plus modifiables ; description, sexe cible et libellé de date le restent.
    const templates = await openTemplates(page);
    await expect(templates.usage(ALL_ACTS.name), "Ligne d'utilisation").toContainText('Utilisé par 1 parcours (dont 1 en cours)');
    await expect(templates.usage(ALL_ACTS.name).locator('.ri-lock-line'), 'Cadenas affiché').toBeVisible();
    await templates.openEdit(ALL_ACTS.name);
    await expect(templates.modal.locator('.locked-notice'), 'Bandeau de verrouillage').toContainText(/utilisé par 1 parcours/);
    await expect(templates.modal.locator('[formcontrolname="careplanType"]'), 'Type figé').toBeDisabled();
    await expect(templates.modal.getByRole('button', { name: /Ajouter une étape/ }), "Pas d'ajout d'étape").toHaveCount(0);
    await expect(templates.modal.getByRole('button', { name: /Ajouter un type d'acte/ }), "Pas d'ajout de type d'acte").toHaveCount(0);
    await expect(templates.modal.locator('.btn-remove-step, .btn-remove-act-group'), 'Pas de suppression').toHaveCount(0);
    const acts = templates.modal.locator('ng-select[formcontrolname="acts"]');
    await expect(acts).toHaveCount(ACT_DOMAINS.length);
    for (let i = 0; i < ACT_DOMAINS.length; i++) {
      await expect(acts.nth(i), `Étape ${i + 1} : actes figés`).toHaveClass(/ng-select-disabled/);
    }
    await templates.modal.getByRole('button', { name: /Fermer/ }).click();
  });

  test("La description d'un parcours utilisé reste modifiable", async ({ page }) => {
    test.fail(true, "Anomalie : modifier seulement la description d'un modèle verrouillé (type et étapes inchangés) est refusé par le backend : 409 ACTIVE_CAREPLANS_LINKED, la modale reste ouverte.");
    const templates = await openTemplates(page);
    await templates.openEdit(ALL_ACTS.name);
    const description = `${ALL_ACTS.description} (modifiée)`;
    await templates.modal.locator('[formcontrolname="description"]').fill(description);
    await templates.save();
    await expect(templates.row(ALL_ACTS.name), 'Description enregistrée').toContainText(description);
    await expect(templates.row(ALL_ACTS.name), 'Étapes inchangées').toContainText(`${ALL_ACTS.steps.length} étape(s) configurée(s)`);
  });

  test("Enregistrer un parcours sans type ni description est refusé", async ({ page }) => {
    const templates = await openTemplates(page);
    await templates.section.getByRole('button', { name: /Nouveau type de parcours/ }).click();
    await expect(templates.modal).toBeVisible();
    // Le type est prérempli avec "PRENATAL" pour un nouveau modèle : on le vide.
    await templates.modal.locator('[formcontrolname="careplanType"]').fill('');
    await templates.modal.getByRole('button', { name: /Enregistrer/ }).click();
    await expect(templates.modal.getByText('Le type de parcours est obligatoire')).toBeVisible();
    await expect(templates.modal.getByText('La description est obligatoire')).toBeVisible();
    await expect(templates.modal, 'Le formulaire reste ouvert').toBeVisible();
    await templates.modal.getByRole('button', { name: /Fermer/ }).click();
  });

  test('Les consultations sans spécialité disponible ne sont pas proposées dans un parcours', async ({ page }) => {
    // Leur formulaire d'étape s'ouvrirait avec Spécialité et Type vides (non préremplissables)
    const blocked = ['Sage-Femme', 'Contrôle', 'Infirmière'];
    const templates = await openTemplates(page);
    await templates.section.getByRole('button', { name: /Nouveau type de parcours/ }).click();
    await expect(templates.modal).toBeVisible();
    const step = templates.modal.locator('.step-card').first();
    if (await step.locator('.act-group').count() === 0) await step.getByRole('button', { name: /Ajouter un type d'acte/ }).click();
    const group = step.locator('.act-group').first();
    await group.locator('ng-select[formcontrolname="domain"] .ng-select-container').click();
    await templates.modal.locator('.ng-dropdown-panel .ng-option').filter({ hasText: /^\s*Consultation\s*$/ }).first().click();

    const info = group.getByText(/Non proposées \(aucune spécialité disponible\)/);
    await expect(info, 'Message des consultations non proposées').toBeVisible();
    for (const name of blocked) await expect(info).toContainText(name);

    await group.locator('ng-select[formcontrolname="acts"] .ng-select-container').click();
    const options = templates.modal.locator('.ng-dropdown-panel .ng-option');
    await expect(options.first()).toBeVisible();
    const labels = (await options.allTextContents()).map(t => t.replace(/\s+/g, ' ').trim().toLowerCase());
    expect(labels.length, 'Consultations proposées').toBeGreaterThan(0);
    for (const name of blocked) expect(labels, `"${name}" non proposée`).not.toContain(name.toLowerCase());
    await group.locator('ng-select[formcontrolname="acts"] .ng-arrow-wrapper').click();
    await templates.modal.getByRole('button', { name: /Fermer/ }).click();
  });

  test('Un parcours créé depuis une autre session est proposé sans reconnexion', async ({ page, browser }) => {
    test.fail(true, "Anomalie : les modèles de parcours sont mis en cache dans le navigateur à la connexion (localStorage 'careplantemplates') ; une session déjà ouverte ne voit un nouveau parcours qu'après reconnexion.");
    const other = await browser.newContext({ baseURL: process.env.BASE_URL, storageState: ADMIN_STORAGE_STATE, viewport: null, ignoreHTTPSErrors: true });
    try {
      const otherPage = await other.newPage();
      await new PortalPage(otherPage).goto();
      await (await openTemplates(otherPage)).create(OTHER_SESSION);
    } finally {
      await other.close();
    }
    await openPatientFile(page, patient);
    await expect(new CarePathwayPage(page).startLink(OTHER_SESSION.name)).toHaveCount(1, { timeout: 5000 });
  });

  test("Un parcours en cours chez un patient ne peut être ni supprimé ni désactivé", async ({ page }) => {
    // Les modèles démarrés sur la patiente de test restent donc actifs en base (fin de parcours =
    // formulaire obstétrical).
    const templates = await openTemplates(page);
    for (const template of [ALL_ACTS, COMBINED]) {
      await expect(templates.deleteButton(template.name), `${template.name} : pas de suppression`).toHaveCount(0);
      const deactivate = templates.deactivateButton(template.name);
      await expect(deactivate, `${template.name} : désactivation grisée`).toBeDisabled();
      await expect(deactivate).toHaveAttribute('title', /archivez-les avant de désactiver/);
      await expect(templates.status(template.name)).toHaveText('Actif');
    }
  });

  test("La suppression d'un parcours non utilisé confirme le succès et met à jour la liste", async ({ page }) => {
    // Modèle jamais démarré : seul cas où la suppression est proposée ; elle est définitive (absent
    // des actifs comme des désactivés).
    const templates = await openTemplates(page);
    await expect(templates.usage(MEN_ONLY.name)).toHaveText(/^\s*Jamais utilisé\s*$/);
    await expect(templates.deactivateButton(MEN_ONLY.name), 'Désactivation possible').toBeEnabled();
    await templates.deleteButton(MEN_ONLY.name).click();
    const warning = page.locator('.warning-modal-card');
    await expect(warning, 'Avertissement de suppression définitive').toContainText(/supprimer définitivement/);
    await warning.getByRole('button', { name: /^Fermer$/ }).click();
    await expect(warning).toBeHidden();
    await expect(templates.row(MEN_ONLY.name), 'Annulation : modèle conservé').toHaveCount(1);
    await templates.remove(MEN_ONLY.name);
    await templates.filterStatus('Tous');
    await expect(templates.row(MEN_ONLY.name), 'Supprimé définitivement (pas désactivé)').toHaveCount(0);
  });

  test('Supprimer les parcours non utilisés', async ({ page }) => {
    const templates = await openTemplates(page);
    for (const template of [MEN_ONLY, OTHER_SESSION]) {
      if (await templates.row(template.name).count() > 0) {
        await test.step(`Supprimer ${template.name}`, async () => templates.remove(template.name));
      }
    }
    // Modèles QA jamais démarrés (donc supprimables) laissés par une exécution précédente interrompue
    const leftovers = templates.section.locator('.cpt-row')
      .filter({ has: page.locator('button.cpt-btn--danger') })
      .locator('.cpt-row-title')
      .filter({ hasText: /^\s*QA-(HOMMES|AUTRE-SESSION)-\d{6}/ });
    for (const title of await leftovers.allTextContents()) {
      const name = title.trim().split(/\s+/)[0];
      await test.step(`Supprimer le reliquat ${name}`, async () => templates.remove(name));
    }
  });
});

// ======================================================================
// Parcours prédéfinis (vaccinal) et archives : patiente dédiée. Le cas d'exception passe avant le
// démarrage, car un parcours en cours désactive son bouton de démarrage sur le dashboard.
// ======================================================================
test.describe('Module Dossier médical — Parcours vaccinal et archives', () => {
  test.describe.configure({ mode: 'serial' });
  let patient: DossierPatient;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(DOSSIER_SETUP_TIMEOUT);
    patient = await createDossierPatient(browser);
  });

  test.beforeEach(async ({ portal, page }) => {
    await portal.goto();
    await openPatientFile(page, patient);
  });

  test('Démarrer un parcours vaccinal sans date ni praticien est refusé', async ({ page }) => {
    const carePathway = new CarePathwayPage(page);
    await carePathway.openStartForm('VACCINAL');
    await page.locator('#startDate').fill('');
    await carePathway.startButton.click();
    // Date de début : message "<libellé de la date> est obligatoire" (libellé paramétrable)
    await expect(page.locator('.invalid-feedback').filter({ hasText: /est obligatoire/ }).first()).toBeVisible();
    // Libellé de l'application : "Le patricien est obligatoire" (sic)
    await expect(page.getByText(/Le pa(t)?ricien est obligatoire|Le praticien est obligatoire/)).toBeVisible();
    await expect(page).toHaveURL(/\/patient\/create-careplan\//);
  });

  test('Démarrer un parcours vaccinal', async ({ page }) => {
    const carePathway = new CarePathwayPage(page);
    await carePathway.openStartForm('VACCINAL');
    await carePathway.fillStartForm(new Date().toISOString().split('T')[0]);
    await carePathway.start();
  });

  test('Le parcours vaccinal en cours est affiché et ne peut plus être redémarré', async ({ page }) => {
    await expect(page.getByRole('link', { name: /VACCINAL\s*Voir le parcours/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /VACCINAL/ }).first()).toBeDisabled();
  });

  test('Consulter les archives des parcours de soins', async ({ page }) => {
    await new CarePathwayPage(page).openArchivesFromDashboard();
    for (const column of ['Type', 'Médecin', 'Date enregistrement', 'État', 'Date clôture', 'Actions']) {
      await expect(page.getByRole('columnheader', { name: column, exact: true })).toBeVisible();
    }
  });
});
