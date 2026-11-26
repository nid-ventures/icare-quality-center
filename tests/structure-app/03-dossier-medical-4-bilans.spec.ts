import { readFileSync } from 'fs';
import { type Page, type Locator } from '@playwright/test';
import { test, expect } from '../../fixtures/structure.fixture';
import { clearPrefilledConsultant } from '../../pages/structure/shared/consultant';
import { createDossierPatient, openDossier, DOSSIER_SETUP_TIMEOUT, type DossierPatient } from '../../fixtures/dossier-patient';
import { DossierSearchPage } from '../../pages/structure/patient/dossier-search.page';
import { HealthChecksListPage, HealthCheckDetailPage } from '../../pages/structure/analyse/health-check.page';
import { ConsultationFormPage, type FieldSpec, type FilledValues } from '../../pages/structure/consultation/consultation-form.page';
import { isoDate } from '../../test-data/consultation-fields';

test.setTimeout(300000);

/** Pièce jointe du résultat (PDF minimal généré en mémoire). */
const ATTACHMENT = { name: 'resultat-bilan-qa.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%QA iCare\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n') };

// Champs généraux de l'onglet "Résultat" (les résultats par analyse sont saisis à part)
const resultFields = (): FieldSpec[] => [
  { name: 'caregiverId', kind: 'select', index: 1 },
  { name: 'date_analysis_performed', kind: 'date', value: isoDate(-3) },
  { name: 'date_result_analysis', kind: 'date', value: isoDate(-1) },
  { name: 'date_result_analysis_provided', kind: 'date', value: isoDate(0) },
  { name: 'billableActs', kind: 'multiselect', count: 1 },
  { name: 'diagnostic', kind: 'textarea', value: 'Diagnostic du résultat : anémie modérée QA' },
];

const confirm = async (page: Page) => {
  const button = page.getByRole('button', { name: /^\W*Confirmer$/ }).last();
  await expect(button).toBeVisible({ timeout: 10000 });
  await button.click();
  await expect(button).toBeHidden({ timeout: 30000 });
};

/**
 * Zone de résultat d'une analyse dans l'onglet Résultat, retrouvée par le nom de l'analyse :
 * l'ordre des lignes n'est pas stable d'un affichage à l'autre.
 */
async function resultInput(pane: Locator, analyse: string): Promise<Locator> {
  const rows = pane.locator('table.analyses-table tbody tr');
  const wanted = analyse.replace(/\s+/g, ' ').trim().toUpperCase();
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const label = ((await rows.nth(i).locator('td.analyse-type').textContent()) ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
    if (label === wanted) return rows.nth(i).locator('textarea.result-input');
  }
  throw new Error(`Ligne de résultat de l'analyse "${analyse}" introuvable`);
}

/** Libellés des valeurs choisies d'un ng-select multiple. */
const chosenLabels = async (select: Locator) =>
  (await select.locator('.ng-value-label').allTextContents()).map(t => t.replace(/\s+/g, ' ').trim()).filter(Boolean);

/** Ligne du bulletin d'analyses : analyse, prescripteur, date de création (en majuscules pour comparer). */
type BulletinRow = { analyse: string; prescripteur: string; date: string };
const sortRows = (rows: BulletinRow[]) =>
  [...rows].sort((a, b) => a.analyse.localeCompare(b.analyse) || a.prescripteur.localeCompare(b.prescripteur));
/** Date du jour comme l'affiche le bulletin (dd/MM/yyyy, en UTC). */
const today = () => { const [y, m, d] = new Date().toISOString().slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
const row = (analyse: string, prescripteur: string): BulletinRow =>
  ({ analyse: analyse.replace(/\s+/g, ' ').trim().toUpperCase(), prescripteur: prescripteur.replace(/\s+/g, ' ').trim().toUpperCase(), date: today() });

/** Lignes du bulletin d'analyses affiché, triées. */
async function bulletinRows(page: Page): Promise<BulletinRow[]> {
  const cells = await page.locator('.analyses-modern table.table-modern tbody tr.table-row').evaluateAll(trs =>
    trs.map(tr => [...tr.querySelectorAll('td')].slice(0, 3).map(td => (td.textContent ?? '').replace(/\s+/g, ' ').trim())));
  return sortRows(cells.map(([analyse, prescripteur, date]) => ({ analyse: analyse.toUpperCase(), prescripteur: prescripteur.toUpperCase(), date })));
}

/** Le bulletin liste exactement ces analyses, chacune avec son prescripteur et sa date de création. */
async function expectBulletin(page: Page, expected: BulletinRow[]) {
  await expect.poll(() => bulletinRows(page), { timeout: 20000, message: "Bulletin d'analyses (analyse, prescripteur, date)" })
    .toEqual(sortRows(expected));
}

// Champs de la création du bilan relus dans l'onglet Résultat (prescripteur, actes à facturer, diagnostic)
const creationFields: FieldSpec[] = [
  { name: 'caregiverId', kind: 'select' },
  { name: 'billableActs', kind: 'multiselect' },
  { name: 'diagnostic', kind: 'textarea', value: '' },
];

test.describe("Module Dossier médical — Bilans d'analyses", () => {
  test.describe.configure({ mode: 'serial' });
  let patient: DossierPatient;
  // Premier bilan créé : sert au résultat, au bulletin, aux analyses et à la suppression
  let bilanUrl = '';
  let bilanOrder = '';
  let bilanAnalyses: string[] = [];
  let results: FilledValues = {};
  let resultTexts: Record<string, string> = {};
  // Saisie de la création du bilan de référence et bulletin attendu (mis à jour à chaque ajout / retrait)
  let created: FilledValues = {};
  /** Clé de résultat retrouvée par nom d'analyse, quelle que soit la casse (le bulletin l'affiche en majuscules). */
  const key = (analyse: string) =>
    Object.keys(resultTexts).find(k => k.replace(/\s+/g, ' ').trim().toUpperCase() === analyse.replace(/\s+/g, ' ').trim().toUpperCase()) ?? analyse;
  let bulletin: BulletinRow[] = [];
  /** Résultat attendu : champs saisis, actes à facturer de la création + celui ajouté au résultat. */
  const afterResult = (): FilledValues => ({ ...results, billableActs: [...(created.billableActs as string[]), ...(results.billableActs as string[])] });

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(DOSSIER_SETUP_TIMEOUT);
    patient = await createDossierPatient(browser);
  });

  test.beforeEach(async ({ portal, page }) => {
    await portal.enterModule('Dossier médical');
    await new DossierSearchPage(page).expectLoaded();
    await openDossier(page, patient);
    await new HealthChecksListPage(page).goToHealthChecksList();
  });

  const modal = (page: Page) => page.locator('#createBilanModal');

  /** Attend le N° du bilan qui vient d'apparaître dans la liste (rafraîchie après fermeture). */
  async function newOrderNumber(list: HealthChecksListPage, before: string[]): Promise<string> {
    let order: string | undefined;
    await expect(async () => {
      order = (await list.getBilanOrderNumbers()).find(o => o && !before.includes(o));
      expect(order, 'Le nouveau N° de bulletin doit apparaître dans la liste').toBeTruthy();
    }).toPass({ timeout: 30000 });
    return order!;
  }

  /**
   * Non-régression (bug backend corrigé le 2026-11-19 : mettre à jour un bilan vidait ses analyses
   * en base) : après rechargement, le bulletin liste toujours chacune des analyses du bilan.
   */
  async function expectAnalysesKept(page: Page) {
    await new HealthCheckDetailPage(page).expectDetailLoaded();
    await expectBulletin(page, bulletin);
  }

  /** Résultat de chaque analyse du bulletin : le texte saisi, vide pour une analyse sans résultat. */
  async function expectResultTexts(pane: Locator) {
    await expect(pane.locator('textarea.result-input'), 'Une zone de résultat par analyse').toHaveCount(bulletin.length, { timeout: 15000 });
    for (const { analyse } of bulletin) {
      await expect(await resultInput(pane, analyse), `Résultat de "${analyse}"`).toHaveValue(resultTexts[key(analyse)] ?? '');
    }
  }

  /** Relevé complet du bilan : bulletin + tous les champs du résultat (y compris le résultat de chaque analyse). */
  async function bilanSnapshot(page: Page) {
    await new HealthCheckDetailPage(page).expectDetailLoaded();
    const rows = await bulletinRows(page);
    const pane = await openResultTab(page);
    return { rows, result: await new ConsultationFormPage(page, pane).snapshot(), attachment: await pane.getByText('Modifier la pièce jointe').count() };
  }

  /** Ouvre l'onglet "Résultat" du bilan et renvoie son panneau. */
  async function openResultTab(page: Page): Promise<Locator> {
    await page.getByRole('tab', { name: /Résultat/ }).or(page.locator('a.nav-link', { hasText: 'Résultat' })).first().click();
    const pane = page.locator('[id^="result-content-"]');
    await expect(pane).toBeVisible();
    // Résultat chargé : le bouton affiche « Chargement… » tant que les données arrivent (lues trop tôt,
    // elles seraient vides)
    await expect(pane.locator('.btn-action-activate'), 'Résultat chargé').not.toHaveText(/Chargement/, { timeout: 20000 });
    return pane;
  }

  /** Bascule le formulaire de résultat en édition ("Activer le formulaire"). */
  async function activateResult(page: Page, pane: Locator) {
    const toggle = pane.locator('.btn-action-activate');
    const probe = pane.locator('textarea[formcontrolname="diagnostic"]');
    await expect(async () => {
      if (!/Verrouiller/.test(await toggle.innerText())) await toggle.click();
      // Bouton "Verrouiller" mais champs reverrouillés par le chargement : verrouiller puis réactiver
      else if (!(await probe.isEnabled())) { await toggle.click(); await toggle.click(); }
      await expect(probe).toBeEnabled({ timeout: 3000 });
      // Le chargement tardif du résultat peut reverrouiller le formulaire : il doit rester modifiable
      await page.waitForTimeout(1000);
      await expect(probe).toBeEnabled({ timeout: 500 });
    }).toPass({ timeout: 30000 });
  }

  // ======================================================================
  // Création : un bilan par type proposé
  // ======================================================================
  test('Créer un bilan pour chaque type : analyses et actes à facturer présélectionnés', async ({ page }) => {
    test.setTimeout(900000);
    const list = new HealthChecksListPage(page);
    const detail = new HealthCheckDetailPage(page);
    const typeSelect = modal(page).locator('ng-select[formcontrolname="type"]');

    let types: string[] = [];
    const preselected: Record<string, { analyses: number; acts: number }> = {};
    await test.step('Lire les types de bilan proposés', async () => {
      await list.openNewBilanModal();
      await typeSelect.locator('.ng-select-container').click();
      const options = page.locator('.ng-dropdown-panel .ng-option:not(.ng-option-disabled)');
      await expect(options.first()).toBeVisible();
      types = (await options.allTextContents()).map(t => t.replace(/\s+/g, ' ').trim());
      // Liste refermée par sa flèche : Échap fermerait aussi la fenêtre "Ajouter Bilan"
      await typeSelect.locator('.ng-arrow-wrapper').click();
      await expect(options.first()).toBeHidden();
      await modal(page).getByRole('button', { name: /Annuler/ }).click();
      await expect(modal(page)).toBeHidden();
      expect(types.length, 'Types de bilan paramétrés').toBeGreaterThan(0);
    });

    for (const [index, type] of types.entries()) {
      await test.step(`Bilan "${type}"`, async () => {
        const before = await list.getBilanOrderNumbers();
        await list.openNewBilanModal();
        const form = new ConsultationFormPage(page, modal(page));
        const chosen = await form.fill([{ name: 'caregiverId', kind: 'select' }, { name: 'type', kind: 'select', index }]);

        // Le choix du type présélectionne les analyses rattachées à ce type dans le paramétrage
        // (aucune pour un type sans analyse rattachée, ex. "BILAN standard") et leurs actes à facturer
        const analyses = await chosenLabels(modal(page).locator('ng-select[formcontrolname="analyses"]'));
        const acts = await chosenLabels(modal(page).locator('ng-select[formcontrolname="billableActs"]'));
        preselected[type] = { analyses: analyses.length, acts: acts.length };
        // Règle métier : le bilan standard n'a aucune analyse rattachée (choix manuel)
        if (/standard/i.test(type)) {
          expect.soft(analyses, `Aucune analyse présélectionnée pour "${type}"`).toHaveLength(0);
        }

        const diagnostic = `Bilan ${type} QA`;
        await form.fill([{ name: 'diagnostic', kind: 'textarea', value: diagnostic }]);
        await list.saveBilan();
        const order = await newOrderNumber(list, before);

        await list.openBilanByOrderNumber(order);
        await detail.expectDetailLoaded();
        const info = page.locator('.healthcheck-info-panel');
        await expect(info).toContainText(order);
        await expect(info, 'Prescripteur du bilan').toContainText(chosen.caregiverId as string, { ignoreCase: true });
        // Le bulletin liste exactement les analyses présélectionnées, au nom du prescripteur, créées ce jour
        const rows = analyses.map(a => row(a, chosen.caregiverId as string));
        await expectBulletin(page, rows);
        // Bilan de référence pour la suite (résultat, bulletins, analyses) : le premier avec des analyses
        if (!bilanUrl && analyses.length > 0) {
          bilanUrl = page.url();
          bilanOrder = order;
          bilanAnalyses = analyses;
          bulletin = rows;
          created = { caregiverId: chosen.caregiverId, billableActs: acts, diagnostic };
        }
        await page.goBack();
        await expect(page.getByRole('heading', { name: /Liste des bilans d'analyses/ })).toBeVisible();
      });
    }

    await test.step('Au moins un type présélectionne des analyses et des actes à facturer', async () => {
      const withAnalyses = Object.entries(preselected).filter(([, c]) => c.analyses > 0);
      expect(withAnalyses.length, `Présélections par type : ${JSON.stringify(preselected)}`).toBeGreaterThan(0);
      for (const [type, c] of withAnalyses) {
        expect.soft(c.acts, `Actes à facturer présélectionnés pour "${type}"`).toBeGreaterThan(0);
      }
    });
  });

  test('Ajouter manuellement des analyses lors de la création', async ({ page }) => {
    const list = new HealthChecksListPage(page);
    const detail = new HealthCheckDetailPage(page);
    const before = await list.getBilanOrderNumbers();
    await list.openNewBilanModal();
    const form = new ConsultationFormPage(page, modal(page));
    await form.fill([{ name: 'caregiverId', kind: 'select' }, { name: 'type', kind: 'select' }]);
    const chosen = await form.fill([{ name: 'caregiverId', kind: 'select' }, { name: 'type', kind: 'select' }]);
    const preselected = await chosenLabels(modal(page).locator('ng-select[formcontrolname="analyses"]'));
    const added = await form.fill([{ name: 'analyses', kind: 'multiselect', count: 2 }]);
    // Diagnostic obligatoire depuis le 2026-11-18
    await form.fill([{ name: 'diagnostic', kind: 'textarea', value: 'Analyses ajoutées QA' }]);
    await list.saveBilan();
    await list.openBilanByOrderNumber(await newOrderNumber(list, before));
    await detail.expectDetailLoaded();
    // Exactement les analyses présélectionnées + celles ajoutées, aucune perdue ni en double
    await expectBulletin(page, [...preselected, ...(added.analyses as string[])].map(a => row(a, chosen.caregiverId as string)));
  });

  test('Rouvrir le bilan : prescripteur, diagnostic, actes à facturer et analyses de la création conservés', async ({ page }) => {
    await page.goto(bilanUrl);
    await expectAnalysesKept(page);
    await expect(page.locator('.healthcheck-info-panel'), 'Prescripteur du bilan').toContainText(created.caregiverId as string, { ignoreCase: true });
    const pane = await openResultTab(page);
    await new ConsultationFormPage(page, pane).expectValues(creationFields, created, { exact: true });
    // Aucun résultat saisi à la création
    resultTexts = {};
    await expectResultTexts(pane);
  });

  // ======================================================================
  // Résultat : tous les champs, pièce jointe, un résultat par analyse
  // ======================================================================
  test('Saisir le résultat du bilan : tous les champs, pièce jointe et résultat de chaque analyse', async ({ page }) => {
    await page.goto(bilanUrl);
    const pane = await openResultTab(page);
    await activateResult(page, pane);

    results = await new ConsultationFormPage(page, pane).fill(resultFields());
    await pane.locator('input[type="file"][formcontrolname="attached_file"]').setInputFiles(ATTACHMENT);

    const inputs = pane.locator('textarea.result-input');
    await expect(inputs, 'Une zone de résultat par analyse').toHaveCount(bilanAnalyses.length);
    resultTexts = {};
    for (const [i, analyse] of bilanAnalyses.entries()) {
      const text = `Résultat ${analyse} : valeur normale QA ${i + 1}`;
      await (await resultInput(pane, analyse)).fill(text);
      resultTexts[analyse] = text;
    }

    await pane.locator('button.btn-submit').click();
    await confirm(page);
    await expect(page.getByText(/enregistrement de ce\(s\) résultat\(s\) a réussi/).first()).toBeVisible({ timeout: 20000 });
  });

  test('Rouvrir le résultat : champs, résultats et pièce jointe conservés, analyses toujours au bulletin', async ({ page }) => {
    await page.goto(bilanUrl);
    await expectAnalysesKept(page);
    const pane = await openResultTab(page);
    // Actes à facturer : ceux de la création + celui ajouté au résultat, exactement
    await new ConsultationFormPage(page, pane).expectValues(resultFields(), afterResult(), { exact: true });
    await expectResultTexts(pane);
    await expect(pane.getByText('Modifier la pièce jointe')).toBeVisible();
  });

  test('Télécharger la pièce jointe du résultat : indisponible formulaire verrouillé, puis fichier identique à celui joint', async ({ page }) => {
    await page.goto(bilanUrl);
    const pane = await openResultTab(page);
    const download = pane.getByRole('button', { name: /Télécharger la pièce jointe/ });
    await test.step('Formulaire verrouillé : bouton de téléchargement désactivé', async () => {
      await expect(pane.locator('textarea[formcontrolname="diagnostic"]'), 'Formulaire verrouillé').toBeDisabled();
      await expect(download).toBeDisabled();
    });
    await test.step('Formulaire activé : le fichier téléchargé est celui joint au résultat', async () => {
      await activateResult(page, pane);
      await expect(download).toBeEnabled({ timeout: 15000 });
      const [file] = await Promise.all([
        page.waitForEvent('download', { timeout: 20000 }),
        download.click(),
      ]);
      expect(file.suggestedFilename()).toMatch(/\.pdf$/i);
      const content = readFileSync(await file.path());
      expect(content.equals(ATTACHMENT.buffer), 'Contenu identique au fichier joint').toBe(true);
    });
  });

  test('Modifier le résultat : nouveau diagnostic et résultat de la première analyse', async ({ page }) => {
    await page.goto(bilanUrl);
    const pane = await openResultTab(page);
    await activateResult(page, pane);
    const diagnostic = 'Diagnostic modifié QA';
    await pane.locator('textarea[formcontrolname="diagnostic"]').fill(diagnostic);
    const first = bilanAnalyses[0];
    resultTexts[first] = 'Résultat modifié QA';
    await (await resultInput(pane, first)).fill(resultTexts[first]);
    await pane.locator('button.btn-submit').click();
    await confirm(page);
    await expect(page.getByText(/enregistrement de ce\(s\) résultat\(s\) a réussi/).first()).toBeVisible({ timeout: 20000 });

    results = { ...results, diagnostic };

    await page.reload();
    await expectAnalysesKept(page);
    const reloaded = await openResultTab(page);
    // Diagnostic modifié, autres champs (prescripteur, dates, actes à facturer) inchangés
    await new ConsultationFormPage(page, reloaded).expectValues(resultFields(), afterResult(), { exact: true });
    // Résultat modifié pour la première analyse, inchangé pour les autres
    await expectResultTexts(reloaded);
    await expect(reloaded.getByText('Modifier la pièce jointe'), 'Pièce jointe conservée').toBeVisible();
  });

  test('Enregistrer le résultat sans rien modifier : aucune donnée ne change', async ({ page }) => {
    await page.goto(bilanUrl);
    const before = await bilanSnapshot(page);
    const pane = await openResultTab(page);
    await activateResult(page, pane);
    await pane.locator('button.btn-submit').click();
    await confirm(page);
    await expect(page.getByText(/enregistrement de ce\(s\) résultat\(s\) a réussi/).first()).toBeVisible({ timeout: 20000 });
    await page.reload();
    await expect.poll(() => bilanSnapshot(page), { timeout: 30000, message: 'Bilan inchangé' }).toEqual(before);
    await expectAnalysesKept(page);
  });

  test("Modifier le résultat puis verrouiller sans enregistrer : rien n'est enregistré", async ({ page }) => {
    await page.goto(bilanUrl);
    const before = await bilanSnapshot(page);
    const pane = await openResultTab(page);
    await activateResult(page, pane);
    await pane.locator('textarea[formcontrolname="diagnostic"]').fill('Diagnostic non enregistré QA');
    await (await resultInput(pane, bilanAnalyses[0])).fill('Résultat non enregistré QA');
    await pane.locator('.btn-action-activate').click();
    await expect(pane.locator('textarea[formcontrolname="diagnostic"]')).toBeDisabled();
    await page.reload();
    await expect.poll(() => bilanSnapshot(page), { timeout: 30000, message: 'Bilan inchangé' }).toEqual(before);
  });

  // ======================================================================
  // Bulletins PDF
  // ======================================================================
  test('Générer le bulletin du bilan (PDF)', async ({ page }) => {
    await page.goto(bilanUrl);
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.getByRole('button', { name: /Générer le bulletin/ }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^Bulletin_Analyses_.+_\d{4}-\d{2}-\d{2}\.pdf$/);
    await test.step('Le bulletin utilise la police de Paramètres › Configuration des documents', async () => {
      // Frontend 344f7eda : police lue dans le cache refdatahi (policy) ; Helvetica, Times et Courier
      // sont les polices de jsPDF, les autres (Poppins par défaut, Carlito, Lato) sont embarquées
      const policy = await page.evaluate(() => {
        try { return String(JSON.parse(localStorage.getItem('refdatahi') || 'null')?.policy ?? ''); } catch { return ''; }
      });
      const p = policy.trim().toLowerCase();
      const baseFont = p === 'times new roman' ? 'Times-Roman' : p === 'courier new' ? 'Courier'
        : p === 'helvetica' ? 'Helvetica' : p === 'carlito' ? 'Carlito' : p === 'lato' ? 'Lato' : 'Poppins';
      const pdf = readFileSync(await download.path()).toString('latin1');
      const fonts = [...new Set([...pdf.matchAll(/\/BaseFont\s*\/([^\s/>]+)/g)].map(m => m[1]))];
      expect(fonts, `Police « ${policy || 'par défaut'} » dans le PDF (polices : ${fonts.join(', ')})`)
        .toContainEqual(expect.stringMatching(new RegExp(`^([A-Z]{6}\\+)?${baseFont}`)));
    });
  });

  test('Imprimer le bulletin depuis la liste des bilans (PDF)', async ({ page }) => {
    const row = page.locator('table.data-table tbody tr').filter({ hasText: bilanOrder }).first();
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      row.getByRole('button', { name: /Imprimer/ }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^Bulletin_Analyses_.+\.pdf$/);
  });

  // ======================================================================
  // Bulletin d'analyses : ajout / retrait d'une analyse
  // ======================================================================
  test("Ajouter une analyse au bulletin : elle apparaît dans l'onglet Résultat", async ({ page }) => {
    await page.goto(bilanUrl);
    const detail = new HealthCheckDetailPage(page);
    await detail.expectDetailLoaded();
    await expectBulletin(page, bulletin);
    await detail.openAddAnalyseModal();
    const addModal = page.locator('#createAnalyseModal');
    const { caregiverId } = await new ConsultationFormPage(page, addModal).fill([{ name: 'caregiverId', kind: 'select' }]);
    // Une analyse absente du bulletin (le résultat de chaque analyse est repéré par son nom)
    const analyses = addModal.locator('ng-select[formcontrolname="analyses"]');
    await analyses.locator('.ng-select-container').click();
    const option = page.locator('.ng-dropdown-panel .ng-option:not(.ng-option-disabled)')
      .filter({ hasNotText: new RegExp(`^\\s*(${bulletin.map(r => r.analyse.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s*$`, 'i') }).first();
    await expect(option, 'Une analyse non encore au bulletin').toBeVisible();
    const analyse = ((await option.textContent()) ?? '').replace(/\s+/g, ' ').trim();
    await option.click();
    await addModal.getByRole('heading', { name: /Ajouter analyse/ }).click();
    await detail.saveAnalyse();

    // Ajoutée avec son consultant et la date du jour ; les autres analyses inchangées
    bulletin = [...bulletin, row(analyse, caregiverId as string)];
    await expectBulletin(page, bulletin);
    await test.step("Onglet Résultat : nouvelle zone vide, résultats des autres analyses inchangés", async () => {
      await expectResultTexts(await openResultTab(page));
    });
    await test.step('Après rechargement : bulletin, résultats et champs du résultat conservés', async () => {
      await page.reload();
      await expectAnalysesKept(page);
      const pane = await openResultTab(page);
      await expectResultTexts(pane);
      await new ConsultationFormPage(page, pane).expectValues(resultFields(), afterResult(), { exact: true });
    });
  });

  test("Retirer une analyse du bulletin", async ({ page }) => {
    await page.goto(bilanUrl);
    const detail = new HealthCheckDetailPage(page);
    await detail.expectDetailLoaded();
    await expectBulletin(page, bulletin);
    const removed = (await detail.deleteFirstAnalyse()).replace(/\s+/g, ' ').trim().toUpperCase();
    bulletin = bulletin.filter(r => r.analyse !== removed);
    delete resultTexts[key(removed)];
    // Seule l'analyse retirée disparaît, les autres gardent prescripteur et date
    await expectBulletin(page, bulletin);
    await test.step('Après rechargement : bulletin, résultats des autres analyses et champs du résultat conservés', async () => {
      await page.reload();
      await expectAnalysesKept(page);
      const pane = await openResultTab(page);
      await expectResultTexts(pane);
      await new ConsultationFormPage(page, pane).expectValues(resultFields(), afterResult(), { exact: true });
    });
  });

  // ======================================================================
  // Cas d'exception
  // ======================================================================
  test("Un bilan sans prescripteur ni type n'est pas enregistré", async ({ page }) => {
    const list = new HealthChecksListPage(page);
    const before = await list.getBilanOrderNumbers();
    await list.openNewBilanModal();
    // Prescripteur prérempli quand l'utilisateur connecté est soignant (selon la structure)
    await clearPrefilledConsultant(modal(page));
    await modal(page).getByRole('button', { name: /Enregistrer/ }).click();
    await expect(modal(page).getByText('Le prescripteur est obligatoire')).toBeVisible();
    await expect(modal(page).getByText('Le type de bilan est obligatoire')).toBeVisible();
    await expect(modal(page).getByText('Le diagnostic est obligatoire')).toBeVisible();
    await expect(modal(page), 'La fenêtre reste ouverte').toBeVisible();
    await modal(page).getByRole('button', { name: /Annuler/ }).click();
    expect(await list.getBilanOrderNumbers()).toEqual(before);
  });

  test("Un bilan avec type mais sans prescripteur n'est pas enregistré", async ({ page }) => {
    const list = new HealthChecksListPage(page);
    await list.openNewBilanModal();
    await new ConsultationFormPage(page, modal(page)).fill([{ name: 'type', kind: 'select' }]);
    await clearPrefilledConsultant(modal(page));
    await modal(page).getByRole('button', { name: /Enregistrer/ }).click();
    await expect(modal(page).getByText('Le prescripteur est obligatoire')).toBeVisible();
    await expect(modal(page).getByText('Le type de bilan est obligatoire')).toHaveCount(0);
    await expect(modal(page)).toBeVisible();
  });

  // Diagnostic obligatoire depuis le 2026-11-18 ; des espaces seuls ne comptent pas
  for (const [label, value] of [['vide', ''], ['fait d\'espaces', '   ']] as const) {
    test(`Un bilan au diagnostic ${label} n'est pas enregistré`, async ({ page }) => {
      const list = new HealthChecksListPage(page);
      const before = await list.getBilanOrderNumbers();
      await list.openNewBilanModal();
      await new ConsultationFormPage(page, modal(page)).fill([
        { name: 'caregiverId', kind: 'select' },
        { name: 'type', kind: 'select' },
        { name: 'diagnostic', kind: 'textarea', value },
      ]);
      await modal(page).getByRole('button', { name: /Enregistrer/ }).click();
      await expect(modal(page).getByText('Le diagnostic est obligatoire')).toBeVisible();
      await expect(modal(page).getByText('Le prescripteur est obligatoire')).toHaveCount(0);
      await expect(modal(page).getByText('Le type de bilan est obligatoire')).toHaveCount(0);
      await expect(modal(page), 'La fenêtre reste ouverte').toBeVisible();
      await modal(page).getByRole('button', { name: /Annuler/ }).click();
      expect(await list.getBilanOrderNumbers(), 'Aucun bilan créé').toEqual(before);
    });
  }

  test("Un résultat sans diagnostic n'est pas enregistré", async ({ page }) => {
    await page.goto(bilanUrl);
    const pane = await openResultTab(page);
    await activateResult(page, pane);
    const diagnostic = pane.locator('textarea[formcontrolname="diagnostic"]');
    const saved = await diagnostic.inputValue();
    await diagnostic.fill('  ');
    await pane.locator('button.btn-submit').click();
    await expect(pane.getByText('Le diagnostic est obligatoire')).toBeVisible();
    await expect(page.getByRole('button', { name: /^\W*Confirmer$/ }), 'Pas de confirmation d\'enregistrement').toHaveCount(0);
    await test.step('Le diagnostic enregistré est inchangé après rechargement', async () => {
      await page.reload();
      const reloaded = await openResultTab(page);
      await expect(reloaded.locator('textarea[formcontrolname="diagnostic"]')).toHaveValue(saved);
    });
  });

  test("Un résultat sans prescripteur n'est pas enregistré", async ({ page }) => {
    await page.goto(bilanUrl);
    const pane = await openResultTab(page);
    await activateResult(page, pane);
    const caregiver = pane.locator('ng-select[formcontrolname="caregiverId"]');
    await caregiver.hover();
    await caregiver.locator('.ng-clear-wrapper').click();
    await expect(caregiver.locator('.ng-value')).toHaveCount(0);
    await pane.locator('button.btn-submit').click();
    await expect(pane.getByText('Le prescripteur est obligatoire')).toBeVisible();
    await expect(page.getByRole('button', { name: /^\W*Confirmer$/ })).toHaveCount(0);
  });

  test("Le résultat est verrouillé tant que le formulaire n'est pas activé", async ({ page }) => {
    await page.goto(bilanUrl);
    const pane = await openResultTab(page);
    await expect(pane.locator('textarea[formcontrolname="diagnostic"]')).toBeDisabled();
    await expect(pane.locator('textarea.result-input').first()).toBeDisabled();
    await expect(pane.locator('button.btn-submit')).toBeDisabled();
  });

  // ======================================================================
  // Suppression
  // ======================================================================
  test('Supprimer le bilan ("Supprimer cette prestation")', async ({ page }) => {
    const list = new HealthChecksListPage(page);
    await page.goto(bilanUrl);
    await page.locator('.btn-action-delete', { hasText: 'Supprimer cette prestation' }).click();
    await confirm(page);
    await expect(page.getByText('La suppression du bilan a réussi').first()).toBeVisible({ timeout: 15000 });
    await page.waitForURL('**/health-check/health-checks/**');
    await expect(async () => {
      expect(await list.getBilanOrderNumbers()).not.toContain(bilanOrder);
    }).toPass({ timeout: 20000 });
  });
});
