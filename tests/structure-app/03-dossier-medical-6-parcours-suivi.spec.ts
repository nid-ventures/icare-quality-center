import { type Page, type Locator } from '@playwright/test';
import { test, expect } from '../../fixtures/structure.fixture';
import { createDossierPatient, openDossier, DOSSIER_SETUP_TIMEOUT, type DossierPatient } from '../../fixtures/dossier-patient';
import { PortalPage } from '../../pages/structure/portal/portal.page';
import { CarePathwayPage } from '../../pages/structure/patient/care-pathway.page';
import { CarePathwayTemplatePage, ACT_DOMAINS, type CarePathwayTemplate, type SelectedActs } from '../../pages/structure/my-space/care-pathway-template.page';
import { ConsultationFormPage } from '../../pages/structure/consultation/consultation-form.page';
import { PrescriptionManagerPage } from '../../pages/structure/consultation/prescription-manager.page';
import { fillAllFields, keptFieldsDiff, type FieldSnapshot } from '../../pages/structure/shared/fill-all-fields';
import { isoDate } from '../../test-data/consultation-fields';

test.setTimeout(300000);

// Suivi complet d'un parcours de soins, sur 3 parcours paramétrés par les tests, un par sexe cible.
// Chaque parcours a 2 étapes contenant chacune les 4 types d'actes (consultation, échographie,
// vaccination, bilan). Ils sont démarrés sur une patiente et un patient dédiés.
// SUIVI_STAMP=<6 chiffres> (usage exceptionnel) : réutilise les 3 parcours QA-SUIVI-*-<stamp> déjà
// paramétrés par un passage précédent, pour éviter leur paramétrage (≈ 15 min en visuel).
const REUSED_STAMP = process.env.SUIVI_STAMP;
const stamp = REUSED_STAMP || Date.now().toString().slice(-6);
// SUIVI_WOMAN / SUIVI_MAN=<identifiant> (avec SUIVI_STAMP) : réutilise la patiente et le patient de ce
// passage, dont les parcours sont déjà démarrés (les tests de démarrage sont alors sautés).
const REUSED_PATIENTS = !!REUSED_STAMP && !!process.env.SUIVI_WOMAN && !!process.env.SUIVI_MAN;
// Consultations sans spécialité disponible : le paramétrage ne les propose pas (formulaire d'étape
// non préremplissable) et l'indique sous la liste des actes
const BLOCKED_CONSULTATIONS = ['Sage-Femme', 'Contrôle', 'Infirmière'];

// Chaque type d'acte choisi est associé à TOUS ses actes médicaux du catalogue
const allTypesStep = (plannedPeriod: string) => ({ plannedPeriod, groups: ACT_DOMAINS.map(domain => ({ domain, acts: 'all' as const })) });

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

/**
 * Ouvre le dashboard médical du patient, après avoir rafraîchi le cache des modèles de parcours
 * (localStorage, chargé à la connexion) en ouvrant leur page : sans cela, les parcours créés par
 * les tests ne sont ni proposés ni affichés dans ce navigateur (anomalie de cache connue).
 */
async function openPatientFile(page: Page, patient: DossierPatient) {
  await openTemplates(page);
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
/**
 * Affiche l'étape n. Les boutons d'étape portent aria-disabled="true" en dur (attribut fixe du
 * template, défaut d'accessibilité) : Playwright les juge désactivés alors qu'ils sont cliquables
 * pour l'utilisateur. On déclenche donc directement le clic.
 */
async function goToStep(page: Page, n: number) {
  const button = stepButton(page, n);
  await expect(button).toBeVisible();
  await button.dispatchEvent('click');
  await expect(activeStep(page)).toContainText(`Étape ${n}`);
}

/**
 * Bouton de la barre d'actions du parcours ("Modifier …", "Archiver …"). Le libellé prévu porte le
 * titre du parcours, mais ce titre vient du référentiel des parcours prédéfinis : il est vide pour
 * un parcours paramétré (bouton "Modifier" / "Archiver" seul).
 */
const pathwayAction = (page: Page, action: 'Modifier' | 'Archiver') =>
  page.locator('.pw-actions-bar').getByRole('button', { name: new RegExp(`^\\W*${action}\\b`) });

/** Contenu de l'étape affichée. */
const activeStep = (page: Page) => page.locator('.pw-tab-pane--active');

/** Ouvre la tuile de prestation `domain` de l'étape affichée ; renvoie son contenu (liste des actes). */
async function openDomain(page: Page, domain: RegExp): Promise<Locator> {
  const step = activeStep(page);
  const tile = step.locator('.quick-actions a.qa-btn').filter({ hasText: domain });
  await expect(tile, `Prestation ${domain}`).toBeVisible();
  await tile.click();
  const content = step.locator('.embed-block > div:not([hidden])');
  await expect(content.locator('.acc-item').first()).toBeVisible();
  return content;
}

/** Déplie l'acte n° i de la prestation ouverte ; renvoie son corps. */
async function expandAct(content: Locator, i: number): Promise<Locator> {
  const item = content.locator('.acc-item').nth(i);
  const body = item.locator('.acc-item-body');
  if (!(await body.isVisible().catch(() => false))) await item.locator('.acc-item-header').click();
  await expect(body).toBeVisible();
  return body;
}

/** Vérification d'un acte rouvert (corps déplié), renvoyée par sa réalisation. */
type Verify = (reopened: Locator) => Promise<void>;
type Realize = (body: Locator, title: string, reopen: () => Promise<Locator>) => Promise<Verify>;

/**
 * Les valeurs saisies sont-elles réaffichées à la réouverture ? Attend le chargement depuis le
 * serveur, puis signale tous les écarts (vérification non bloquante : tous les actes sont passés
 * en revue et le test échoue à la fin s'il y a eu des écarts).
 */
async function expectKept(root: Locator, expected: FieldSnapshot, what: string, ignore: string[] = []) {
  let diffs: string[] = [];
  await expect.poll(async () => (diffs = await keptFieldsDiff(root, expected, ignore)).length, { timeout: 20000 })
    .toBe(0).catch(() => {});
  expect.soft(diffs, `${what} : données réaffichées à la réouverture`).toEqual([]);
}

/**
 * Réalise un à un TOUS les actes de la prestation `domain` de l'étape `step` : `realize` remplit
 * et enregistre l'acte déplié ; on vérifie que l'acte porte un N° de bon, puis on le rouvre pour
 * contrôler que toutes les données saisies sont réaffichées. Un acte déjà réalisé (passage
 * précédent sur des patients réutilisés) est conservé tel quel.
 */
async function realizeAllActs(page: Page, patient: DossierPatient, pathway: string, step: number, domain: RegExp, realize: Realize) {
  await openPathway(page, patient, pathway);
  await goToStep(page, step);
  const content = await openDomain(page, domain);
  const total = await content.locator('.acc-item').count();
  expect(total, `Actes de la prestation ${domain}`).toBeGreaterThan(0);
  for (let i = 0; i < total; i++) {
    const current = await openDomain(page, domain);
    const item = current.locator('.acc-item').nth(i);
    const title = ((await item.locator('.acc-item-title').textContent()) ?? '').trim();
    await test.step(`Acte ${i + 1}/${total} : ${title}`, async () => {
      if (await item.locator('.acc-item-badge').count() > 0) return;
      const reopen = async () => expandAct(await openDomain(page, domain), i);
      // Un rafraîchissement de la liste des actes peut replier le formulaire en cours de saisie :
      // en cas d'échec, page rechargée et acte refait une fois (s'il n'a pas été enregistré entre-temps)
      let verify: Verify;
      try {
        verify = await realize(await expandAct(current, i), title, reopen);
      } catch (error) {
        await page.reload();
        await expect(page.locator('.pw-hero')).toBeVisible({ timeout: 20000 });
        await goToStep(page, step);
        const retry = (await openDomain(page, domain)).locator('.acc-item').nth(i);
        if (await retry.locator('.acc-item-badge').count() > 0) throw error;
        verify = await realize(await reopen(), title, reopen);
      }
      await expect(async () => {
        const again = await openDomain(page, domain);
        await expect(again.locator('.acc-item').nth(i).locator('.acc-item-badge'), `"${title}" réalisé (N° de bon)`)
          .toContainText('N°', { timeout: 3000 });
      }).toPass({ timeout: 30000 });
      await test.step(`Réouverture : données de "${title}" conservées`, async () => {
        // Rechargement complet : les données viennent bien du serveur, pas du formulaire en mémoire
        await page.reload();
        await expect(page.locator('.pw-hero')).toBeVisible({ timeout: 20000 });
        await goToStep(page, step);
        await verify(await reopen());
      });
      // Acte replié : un seul formulaire (et gestionnaire de prescriptions) déplié à la fois
      const done = (await openDomain(page, domain)).locator('.acc-item').nth(i);
      if (await done.locator('.acc-item-body').isVisible().catch(() => false)) await done.locator('.acc-item-header').click();
    });
  }
}

/** Consultation : tous les champs, une ordonnance, une prescription d'analyses et une d'imagerie. */
const realizeConsultation = (page: Page): Realize => async (body, title) => {
  await new ConsultationFormPage(page, body).activate('date');
  const filled = await fillAllFields(page, body, title);
  const prescriptions = new PrescriptionManagerPage(page, body);
  await prescriptions.addMedicationPrescription({
    title: `Ordonnance ${title}`, medicationName: 'Paracétamol', posologie: '1 cp matin et soir', recommandations: 'Hydratation QA',
  });
  await prescriptions.addLaboratoryPrescription(`Analyses ${title}`);
  await prescriptions.addImagingPrescription(`Imagerie ${title}`, isoDate());
  // Libellé selon le type de consultation : "Mettre à jour la consultation", "Mettre à jour"…
  await body.getByRole('button', { name: /^\W*(Mettre à jour( la consultation)?|Enregistrer la consultation)\s*$/ }).last().click();
  await confirm(page);
  await expect(success(page)).toBeVisible({ timeout: 20000 });
  return async reopened => {
    // L'application réécrit avec le résumé des prescriptions la description (et, pour une
    // consultation dentaire, la conclusion) : champs exclus de la comparaison
    const dental = await reopened.locator('app-consultation-tooth-edit').count() > 0;
    await expectKept(reopened, filled, title, dental ? ['description', 'conclusion'] : ['description']);
    const kept = new PrescriptionManagerPage(page, reopened);
    for (const kind of ['Ordonnance', 'Analyses', 'Imagerie'] as const) {
      await expect.soft(kept.panelCount(kind), `${title} : prescription "${kind}" conservée`).toHaveText(/\b1\b/, { timeout: 15000 });
    }
  };
};

/** Échographie : tous les champs (dont pièce jointe et fiches foetus pour une obstétricale). */
const realizeEchographie = (page: Page): Realize => async (body, title) => {
  await new ConsultationFormPage(page, body).activate('date');
  const filled = await fillAllFields(page, body, title);
  await body.locator('button.btn-success').last().click();
  await confirm(page);
  await expect(success(page)).toBeVisible({ timeout: 20000 });
  // Le terme est recalculé par l'application à partir de la DDR
  return async reopened => expectKept(reopened, filled, title, ['terme']);
};

/**
 * Vaccination : premier enregistrement = la vaccination (consultant, date, actes à facturer,
 * commentaire) et sa première dose (date, terme, dose, lot), tous les champs.
 */
const realizeVaccination = (page: Page): Realize => async (body, title) => {
  await body.getByRole('button', { name: /Nouvelle dose/ }).click();
  const dose = body.locator('app-vaccination-simple-item-static');
  await expect(dose).toBeVisible();
  const filled = await fillAllFields(page, dose, title);
  await dose.getByRole('button', { name: /Enregistrer la dose/ }).click();
  await confirm(page);
  await expect(success(page)).toBeVisible({ timeout: 20000 });
  return async reopened => {
    // Champs de la vaccination, réaffichés dans son formulaire (la date de vaccination y porte le nom "date")
    const vaccination: FieldSnapshot = {};
    for (const [key, name] of [['caregiverId#0', 'caregiverId#0'], ['vaccinationDate#0', 'date#0'], ['commentary#0', 'commentary#0'], ['billableActs#0', 'billableActs#0']]) {
      if (filled[key]) vaccination[name] = filled[key];
    }
    expect.soft(Object.keys(vaccination).length, `${title} : champs de la vaccination saisis au premier enregistrement`).toBeGreaterThan(0);
    await expectKept(reopened.locator('form').first(), vaccination, `${title} (vaccination)`);
    await expect.soft(reopened.locator('.card[id^="accordionItemV_"]'), `${title} : première dose listée`).not.toHaveCount(0, { timeout: 15000 });
  };
};

/** Bilan : création avec tous les champs, puis résultat complet (dates, pièce jointe, résultats). */
const realizeBilan = (page: Page): Realize => async (body, title, reopen) => {
  const create = body.locator('app-create-health-check');
  await expect(create, 'Formulaire de création du bilan').toBeVisible();
  await fillAllFields(page, create, title);
  await create.getByRole('button', { name: /^\W*Enregistrer\s*$/ }).click();
  await expect(success(page)).toBeVisible({ timeout: 20000 });

  const openResult = async (opened: () => Promise<Locator>) => {
    let care: Locator | undefined;
    await expect(async () => {
      care = (await opened()).locator('app-health-check-care');
      await expect(care).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 30000 });
    await care!.locator('a.nav-link', { hasText: 'Résultat' }).click();
    const result = care!.locator('[id^="result-content-"]');
    await expect(result).toBeVisible();
    return result;
  };
  const result = await openResult(reopen);
  // Les zones de résultat (une par analyse) sont créées désactivées à la fin du chargement des
  // analyses, éventuellement après "Activer le formulaire" : on (ré)active jusqu'à ce qu'elles
  // soient toutes modifiables, sinon elles restaient vides sans être signalées.
  const inputs = result.locator('textarea.result-input');
  await expect(inputs.first(), `${title} : une zone de résultat par analyse`).toBeVisible({ timeout: 30000 });
  const toggle = result.getByRole('button', { name: /Activer le formulaire|Verrouiller/ });
  await expect(async () => {
    if (await inputs.last().isDisabled()) await toggle.click();
    await expect(inputs.last()).toBeEnabled({ timeout: 3000 });
    await expect(result.locator('textarea[formcontrolname="diagnostic"]')).toBeEnabled({ timeout: 1000 });
  }).toPass({ timeout: 30000 });
  const filled = await fillAllFields(page, result, title);
  // Zones de résultat liées par formControlName="{{ analyse.id }}" : pas d'attribut formcontrolname
  // dans la page, fillAllFields ne les voit pas. Saisie explicite, chaque zone étant repérée par son
  // name (identifiant de l'analyse) -- l'ordre des lignes n'est pas stable d'un affichage à l'autre.
  const results: Record<string, string> = {};
  const count = await inputs.count();
  for (let k = 0; k < count; k++) {
    const id = (await inputs.nth(k).getAttribute('name')) ?? String(k);
    results[id] = `Résultat ${k + 1} de ${title} QA`;
    await inputs.nth(k).fill(results[id]);
    await expect(inputs.nth(k), `${title} : résultat de l'analyse ${k + 1}/${count} saisi`).toHaveValue(results[id]);
  }
  await result.locator('button.btn-submit').click();
  await confirm(page);
  await expect(success(page)).toBeVisible({ timeout: 20000 });
  return async reopened => {
    const kept = await openResult(async () => reopened);
    await expectKept(kept, filled, `${title} (résultat)`);
    await expect.soft(kept.locator('textarea.result-input'), `${title} : une zone de résultat par analyse`).toHaveCount(count);
    for (const [id, value] of Object.entries(results)) {
      await expect.soft(kept.locator(`textarea.result-input[name="${id}"]`), `${title} : résultat de l'analyse ${id} réaffiché`)
        .toHaveValue(value, { timeout: 15000 });
    }
  };
};

test.describe('Module Dossier médical — Suivi des parcours de soins (homme, femme, tous les sexes)', () => {
  test.describe.configure({ mode: 'serial' });
  let woman: DossierPatient;
  let man: DossierPatient;
  // Actes réellement associés à chaque étape de chaque parcours, au paramétrage
  const selectedActs: Record<string, SelectedActs> = {};

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(DOSSIER_SETUP_TIMEOUT * 2);
    if (REUSED_PATIENTS) {
      woman = { identifier: process.env.SUIVI_WOMAN!, firstName: '', lastName: '' };
      man = { identifier: process.env.SUIVI_MAN!, firstName: '', lastName: '' };
      return;
    }
    woman = await createDossierPatient(browser);
    man = await createDossierPatient(browser, 'HOMME');
  });

  test.beforeEach(async ({ portal }) => {
    await portal.goto();
  });

  // ---------------- Paramétrage et proposition selon le sexe ----------------
  test('Paramétrer 3 parcours (femmes, hommes, tous les sexes) avec tous les types d\'actes', async ({ page }) => {
    const templates = await openTemplates(page);
    if (REUSED_STAMP) {
      // Parcours réutilisés : on vérifie seulement qu'ils existent avec leurs 2 étapes
      for (const template of [FEMMES, HOMMES, TOUS]) {
        await expect(templates.row(template.name), `Parcours réutilisé ${template.name}`).toContainText('2 étape(s) configurée(s)');
      }
      return;
    }
    for (const template of [FEMMES, HOMMES, TOUS]) {
      await test.step(`Parcours ${template.name} (${template.targetSex})`, async () => {
        const acts = await templates.create(template);
        selectedActs[template.name] = acts;
        for (const [i, stepActs] of acts.entries()) {
          expect(stepActs.length, `Étape ${i + 1} : tous les actes des 4 types`).toBeGreaterThanOrEqual(ACT_DOMAINS.length);
          // Consultations sans spécialité disponible : non proposées dans le paramétrage
          for (const blocked of BLOCKED_CONSULTATIONS) {
            expect(stepActs.map(a => a.toLowerCase()), `Étape ${i + 1} : "${blocked}" non proposée`).not.toContain(blocked.toLowerCase());
          }
        }
      });
    }
  });

  test('La patiente voit les parcours femmes et tous les sexes, pas celui des hommes', async ({ page }) => {
    const carePathway = new CarePathwayPage(page);
    await openPatientFile(page, woman);
    for (const template of [FEMMES, TOUS]) {
      // Patients réutilisés : parcours déjà en cours, donc tuile grisée au lieu d'un lien de démarrage
      if (REUSED_PATIENTS) await expect(pathwayTile(page, template.name), `${template.name} affiché`).toHaveCount(1);
      else await expect(carePathway.startLink(template.name)).toHaveCount(1);
    }
    await expect(pathwayTile(page, HOMMES.name), 'Parcours hommes ni proposé ni grisé').toHaveCount(0);
  });

  test('Le patient voit les parcours hommes et tous les sexes, pas celui des femmes', async ({ page }) => {
    const carePathway = new CarePathwayPage(page);
    await openPatientFile(page, man);
    for (const template of [HOMMES, TOUS]) {
      if (REUSED_PATIENTS) await expect(pathwayTile(page, template.name), `${template.name} affiché`).toHaveCount(1);
      else await expect(carePathway.startLink(template.name)).toHaveCount(1);
    }
    await expect(pathwayTile(page, FEMMES.name), 'Parcours femmes ni proposé ni grisé').toHaveCount(0);
  });

  // ---------------- Démarrage ----------------
  test('Démarrer le parcours femmes et le parcours tous les sexes chez la patiente', async ({ page }) => {
    test.skip(REUSED_PATIENTS, 'Patients réutilisés : parcours déjà démarrés par un passage précédent');
    for (const template of [FEMMES, TOUS]) {
      await test.step(`Démarrer ${template.name}`, async () => {
        await openPatientFile(page, woman);
        await startPathway(page, template.name);
      });
    }
  });

  test('Démarrer le parcours hommes et le parcours tous les sexes chez le patient', async ({ page }) => {
    test.skip(REUSED_PATIENTS, 'Patients réutilisés : parcours déjà démarrés par un passage précédent');
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
      const expected = selectedActs[FEMMES.name]?.[i];
      if (!expected) {
        // Parcours réutilisé : actes paramétrés inconnus, au moins un par type
        expect(await planned.nth(i).locator('.pw-act-badge').count(), `Étape ${i + 1} : actes des 4 types`).toBeGreaterThanOrEqual(ACT_DOMAINS.length);
        continue;
      }
      await expect(planned.nth(i).locator('.pw-act-badge'), `Étape ${i + 1} : tous les actes paramétrés`).toHaveCount(expected.length);
      for (const act of expected) {
        await expect(planned.nth(i), `Étape ${i + 1} : acte "${act}"`).toContainText(act, { ignoreCase: true });
      }
    }
  });

  test('Naviguer entre les étapes', async ({ page }) => {
    await openPathway(page, woman, FEMMES.name);
    await expect(activeStep(page)).toContainText('Étape 1');
    await goToStep(page, 2);
    await expect(activeStep(page)).toContainText('Étape 2');
    await goToStep(page, 1);
    await expect(activeStep(page)).toContainText('Étape 1');
  });

  test("Chaque étape propose les 4 types de prestations", async ({ page }) => {
    await openPathway(page, woman, FEMMES.name);
    for (const n of [1, 2]) {
      await goToStep(page, n);
      await expect(activeStep(page).locator('.quick-actions a.qa-btn'), `Étape ${n}`).toHaveCount(ACT_DOMAINS.length);
    }
  });

  // Avant toute saisie : l'étape 2, prévue plus tard, est "à venir" et ne peut pas être clôturée.
  // (Ses formulaires restent saisissables : seule une étape clôturée ou un parcours archivé les verrouille.)
  test("Une étape à venir ne peut pas être clôturée", async ({ page }) => {
    await openPathway(page, woman, FEMMES.name);
    await goToStep(page, 2);
    const content = await openDomain(page, /Consultation/i);
    test.skip(await content.locator('.acc-item-badge').count() > 0, 'Patients réutilisés : des actes ont déjà été saisis dans cette étape');
    await expect(stepButton(page, 2)).toHaveClass(/pw-step-secondary/);
    await expect(activeStep(page).getByRole('button', { name: /Clôturer cette étape/ })).toHaveCount(0);
  });

  // ---------------- Réalisation de TOUS les actes de TOUTES les étapes, tous les champs ----------------
  // Chaque type d'acte du parcours porte tous les actes de son catalogue : les tests les
  // réalisent tous, un par un, étape après étape (délai allongé en conséquence).
  for (const step of FEMMES.steps.map((_, i) => i + 1)) {
    test(`Étape ${step} : réaliser toutes les consultations (tous les champs + prescriptions)`, async ({ page }) => {
      test.setTimeout(3600000);
      await realizeAllActs(page, woman, FEMMES.name, step, /Consultation/i, realizeConsultation(page));
    });

    test(`Étape ${step} : réaliser toutes les échographies (tous les champs)`, async ({ page }) => {
      test.setTimeout(3600000);
      await realizeAllActs(page, woman, FEMMES.name, step, /chographie/i, realizeEchographie(page));
    });

    test(`Étape ${step} : réaliser toutes les vaccinations (première dose, tous les champs)`, async ({ page }) => {
      test.setTimeout(3600000);
      await realizeAllActs(page, woman, FEMMES.name, step, /Vaccination/i, realizeVaccination(page));
    });

    test(`Étape ${step} : réaliser tous les bilans (création et résultat, tous les champs)`, async ({ page }) => {
      test.setTimeout(3600000);
      await realizeAllActs(page, woman, FEMMES.name, step, /Bilan/i, realizeBilan(page));
    });
  }

  // ---------------- Clôture des étapes ----------------
  for (const step of FEMMES.steps.map((_, i) => i + 1)) {
    test(`Clôturer l'étape ${step} (tous les actes réalisés) : étape terminée`, async ({ page }) => {
      await openPathway(page, woman, FEMMES.name);
      await goToStep(page, step);
      const close = activeStep(page).getByRole('button', { name: /Clôturer cette étape/ });
      // Patients réutilisés : étape déjà clôturée par un passage précédent, on vérifie seulement son état
      if (!(REUSED_PATIENTS && await close.count() === 0)) {
        await close.click();
        await confirm(page);
        await expect(page.getByText(/clôture de cet étape a\s+reussi/i).first()).toBeVisible({ timeout: 20000 });
      }
      await expect(stepButton(page, step)).toHaveClass(/pw-step-success/, { timeout: 20000 });
      await expect(activeStep(page).getByRole('button', { name: /Clôturer cette étape/ })).toHaveCount(0);

      // Étape clôturée : plus aucun bouton de modification dans ses actes, quel que soit le type
      await page.reload();
      await expect(page.locator('.pw-hero')).toBeVisible({ timeout: 20000 });
      await goToStep(page, step);
      const editButtons = /^\W*(Activer|Activer le formulaire|Verrouiller|Mettre à jour.*|Enregistrer.*|Modifier la vaccination|Nouvelle dose)\s*$/;
      for (const domain of [/Consultation/i, /chographie/i, /Vaccination/i, /Bilan/i]) {
        const body = await expandAct(await openDomain(page, domain), 0);
        await page.waitForTimeout(2000); // chargement de l'acte depuis le serveur
        await expect.soft(body.getByRole('button', { name: editButtons }), `Étape ${step} ${domain} : aucun bouton de modification, étape clôturée`).toHaveCount(0);
      }
    });
  }

  test("Une étape sans acte réalisé reste en attente et ne peut pas être clôturée", async ({ page }) => {
    // Étape 1 du parcours tous les sexes de la patiente : aucun acte réalisé, étape "en attente"
    await openPathway(page, woman, TOUS.name);
    await expect(activeStep(page)).toContainText('Étape 1');
    const content = await openDomain(page, /Consultation/i);
    test.skip(await content.locator('.acc-item-badge').count() > 0, 'Patients réutilisés : un acte a déjà été réalisé dans cette étape');
    await expect(activeStep(page).getByRole('button', { name: /Clôturer cette étape/ })).toHaveCount(0);
  });

  test("Clôturer une étape commencée mais incomplète : étape incomplète", async ({ page }) => {
    test.setTimeout(1800000);
    // Étape 1 du parcours tous les sexes de la patiente : une seule consultation réalisée, puis clôture
    await openPathway(page, woman, TOUS.name);
    await expect(activeStep(page)).toContainText('Étape 1');
    const content = await openDomain(page, /Consultation/i);
    if (await content.locator('.acc-item').first().locator('.acc-item-badge').count() === 0) {
      const reopen = async () => expandAct(await openDomain(page, /Consultation/i), 0);
      await realizeConsultation(page)(await expandAct(content, 0), 'Consultation de l\'étape incomplète', reopen);
      await page.reload();
      await expect(page.locator('.pw-hero')).toBeVisible({ timeout: 20000 });
    }
    const close = activeStep(page).getByRole('button', { name: /Clôturer cette étape/ });
    // Patients réutilisés : étape déjà clôturée par un passage précédent, on vérifie seulement son état
    if (!(REUSED_PATIENTS && await close.count() === 0)) {
      await close.click();
      await confirm(page);
      await expect(page.getByText(/clôture de cet étape a\s+reussi/i).first()).toBeVisible({ timeout: 20000 });
    }
    await expect(stepButton(page, 1)).toHaveClass(/pw-step-warning/, { timeout: 20000 });
    await expect(activeStep(page).getByRole('button', { name: /Clôturer cette étape/ })).toHaveCount(0);
  });

  // ---------------- Résumé et modification ----------------
  test('Les boutons du parcours portent le nom du parcours', async ({ page }) => {
    test.fail(true, "Anomalie : les boutons \"Modifier …\", \"Archiver …\" et \"Voir les archives …\" affichent le titre du parcours lu dans le référentiel des parcours prédéfinis (careplantemplateTitle) : il est vide pour un parcours paramétré.");
    await openPathway(page, woman, FEMMES.name);
    await expect(pathwayAction(page, 'Modifier')).toContainText(FEMMES.name, { timeout: 5000 });
  });

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
    await pathwayAction(page, 'Modifier').click();
    const modal = page.locator('#bd-careplan');
    await expect(modal).toBeVisible();
    await new ConsultationFormPage(page, modal).fill([
      { name: 'startDate', kind: 'date', value: isoDate(-1) },
      { name: 'caregiverId', kind: 'select', index: 1 },
    ]);
    await modal.getByRole('button', { name: /^\W*Enregistrer\s*$/ }).click();
    await confirm(page);
    await expect(page.getByText(/modification de ce parcours .* a réussi/i).first()).toBeVisible({ timeout: 20000 });
  });

  // ---------------- Archivage ----------------
  test("Archiver sans renseigner l'année ni le sexe de l'enfant est refusé", async ({ page }) => {
    await openPathway(page, woman, FEMMES.name);
    await pathwayAction(page, 'Archiver').click();
    const modal = page.locator('#obstetrical');
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: /^\W*Enregistrer\s*$/ }).click();
    await expect(modal.getByText("L'année est obligatoire")).toBeVisible();
    await expect(modal.getByText("Le sexe de l'enfant 1 est obligatoire")).toBeVisible();
    await expect(modal.getByText('Veuillez remplir tous les champs obligatoires')).toBeVisible();
    await expect(page).toHaveURL(/patient-care-pathway-detail/);
  });

  test("Archiver un parcours non prénatal ne demande pas d'antécédent obstétrical", async ({ page }) => {
    test.fail(true, "Anomalie : l'archivage de tout parcours (vaccinal, pédiatrique, parcours d'un homme…) ouvre le formulaire d'issue de grossesse et crée un antécédent obstétrical (care-pathways-step openModalArchive / openModalAntecedentObstetrical).");
    await openPathway(page, man, HOMMES.name);
    await pathwayAction(page, 'Archiver').click();
    const modal = page.locator('#obstetrical');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Issue de la grossesse'), 'Pas de question de grossesse').toHaveCount(0, { timeout: 3000 });
  });

  test('Archiver le parcours de la patiente avec tous les champs', async ({ page }) => {
    await openPathway(page, woman, FEMMES.name);
    await pathwayAction(page, 'Archiver').click();
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
    await modal.getByRole('button', { name: /^\W*Enregistrer\s*$/ }).click();
    await expect(page.getByText(/archivage a reussie/i).first()).toBeVisible({ timeout: 20000 });
    await page.waitForURL('**/patient/patient-care-pathway-list/**');
  });

  test('Le parcours archivé est listé dans les archives et consultable en lecture seule', async ({ page }) => {
    const carePathway = new CarePathwayPage(page);
    await openPatientFile(page, woman);
    await carePathway.openArchivesFromDashboard();
    // Même design que les autres listes : section avec compteur, tableau data-table, bouton "Voir les détails"
    await expect(page.getByRole('heading', { name: /Liste des parcours archivés/ })).toBeVisible();
    const rows = page.locator('table.data-table tbody tr.row-clickable');
    await expect(rows.first()).toBeVisible();
    await expect(page.locator('.count-badge').first()).toHaveText(String(await rows.count()));
    const row = rows.filter({ hasText: FEMMES.name }).first();
    await expect(row, 'Parcours femmes archivé').toContainText('Archivé');
    await row.getByRole('button', { name: /Voir les détails/ }).click();
    await page.waitForURL('**/patient/patient-care-pathway-detail/**');
    await expect(page.locator('.pw-hero-status')).toHaveText(/Archivé/);
    await expect(page.getByRole('button', { name: /Clôturer cette étape/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Archiver/ })).toHaveCount(0);
  });

  test("Après archivage, le parcours femmes est de nouveau proposé à la patiente", async ({ page }) => {
    await openPatientFile(page, woman);
    // Tuile de démarrage de nouveau active (le bloc de suivi des parcours affiche aussi, une fois
    // le parcours archivé, un lien "Voir le parcours 0" qui mène au formulaire de démarrage)
    const tile = pathwayTile(page, FEMMES.name);
    await expect(tile).toHaveCount(1);
    await expect(tile).toBeEnabled();
    await expect(tile).toHaveAttribute('href', /\/patient\/create-careplan\//);
  });

  // ---------------- Parcours du patient homme ----------------
  for (const step of HOMMES.steps.map((_, i) => i + 1)) {
    test(`Patient homme : réaliser toutes les consultations de l'étape ${step} du parcours hommes (avec prescriptions)`, async ({ page }) => {
      test.setTimeout(3600000);
      await realizeAllActs(page, man, HOMMES.name, step, /Consultation/i, realizeConsultation(page));
    });
  }

  // ---------------- Nettoyage : archivage des parcours restants puis suppression des modèles ----------------
  test('Archiver les parcours restants', async ({ page }) => {
    test.setTimeout(600000);
    for (const [patient, template] of [[woman, TOUS], [man, HOMMES], [man, TOUS]] as const) {
      await test.step(`Archiver ${template.name}`, async () => {
        await openPatientFile(page, patient);
        // Patients réutilisés : parcours déjà archivé par un passage précédent (tuile de démarrage de nouveau active)
        if (REUSED_PATIENTS && await pathwayTile(page, template.name).first().isEnabled().catch(() => false)) return;
        await openPathway(page, patient, template.name);
        await pathwayAction(page, 'Archiver').click();
        const modal = page.locator('#obstetrical');
        await expect(modal).toBeVisible();
        await new ConsultationFormPage(page, modal).fill([
          { name: 'annee', kind: 'number', value: String(new Date().getFullYear()) },
          { name: 'sexe', kind: 'select' },
        ]);
        await modal.getByRole('button', { name: /^\W*Enregistrer\s*$/ }).click();
        await page.waitForURL('**/patient/patient-care-pathway-list/**', { timeout: 30000 });
      });
    }
  });

  test('Un modèle dont tous les parcours sont archivés peut être supprimé', async ({ page }) => {
    test.fail(true, "Anomalie : la suppression d'un modèle est refusée (409, \"N parcours de soin actif(s) … déjà engagé(s)\") alors que tous ses parcours sont archivés : les parcours archivés sont comptés comme actifs, un modèle ayant servi ne peut jamais être supprimé.");
    const templates = await openTemplates(page);
    for (const template of [FEMMES, HOMMES, TOUS]) {
      await test.step(`Supprimer le modèle ${template.name}`, async () => templates.remove(template.name));
    }
  });
});
