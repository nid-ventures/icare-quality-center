import { type Page, type Locator } from '@playwright/test';
import { test, expect } from '../../fixtures/structure.fixture';
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

/** Libellés des valeurs choisies d'un ng-select multiple. */
const chosenLabels = async (select: Locator) =>
  (await select.locator('.ng-value-label').allTextContents()).map(t => t.replace(/\s+/g, ' ').trim()).filter(Boolean);

test.describe("Module Dossier médical — Bilans d'analyses", () => {
  test.describe.configure({ mode: 'serial' });
  let patient: DossierPatient;
  // Premier bilan créé : sert au résultat, au bulletin, aux analyses et à la suppression
  let bilanUrl = '';
  let bilanOrder = '';
  let bilanAnalyses: string[] = [];
  let results: FilledValues = {};
  let resultTexts: string[] = [];

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

  /** Ouvre l'onglet "Résultat" du bilan et renvoie son panneau. */
  async function openResultTab(page: Page): Promise<Locator> {
    await page.getByRole('tab', { name: /Résultat/ }).or(page.locator('a.nav-link', { hasText: 'Résultat' })).first().click();
    const pane = page.locator('[id^="result-content-"]');
    await expect(pane).toBeVisible();
    return pane;
  }

  /** Bascule le formulaire de résultat en édition ("Activer le formulaire"). */
  async function activateResult(page: Page, pane: Locator) {
    const toggle = pane.locator('.btn-action-activate');
    await expect(async () => {
      if (/Verrouiller/.test(await toggle.innerText())) return;
      await toggle.click();
      await expect(pane.locator('textarea[formcontrolname="diagnostic"]')).toBeEnabled({ timeout: 3000 });
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
        await form.fill([{ name: 'caregiverId', kind: 'select' }, { name: 'type', kind: 'select', index }]);

        // Le choix du type présélectionne ses analyses et les actes à facturer correspondants
        const analyses = await chosenLabels(modal(page).locator('ng-select[formcontrolname="analyses"]'));
        const acts = await chosenLabels(modal(page).locator('ng-select[formcontrolname="billableActs"]'));
        expect.soft(analyses.length, `Analyses présélectionnées pour "${type}"`).toBeGreaterThan(0);
        expect.soft(acts.length, `Actes à facturer présélectionnés pour "${type}"`).toBeGreaterThan(0);

        await form.fill([{ name: 'diagnostic', kind: 'textarea', value: `Bilan ${type} QA` }]);
        await list.saveBilan();
        const order = await newOrderNumber(list, before);

        await list.openBilanByOrderNumber(order);
        await detail.expectDetailLoaded();
        await expect(page.locator('.healthcheck-info-panel')).toContainText(order);
        // Le bulletin liste exactement les analyses présélectionnées
        await detail.expectAnalyseRowCount(analyses.length);
        for (const analyse of analyses) {
          await expect(page.locator('.analyses-modern table'), `Analyse "${analyse}" au bulletin`).toContainText(analyse, { ignoreCase: true });
        }
        if (index === 0) {
          bilanUrl = page.url();
          bilanOrder = order;
          bilanAnalyses = analyses;
        }
        await page.goBack();
        await expect(page.getByRole('heading', { name: /Liste des bilans d'analyses/ })).toBeVisible();
      });
    }
  });

  test('Ajouter manuellement des analyses lors de la création', async ({ page }) => {
    const list = new HealthChecksListPage(page);
    const detail = new HealthCheckDetailPage(page);
    const before = await list.getBilanOrderNumbers();
    await list.openNewBilanModal();
    const form = new ConsultationFormPage(page, modal(page));
    await form.fill([{ name: 'caregiverId', kind: 'select' }, { name: 'type', kind: 'select' }]);
    const preselected = await chosenLabels(modal(page).locator('ng-select[formcontrolname="analyses"]'));
    const added = await form.fill([{ name: 'analyses', kind: 'multiselect', count: 2 }]);
    await list.saveBilan();
    await list.openBilanByOrderNumber(await newOrderNumber(list, before));
    await detail.expectDetailLoaded();
    await detail.expectAnalyseRowCount(preselected.length + (added.analyses as string[]).length);
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
    resultTexts = [];
    for (let i = 0; i < bilanAnalyses.length; i++) {
      const text = `Résultat ${bilanAnalyses[i]} : valeur normale QA ${i + 1}`;
      await inputs.nth(i).fill(text);
      resultTexts.push(text);
    }

    await pane.locator('button.btn-submit').click();
    await confirm(page);
    await expect(page.getByText(/enregistrement de ce\(s\) résultat\(s\) a réussi/).first()).toBeVisible({ timeout: 20000 });
  });

  test('Rouvrir le résultat : champs, résultats et pièce jointe conservés', async ({ page }) => {
    await page.goto(bilanUrl);
    const pane = await openResultTab(page);
    await new ConsultationFormPage(page, pane).expectValues(resultFields(), results);
    const inputs = pane.locator('textarea.result-input');
    for (let i = 0; i < resultTexts.length; i++) await expect(inputs.nth(i)).toHaveValue(resultTexts[i]);
    await expect(pane.getByText('Modifier la pièce jointe')).toBeVisible();
  });

  test('Télécharger la pièce jointe du résultat', async ({ page }) => {
    await page.goto(bilanUrl);
    const pane = await openResultTab(page);
    // Le bouton n'est actif que lorsque le formulaire est activé
    await activateResult(page, pane);
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      pane.getByRole('button', { name: /Télécharger la pièce jointe/ }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  });

  test('Modifier le résultat : nouveau diagnostic et résultat de la première analyse', async ({ page }) => {
    await page.goto(bilanUrl);
    const pane = await openResultTab(page);
    await activateResult(page, pane);
    const diagnostic = 'Diagnostic modifié QA';
    await pane.locator('textarea[formcontrolname="diagnostic"]').fill(diagnostic);
    resultTexts[0] = 'Résultat modifié QA';
    await pane.locator('textarea.result-input').first().fill(resultTexts[0]);
    await pane.locator('button.btn-submit').click();
    await confirm(page);
    await expect(page.getByText(/enregistrement de ce\(s\) résultat\(s\) a réussi/).first()).toBeVisible({ timeout: 20000 });

    await page.reload();
    const reloaded = await openResultTab(page);
    await expect(reloaded.locator('textarea[formcontrolname="diagnostic"]')).toHaveValue(diagnostic);
    await expect(reloaded.locator('textarea.result-input').first()).toHaveValue(resultTexts[0]);
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
    const count = await detail.getAnalyseRowCount();
    await detail.openAddAnalyseModal();
    await detail.selectFirstConsultant();
    await detail.selectFirstAnalyse();
    await detail.saveAnalyse();
    await detail.expectAnalyseRowCount(count + 1);
    const pane = await openResultTab(page);
    await expect(pane.locator('textarea.result-input')).toHaveCount(count + 1);
  });

  test("Retirer une analyse du bulletin", async ({ page }) => {
    await page.goto(bilanUrl);
    const detail = new HealthCheckDetailPage(page);
    await detail.expectDetailLoaded();
    const count = await detail.getAnalyseRowCount();
    await detail.deleteFirstAnalyse();
    await detail.expectAnalyseRowCount(count - 1);
  });

  // ======================================================================
  // Cas d'exception
  // ======================================================================
  test("Un bilan sans prescripteur ni type n'est pas enregistré", async ({ page }) => {
    const list = new HealthChecksListPage(page);
    const before = await list.getBilanOrderNumbers();
    await list.openNewBilanModal();
    await modal(page).getByRole('button', { name: /Enregistrer/ }).click();
    await expect(modal(page).getByText('Le prescripteur est obligatoire')).toBeVisible();
    await expect(modal(page).getByText('Le type de bilan est obligatoire')).toBeVisible();
    await expect(modal(page), 'La fenêtre reste ouverte').toBeVisible();
    await modal(page).getByRole('button', { name: /Annuler/ }).click();
    expect(await list.getBilanOrderNumbers()).toEqual(before);
  });

  test("Un bilan avec type mais sans prescripteur n'est pas enregistré", async ({ page }) => {
    const list = new HealthChecksListPage(page);
    await list.openNewBilanModal();
    await new ConsultationFormPage(page, modal(page)).fill([{ name: 'type', kind: 'select' }]);
    await modal(page).getByRole('button', { name: /Enregistrer/ }).click();
    await expect(modal(page).getByText('Le prescripteur est obligatoire')).toBeVisible();
    await expect(modal(page).getByText('Le type de bilan est obligatoire')).toHaveCount(0);
    await expect(modal(page)).toBeVisible();
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
