import { type Page } from '@playwright/test';
import { test, expect } from '../../fixtures/structure.fixture';
import { type PortalPage } from '../../pages/structure/portal/portal.page';
import { PatientPage } from '../../pages/structure/patient/patient.page';
import { BillingInvoicePage } from '../../pages/structure/billing/billing-invoice.page';
import { BillingListPatientPage, BillingListGarantPage } from '../../pages/structure/billing/billing-list.page';
import { PatientCarePage } from '../../pages/structure/patient/patient-care.page';
import { createDossierPatient, DOSSIER_SETUP_TIMEOUT, type DossierPatient } from '../../fixtures/dossier-patient';
import { COVER_SCENARIOS, computeCover, scenarioTotal, type CoverComputation, type CoverScenario } from '../../test-data/cover-scenarios';
import { type InvoiceDetail } from '../../pages/structure/billing/billing-list.page';

test.setTimeout(120000);

/** Identifiant du premier patient de Base patients (patient de référence pour facturer). */
async function getReferencePatientIdentifier(portal: PortalPage, page: Page): Promise<string> {
  const patientPage = new PatientPage(page);
  let identifier = '';
  await test.step('Relever un identifiant patient dans Base patients', async () => {
    await portal.enterModule('Base patients');
    await patientPage.gotoPatientsList();
    identifier = await patientPage.getFirstPatientId();
    expect(identifier, 'Aucun patient disponible pour créer une facture').not.toBe('');
  });
  return identifier;
}

/** Crée une facture pour le patient (assistant complet) ; termine sur la liste des factures patients. */
async function createInvoice(portal: PortalPage, page: Page, patientIdentifier: string) {
  await test.step(`Créer une facture pour le patient ${patientIdentifier}`, async () => {
    await portal.enterModule('Facturation');
    await page.waitForURL('**/billing/billings-create');
    await new BillingInvoicePage(page).createInvoiceForPatient(patientIdentifier);
  });
}

/** Retrouve les factures du patient dans la liste des factures patients. */
async function findPatientInvoices(page: Page, patientIdentifier: string) {
  const listPage = new BillingListPatientPage(page);
  await listPage.expectListLoaded();
  await listPage.fillIdentifiantPatient(patientIdentifier);
  await listPage.search();
  expect(await listPage.getRowCount(), `Aucune facture retrouvée pour le patient "${patientIdentifier}"`).toBeGreaterThan(0);
  return listPage.getFirstRowData();
}

/** Règles générales de toute répartition garant / patient (étape Facturation). */
function expectShareConformity(shares: { garant: number; patient: number }, total: number, cap?: number) {
  expect.soft(shares.garant + shares.patient, 'Garant + patient = total des actes').toBe(total);
  expect.soft(shares.garant, 'Part garant positive ou nulle').toBeGreaterThanOrEqual(0);
  expect.soft(shares.patient, 'Part patient positive ou nulle').toBeGreaterThanOrEqual(0);
  if (cap) expect.soft(shares.garant, 'Part garant dans la limite du plafond global').toBeLessThanOrEqual(cap);
}

/**
 * Règles générales du détail d'une facture (patient ou garant) : N° et patient, une ligne par acte
 * (quantité, montant unitaire, montant), total, taux, part due, plafond global (garant), et
 * "Net à payer" de chaque acte selon les règles métier. Écarts relevés en souple, tous ensemble.
 */
function expectDetailConformity(detail: InvoiceDetail, side: 'patient' | 'garant', order: string,
  patient: DossierPatient, scenario: CoverScenario, computed: CoverComputation) {
  const label = side === 'patient' ? 'Facture patient' : 'Facture garant';
  expect.soft(detail.text, `${label} : N° ${order}`).toContain(order);
  expect.soft(detail.text.toLowerCase(), `${label} : nom du patient`).toContain(patient.lastName.toLowerCase());
  expect.soft(detail.total, `${label} : total`).toBe(computed.total);
  expect.soft(detail.rate, `${label} : taux garant`).toBe(scenario.cover?.rate ?? 0);
  expect.soft(detail[side], `${label} : part ${side}`).toBe(computed[side]);
  if (side === 'garant' && scenario.cover?.cap) expect.soft(detail.cap, `${label} : plafond global`).toBe(scenario.cover.cap);

  expect.soft(detail.lines.length, `${label} : une ligne par acte`).toBe(scenario.lines.length);
  const remaining = [...detail.lines];
  for (const share of computed.lines) {
    const { act, amount, days } = share.line;
    const index = remaining.findIndex(l => l.act.toUpperCase().includes(act.toUpperCase()) && l.unit === amount);
    expect.soft(index, `${label} : ligne "${act}" à ${amount}`).toBeGreaterThanOrEqual(0);
    if (index < 0) continue;
    const [detailLine] = remaining.splice(index, 1);
    expect.soft(detailLine.quantity, `${label} : quantité de "${act}"`).toBe(days ?? 1);
    expect.soft(detailLine.amount, `${label} : montant de "${act}"`).toBe(share.total);
    expect.soft(detailLine.net, `${label} : net à payer de "${act}"`).toBe(Math.round(share[side]));
  }
  if (!computed.capReached) {
    expect.soft(detail.lines.reduce((s, l) => s + l.net, 0), `${label} : somme des nets à payer = part ${side}`).toBe(computed[side]);
  }
}

test.describe('Module Facturation', () => {

  // ======================================================================
  // Nouvelle facture (assistant)
  // ======================================================================
  test.describe('Nouvelle facture', () => {
    test("Afficher l'assistant de facturation", async ({ portal, page }) => {
      await portal.enterModule('Facturation');
      await page.waitForURL('**/billing/billings-create');
      await test.step('Vérifier les 3 étapes de l\'assistant', async () => {
        for (const step of ['Recherche Patient', 'Actes Médicaux', 'Facturation']) {
          await expect(page.getByRole('button', { name: new RegExp(`${step}$`) }).first()).toBeVisible();
        }
      });
      await test.step('Le bouton Rechercher est désactivé sans critère', async () => {
        await expect(page.getByRole('button', { name: /Rechercher$/ })).toBeDisabled();
      });
    });

    test("Créer une facture patient via l'assistant de facturation", async ({ portal, page }) => {
      const invoicePage = new BillingInvoicePage(page);
      const patientIdentifier = await getReferencePatientIdentifier(portal, page);

      await test.step("Ouvrir l'assistant et sélectionner le patient", async () => {
        await portal.enterModule('Facturation');
        await page.waitForURL('**/billing/billings-create');
        await invoicePage.searchPatientByIdentifier(patientIdentifier);
        expect(await invoicePage.getSearchResultsCount()).toBeGreaterThan(0);
        await invoicePage.selectFirstSearchResult();
      });

      await test.step('Ajouter un acte facturable et saisir son montant', async () => {
        await invoicePage.seedBillableAct();
        const filled = await invoicePage.fillFirstAvailableActAmount('5000');
        expect(filled, "Aucune ligne d'acte facturable exploitable après ajout de l'acte de test").toBeTruthy();
      });

      await test.step('Facturer les actes, appliquer une prise en charge si disponible, générer', async () => {
        await invoicePage.proceedToBilling();
        await invoicePage.tryApplyFirstAvailableInsurance();
        await invoicePage.generateInvoice();
        await expect(page).toHaveURL(/\/billing\/billings-patients/);
      });

      await test.step('Vérifier la facture dans la liste des factures patients', async () => {
        await findPatientInvoices(page, patientIdentifier);
      });
    });
  });

  // ======================================================================
  // Factures patients
  // ======================================================================
  test.describe('Factures patients', () => {
    test('Rechercher des factures patients par chaque critère', async ({ portal, page }) => {
      const listPage = new BillingListPatientPage(page);
      const patientIdentifier = await getReferencePatientIdentifier(portal, page);
      await createInvoice(portal, page, patientIdentifier);

      await test.step('Ouvrir la liste des factures patients depuis le menu', async () => {
        await portal.openMenu('Factures patients', '**/billing/billings-patients');
        await listPage.expectListLoaded();
      });

      await test.step('Rechercher par chaque champ à partir de la première facture', async () => {
        expect(await listPage.getRowCount()).toBeGreaterThan(0);
        await listPage.searchByEachField(await listPage.getFirstRowData());
      });

      await test.step('Réinitialiser la recherche', async () => {
        await listPage.reset();
        await listPage.expectListLoaded();
      });
    });

    test("Voir le détail d'une facture patient", async ({ portal, page }) => {
      const listPage = new BillingListPatientPage(page);
      const patientIdentifier = await getReferencePatientIdentifier(portal, page);
      await createInvoice(portal, page, patientIdentifier);
      const reference = await findPatientInvoices(page, patientIdentifier);

      await test.step('Ouvrir et vérifier la fenêtre de détail', async () => {
        await listPage.openDetailModal();
        const detailModal = listPage.getDetailModal();
        await expect(detailModal.getByText(reference.invoiceOrder)).toBeVisible();
        await expect(detailModal).toContainText(reference.nomPatient);
        await expect(detailModal).toContainText(reference.prenomPatient);
        await expect(detailModal.getByText('Total Facture (F CFA)')).toBeVisible();
      });

      await test.step('Fermer la fenêtre de détail', async () => {
        await listPage.closeDetailModal();
      });
    });

    test('Supprimer une facture patient', async ({ portal, page }) => {
      const listPage = new BillingListPatientPage(page);
      const patientIdentifier = await getReferencePatientIdentifier(portal, page);
      await createInvoice(portal, page, patientIdentifier);
      const { invoiceOrder } = await findPatientInvoices(page, patientIdentifier);

      await test.step('Supprimer la facture et confirmer', async () => {
        await listPage.deleteRow();
      });

      await test.step("Vérifier que la facture n'apparaît plus", async () => {
        await listPage.fillIdentifiantPatient(patientIdentifier);
        await listPage.search();
        await listPage.expectInvoiceNotVisible(invoiceOrder);
      });
    });
  });

  // ======================================================================
  // Factures garants
  // ======================================================================
  test.describe('Factures garants', () => {
    test('Rechercher des factures garants par chaque critère', async ({ portal, page }) => {
      const listPage = new BillingListGarantPage(page);
      const patientIdentifier = await getReferencePatientIdentifier(portal, page);
      await createInvoice(portal, page, patientIdentifier);

      await test.step('Ouvrir la liste des factures garants depuis le menu', async () => {
        await portal.openMenu('Factures garants', '**/billing/billings-garants');
        await listPage.expectListLoaded();
      });

      await test.step('Rechercher par chaque champ (dont Garant) à partir de la première facture', async () => {
        expect(await listPage.getRowCount()).toBeGreaterThan(0);
        await listPage.searchByEachField(await listPage.getFirstRowData());
      });

      await test.step('Réinitialiser la recherche', async () => {
        await listPage.reset();
        await listPage.expectListLoaded();
      });
    });
  });

  // ======================================================================
  // Prise en charge : calcul des quote-parts garant / patient
  // ======================================================================
  test.describe('Prise en charge : calcul des quote-parts', () => {
    // Un patient dédié ; avant chaque scénario, sa prise en charge est remplacée par celle du scénario.
    // Pas de mode série : un écart de conformité n'empêche pas les scénarios suivants (après un échec,
    // le worker redémarre et un nouveau patient est créé).
    let patient: DossierPatient;
    // Factures déjà vues : la facture d'un scénario est la seule nouvelle de la liste.
    const knownPatientInvoices = new Set<string>();
    const knownGarantInvoices = new Set<string>();
    // Montants des factures patient créées par chaque scénario (pour les anomalies vérifiées à part).
    const patientInvoicesByScenario = new Map<string, number[]>();

    test.beforeAll(async ({ browser }) => {
      test.setTimeout(DOSSIER_SETUP_TIMEOUT);
      patient = await createDossierPatient(browser);
    });

    for (const scenario of COVER_SCENARIOS) {
      test(scenario.title, async ({ portal, page }) => {
        // Jusqu'à 9 actes et 5 exceptions par scénario : au ralenti visuel, plus de 10 minutes.
        test.setTimeout(1200000);
        const { garant, patient: patientPart } = scenario.expected;
        expect(garant + patientPart, 'Scénario : garant + patient = total facturé').toBe(scenarioTotal(scenario));
        const computed = computeCover(scenario.lines, scenario.cover);
        expect({ garant: computed.garant, patient: computed.patient }, 'Montants attendus = calcul des règles métier').toEqual(scenario.expected);
        const invoicePage = new BillingInvoicePage(page);

        await test.step(scenario.cover
          ? `Prise en charge du patient : taux ${scenario.cover.rate} %, plafond ${scenario.cover.cap ?? 'aucun'}`
          : 'Aucune prise en charge pour le patient', async () => {
          await portal.enterModule('Base patients');
          const patientPage = new PatientPage(page);
          await patientPage.searchByName(patient.firstName, patient.lastName);
          await patientPage.openPatient(patient.lastName);
          await page.waitForURL('**/patient/patient-info-administration/**');
          const carePage = new PatientCarePage(page);
          await carePage.goToCareTab();
          await carePage.removeAllCovers();
          if (scenario.cover) await carePage.addCover(scenario.cover);
        });

        await test.step('Ajouter les actes du scénario et saisir leurs montants', async () => {
          await portal.enterModule('Facturation');
          await page.waitForURL('**/billing/billings-create');
          await invoicePage.searchPatientByIdentifier(patient.identifier);
          await invoicePage.selectFirstSearchResult();
          for (const line of scenario.lines) await invoicePage.addAct(line);
          for (const line of scenario.lines) await invoicePage.setActAmount(line.act, line.amount);
        });

        await test.step(`Facturer : garant ${garant}, patient ${patientPart}`, async () => {
          await invoicePage.proceedToBilling();
          if (scenario.cover) await invoicePage.chooseCover(scenario.cover.insurer);
          await expect.poll(() => invoicePage.coverSummary(), { message: 'Taux, plafond et quote-parts affichés' })
            .toEqual({ rate: scenario.cover?.rate ?? 0, cap: scenario.cover?.cap ?? 0, garant, patient: patientPart });
          expectShareConformity(await invoicePage.coverSummary(), computed.total, scenario.cover?.cap);
          await invoicePage.generateInvoice();
        });

        // Facture garant vérifiée en premier : elle est ainsi comptée même si la vérification de la
        // facture patient échoue (anomalie connue), sans fausser le scénario suivant.
        await test.step(garant > 0 ? `Facture garant de ${garant}` : 'Pas de facture garant', async () => {
          await portal.openMenu('Factures garants', '**/billing/billings-garants');
          const list = new BillingListGarantPage(page);
          const created = (await list.invoicesOf(patient.identifier)).filter(i => !knownGarantInvoices.has(i.order));
          created.forEach(i => knownGarantInvoices.add(i.order));
          expect(created.map(i => i.amount), garant > 0 ? 'Une nouvelle facture garant, du montant de la part garant' : 'Aucune facture garant')
            .toEqual(garant > 0 ? [garant] : []);
          if (created.length === 1) {
            await test.step('Conformité du détail de la facture garant', async () =>
              expectDetailConformity(await list.detailOf(created[0].order), 'garant', created[0].order, patient, scenario, computed));
          }
        });

        await test.step(`Facture patient de ${patientPart}`, async () => {
          await portal.openMenu('Factures patients', '**/billing/billings-patients');
          const list = new BillingListPatientPage(page);
          const created = (await list.invoicesOf(patient.identifier)).filter(i => !knownPatientInvoices.has(i.order));
          created.forEach(i => knownPatientInvoices.add(i.order));
          patientInvoicesByScenario.set(scenario.title, created.map(i => i.amount));
          // Anomalie connue : vérifiée à part (test.fail ci-dessous), pour que le calcul et la
          // facture garant de ce scénario restent contrôlés normalement.
          if (!scenario.anomaly) {
            expect(created.map(i => i.amount), 'Une nouvelle facture patient, du montant de la part patient').toEqual([patientPart]);
          }
          if (created.length === 1) {
            await test.step('Conformité du détail de la facture patient', async () =>
              expectDetailConformity(await list.detailOf(created[0].order), 'patient', created[0].order, patient, scenario, computed));
          }
        });
      });

      if (scenario.anomaly) {
        test(`${scenario.title} : une facture patient est créée`, async () => {
          test.fail(true, scenario.anomaly);
          expect(patientInvoicesByScenario.get(scenario.title), 'Une nouvelle facture patient, du montant de la part patient')
            .toEqual([scenario.expected.patient]);
        });
      }
    }
  });
});
