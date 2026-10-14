import { type Page } from '@playwright/test';
import { test, expect } from '../../fixtures/structure.fixture';
import { PortalPage } from '../../pages/structure/portal/portal.page';
import { CreateHonorairePage } from '../../pages/structure/honoraire/create-honoraire.page';
import { HonorairesListPage } from '../../pages/structure/honoraire/honoraires-list.page';
import { RemunerationProfilePage } from '../../pages/structure/my-space/remuneration-profile.page';
import { HonoraireDataGenerator } from '../../pages/structure/generator/honoraire-data-generator';
import { BillingInvoicePage } from '../../pages/structure/billing/billing-invoice.page';
import { BillingListPatientPage } from '../../pages/structure/billing/billing-list.page';
import { createDossierPatient, DOSSIER_SETUP_TIMEOUT, type DossierPatient } from '../../fixtures/dossier-patient';
import {
  ensureHonorairePrerequisites, billActForMedecin, HONORAIRE_SETUP_TIMEOUT, HONORAIRE_SPECIALITY, type HonoraireContext,
} from '../../fixtures/honoraires-setup';

test.setTimeout(240000);

let ctx: HonoraireContext;

/**
 * Crée un relevé d'honoraires "Non Payé" pour le médecin paramétré : facture d'abord un acte de ce
 * médecin (un acte déjà relevé n'est plus éligible), puis établit le relevé sur la période.
 */
async function createReleve(page: Page, periode = HonoraireDataGenerator.generateLargePeriod()): Promise<string> {
  const createPage = new CreateHonorairePage(page);
  const listPage = new HonorairesListPage(page);

  await test.step(`Facturer un acte réalisé par ${ctx.medecin}`, async () => {
    await billActForMedecin(page, ctx);
  });

  await test.step("Créer le relevé d'honoraires", async () => {
    await new PortalPage(page).enterModule('Honoraires');
    await createPage.gotoViaMenu();
    await createPage.selectMedecin(ctx.medecin);
    await createPage.fillPeriode(periode.dateDebut, periode.dateFin);
    await createPage.rechercher();
    expect(await createPage.hasActesTrouves(), 'Des actes facturés du médecin doivent être trouvés').toBeTruthy();
    expect(await createPage.selectAllSelectableActes()).toBeGreaterThan(0);
    await createPage.creerHonoraire();
    await listPage.expectListLoaded();
  });
  return ctx.medecin;
}

test.describe('Module Honoraires', () => {

  // Paramétrage nécessaire (profil de rémunération, médecin) créé si absent
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(HONORAIRE_SETUP_TIMEOUT);
    ctx = await ensureHonorairePrerequisites(browser);
  });

  test.beforeEach(async ({ portal, page }) => {
    await portal.enterModule('Honoraires');
    await page.waitForURL('**/honoraire/honoraires');
  });

  test('Le profil de rémunération du médecin est paramétré', async ({ portal, page }) => {
    const profiles = new RemunerationProfilePage(page);
    await portal.enterModule('Administration');
    await profiles.open();
    expect(await profiles.hasActiveProfile(HONORAIRE_SPECIALITY, ctx.act), `Profil actif ${HONORAIRE_SPECIALITY} / ${ctx.act}`).toBeTruthy();
  });

  test("Créer un relevé d'honoraires pour un médecin", async ({ page }) => {
    const createPage = new CreateHonorairePage(page);
    const listPage = new HonorairesListPage(page);
    const periode = HonoraireDataGenerator.generateLargePeriod();

    await test.step(`Facturer un acte réalisé par ${ctx.medecin}`, async () => {
      await billActForMedecin(page, ctx);
      await new PortalPage(page).enterModule('Honoraires');
    });

    await test.step('Ouvrir "Nouveau relevé" et choisir le médecin et la période', async () => {
      await createPage.gotoViaMenu();
      await createPage.selectMedecin(ctx.medecin);
      await createPage.fillPeriode(periode.dateDebut, periode.dateFin);
      await createPage.expectPeriodeValide();
    });

    await test.step('Rechercher et sélectionner les actes facturés éligibles', async () => {
      await createPage.rechercher();
      expect(await createPage.hasActesTrouves(), 'Aucun acte facturé trouvé pour le médecin/période sélectionnés').toBeTruthy();
      expect(await createPage.selectAllSelectableActes()).toBeGreaterThan(0);
      await createPage.expectAnnulerButtonVisible();
    });

    await test.step('Créer le relevé et le retrouver "Non Payé" dans la liste', async () => {
      await createPage.creerHonoraire();
      await listPage.expectListLoaded();
      const ligne = await listPage.getMostRecentRowForMedecinAndStatut(ctx.medecin, 'Non Payé');
      await expect(ligne).toBeVisible();
      expect(await listPage.getRowStatutLibelle(ligne)).toBe('Non Payé');
    });
  });

  test('Filtrer la liste des relevés par statut et par période', async ({ page }) => {
    const listPage = new HonorairesListPage(page);
    await listPage.goto();

    for (const statut of ['Non Payé', 'Payé'] as const) {
      await test.step(`Filtrer par statut "${statut}"`, async () => {
        await listPage.filtrerParStatut(statut);
        await listPage.appliquerFiltres();
        if (await listPage.getRowCount() > 0) {
          await listPage.expectAllRowsHaveStatut(statut);
        }
      });
    }

    await test.step('Réinitialiser les filtres', async () => {
      await listPage.reinitialiserFiltres();
      await listPage.expectListLoaded();
    });

    await test.step('Filtrer par une période large (12 derniers mois)', async () => {
      const periode = HonoraireDataGenerator.generateLargePeriod();
      await listPage.filtrerParPeriode(periode.dateDebut, periode.dateFin);
      await listPage.appliquerFiltres();
      expect(await listPage.getResultsCountText()).toMatch(/résultat/);
      await listPage.reinitialiserFiltres();
      await listPage.expectListLoaded();
    });
  });

  test("Voir le détail d'un relevé d'honoraires", async ({ page }) => {
    const listPage = new HonorairesListPage(page);
    const medecinNom = await createReleve(page);

    await test.step('Ouvrir le détail du relevé créé', async () => {
      const ligne = await listPage.getMostRecentRowForMedecinAndStatut(medecinNom, 'Non Payé');
      await listPage.openDetailModal(ligne);
    });

    await test.step('Vérifier les informations générales', async () => {
      await expect(listPage.getDetailInfoValue('Médecin')).toContainText(medecinNom);
      await expect(listPage.getDetailInfoValue('Statut')).toContainText('Non Payé');
      await expect(listPage.getDetailInfoValue('Montant Net des Honoraires')).not.toBeEmpty();
      await expect(listPage.getDetailInfoValue('Total actes')).not.toBeEmpty();
      await listPage.closeDetailModal();
    });
  });

  test("Payer un relevé d'honoraires", async ({ page }) => {
    const listPage = new HonorairesListPage(page);
    const medecinNom = await createReleve(page);

    await test.step('Ouvrir la modale de paiement et confirmer', async () => {
      const ligne = await listPage.getMostRecentRowForMedecinAndStatut(medecinNom, 'Non Payé');
      await listPage.openPaymentModal(ligne);
      await listPage.fillPaymentDate(HonoraireDataGenerator.generatePaymentDate());
      await listPage.confirmerPaiement();
      await listPage.terminerPaiement();
    });

    await test.step('Vérifier le statut "Payé"', async () => {
      const ligne = await listPage.getMostRecentRowForMedecinAndStatut(medecinNom, 'Payé');
      await expect(ligne).toBeVisible();
      expect(await listPage.getRowStatutLibelle(ligne)).toBe('Payé');
    });
  });

  test("Modifier la période d'un relevé d'honoraires", async ({ page }) => {
    const listPage = new HonorairesListPage(page);
    const nouvellePeriode = HonoraireDataGenerator.generateLargePeriod(18, 20);
    const medecinNom = await createReleve(page, HonoraireDataGenerator.generateLargePeriod(10, 12));

    await test.step('Modifier la période et resélectionner les actes', async () => {
      const ligne = await listPage.getMostRecentRowForMedecinAndStatut(medecinNom, 'Non Payé');
      await listPage.openEditModal(ligne);
      await listPage.fillPeriodeDansModal(nouvellePeriode.dateDebut, nouvellePeriode.dateFin);
      await listPage.rechercherActesDansModal();
      expect(await listPage.selectAllSelectableActesDansModal()).toBeGreaterThan(0);
      await listPage.confirmerModification();
    });

    await test.step('Vérifier la période enregistrée', async () => {
      const ligne = await listPage.getMostRecentRowForMedecinAndStatut(medecinNom, 'Non Payé');
      await listPage.openEditModal(ligne);
      const periode = await listPage.getPeriodeDansModal();
      expect(periode.dateDebut).toBe(nouvellePeriode.dateDebut);
      expect(periode.dateFin).toBe(nouvellePeriode.dateFin);
      await listPage.annulerModaleHonoraire();
    });
  });

  test("Supprimer un relevé d'honoraires", async ({ page }) => {
    const listPage = new HonorairesListPage(page);
    const medecinNom = await createReleve(page);
    let reference = '';

    await test.step('Supprimer le relevé créé', async () => {
      const ligne = await listPage.getMostRecentRowForMedecinAndStatut(medecinNom, 'Non Payé');
      reference = await listPage.getRowReference(ligne);
      expect(reference).not.toBe('');
      await listPage.supprimerLigne(ligne);
    });

    await test.step("Vérifier qu'il n'apparaît plus dans la liste", async () => {
      expect(await listPage.referenceExisteDansListe(reference)).toBeFalsy();
    });
  });

  test.describe("Cas d'exception", () => {
    test('Une période dont la fin précède le début est refusée', async ({ page }) => {
      const createPage = new CreateHonorairePage(page);
      await createPage.gotoViaMenu();
      await createPage.selectMedecin(ctx.medecin);
      const periode = HonoraireDataGenerator.generateLargePeriod();
      await createPage.fillPeriode(periode.dateFin, periode.dateDebut);
      await expect(page.getByText('La date de fin doit être après la date de début')).toBeVisible();
      await expect(page.getByRole('button', { name: /Rechercher/ })).toBeDisabled();
    });

    test('La recherche est impossible sans médecin', async ({ page }) => {
      const createPage = new CreateHonorairePage(page);
      await createPage.gotoViaMenu();
      const periode = HonoraireDataGenerator.generateLargePeriod();
      await createPage.fillPeriode(periode.dateDebut, periode.dateFin);
      await expect(page.getByRole('button', { name: /Rechercher/ })).toBeDisabled();
    });
  });

  // ======================================================================
  // Conformité du calcul et cas rares (patient dédié : seuls ses actes sont lus)
  // ======================================================================
  test.describe('Conformité du calcul des honoraires et cas rares', () => {
    // Règles de l'application : honoraire d'un acte = taux du profil × montant de l'acte, ou montant
    // fixe du profil s'il n'a pas de taux ; montant net du relevé = total des honoraires × 0,9 ;
    // un acte déjà relevé, d'une facture supprimée ou hors période n'est pas proposé.
    test.describe.configure({ mode: 'serial' });
    type Rule = { act: string; category: string; rate: number | null; amount: number | null };
    let patient: DossierPatient;
    let rule: Rule;
    let otherRule: Rule | undefined;
    let reference = '';
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    /** Honoraire attendu d'un acte selon la règle du profil. */
    const feeOf = (r: Rule, amount: number) => r.rate !== null ? r.rate / 100 * amount : (r.amount ?? 0);

    test.beforeAll(async ({ browser }) => {
      test.setTimeout(DOSSIER_SETUP_TIMEOUT);
      patient = await createDossierPatient(browser);
    });

    /** Facture au patient dédié un acte du médecin, au montant donné. */
    async function bill(page: Page, r: Rule, amount: number) {
      await new PortalPage(page).enterModule('Facturation');
      await page.waitForURL('**/billing/billings-create');
      await new BillingInvoicePage(page).createInvoiceForPractitioner(patient.identifier, ctx.medecin, { category: r.category, act: r.act }, String(amount));
    }

    /** Recherche des actes du médecin sur la période ; renvoie les lignes du patient dédié. */
    async function search(page: Page, from = today, to = today) {
      await new PortalPage(page).enterModule('Honoraires');
      const createPage = new CreateHonorairePage(page);
      await createPage.searchActs(ctx.medecin, from, to);
      return { createPage, rows: await createPage.readRowsOfPatient(patient.identifier) };
    }

    /** Crée un relevé avec les seules lignes du patient dont le montant est dans `amounts`. */
    async function createStatement(page: Page, amounts: number[]): Promise<string> {
      const { createPage } = await search(page);
      const rows = createPage.rowsOfPatient(patient.identifier);
      for (let i = 0; i < await rows.count(); i++) {
        if (amounts.includes((await createPage.readRow(rows.nth(i))).amount)) await createPage.selectRow(rows.nth(i));
      }
      await createPage.creerHonoraire();
      const listPage = new HonorairesListPage(page);
      await listPage.expectListLoaded();
      return listPage.getRowReference(await listPage.getMostRecentRowForMedecinAndStatut(ctx.medecin, 'Non Payé'));
    }

    /** Retrouve le relevé dans la liste (filtre médecin et statut : un relevé payé n'est pas listé sinon). */
    async function openStatement(page: Page, ref: string, statut: 'Non Payé' | 'Payé' = 'Non Payé') {
      const listPage = new HonorairesListPage(page);
      await listPage.goto();
      await listPage.filtrerParMedecin(ctx.medecin);
      await listPage.filtrerParStatut(statut);
      await listPage.appliquerFiltres();
      const row = listPage.rowOfReference(ref);
      await expect(row, `Relevé ${ref}`).toHaveCount(1, { timeout: 15000 });
      return { listPage, row };
    }

    test('Préparer : règles de rémunération du médecin (taux et montant fixe)', async ({ portal, page }) => {
      await portal.enterModule('Administration');
      const profiles = new RemunerationProfilePage(page);
      await profiles.open();
      const active = await profiles.activeProfiles(HONORAIRE_SPECIALITY);
      const found = active.find(p => p.act.toUpperCase() === ctx.act.toUpperCase());
      expect(found, `Profil actif de "${ctx.act}"`).toBeDefined();
      rule = { ...found!, category: ctx.category };
      expect(rule.rate !== null || rule.amount !== null, 'Le profil a un taux ou un montant').toBe(true);
      // Second profil de l'autre type (montant fixe si le premier a un taux, et inversement), créé si absent
      const wantRate = rule.rate === null;
      otherRule = active.find(p => p.act !== found!.act && (wantRate ? p.rate !== null : p.rate === null && p.amount !== null));
      if (!otherRule) {
        // Tous les actes de la spécialité peuvent déjà avoir un profil (du même type) : pas de second profil
        const proposal = await profiles.tryFirstProposition(HONORAIRE_SPECIALITY);
        if (!proposal) return;
        const isoShift = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
        await profiles.create({ speciality: HONORAIRE_SPECIALITY, act: proposal.act, ...(wantRate ? { coverage: '20' } : { mount: '3000' }), startDate: isoShift(-730), endDate: isoShift(730) });
        otherRule = { act: proposal.act, category: proposal.category, rate: wantRate ? 20 : null, amount: wantRate ? null : 3000 };
      }
    });

    test('Un acte facturé : honoraire calculé selon le profil de rémunération', async ({ page }) => {
      await bill(page, rule, 10000);
      const { rows } = await search(page);
      expect(rows, 'Un acte du patient proposé').toHaveLength(1);
      expect.soft(rows[0].amount, "Montant de l'acte").toBe(10000);
      expect.soft(rows[0].rate, 'Taux du profil').toBe(rule.rate);
      expect.soft(rows[0].fee, 'Honoraire').toBeCloseTo(feeOf(rule, 10000), 0);
      expect.soft(rows[0].selectable, 'Sélectionnable').toBe(true);
    });

    test('Créer le relevé : prestations, honoraire brut et net (× 0,9) conformes, détail conforme', async ({ page }) => {
      const fee = feeOf(rule, 10000);
      reference = await createStatement(page, [10000]);
      const { listPage, row } = await openStatement(page, reference);
      const amounts = await listPage.amountsOf(row);
      expect.soft(amounts.prestation, 'Montant des prestations').toBe(10000);
      expect.soft(amounts.net, 'Honoraire net = honoraires × 0,9').toBeCloseTo(fee * 0.9, 0);
      expect.soft(amounts.brut, 'Honoraire brut = total des honoraires').toBeCloseTo(fee, 0);
      const detail = await listPage.detailOf(row);
      // La fenêtre de détail n'affiche pas la référence du relevé : médecin et période à la place
      const frDate = today.split('-').reverse().join('/');
      expect.soft(detail.text.toLowerCase(), 'Médecin au détail').toContain(ctx.medecin.toLowerCase().split(/\s+/)[0]);
      expect.soft(detail.text, 'Période au détail').toContain(`Du ${frDate} au ${frDate}`);
      const lines = detail.lines.filter(l => l.patient.includes(patient.identifier));
      expect.soft(lines.map(l => [l.amount, Math.round(l.fee)]), "Acte du relevé : montant et honoraire").toEqual([[10000, Math.round(fee)]]);
    });

    test("Un acte déjà relevé n'est plus proposé", async ({ page }) => {
      const { rows } = await search(page);
      expect(rows, 'Plus aucun acte du patient proposé').toHaveLength(0);
    });

    test('Plusieurs actes : seuls les actes sélectionnés entrent dans le relevé', async ({ page }) => {
      await bill(page, rule, 4000);
      await bill(page, rule, 6000);
      const { rows } = await search(page);
      expect(rows.map(r => r.amount).sort(), 'Deux nouveaux actes proposés').toEqual([4000, 6000]);
      reference = await createStatement(page, [4000]);
      const { listPage, row } = await openStatement(page, reference);
      expect.soft((await listPage.amountsOf(row)).prestation, 'Seul l\'acte de 4 000 est relevé').toBe(4000);
      const after = await search(page);
      expect(after.rows.map(r => r.amount), "L'acte non sélectionné reste proposé").toEqual([6000]);
    });

    test('Supprimer un relevé : ses actes redeviennent proposés', async ({ page }) => {
      const { listPage, row } = await openStatement(page, reference);
      await listPage.supprimerLigne(row);
      const { rows } = await search(page);
      expect(rows.map(r => r.amount).sort(), "L'acte du relevé supprimé est de nouveau proposé").toEqual([4000, 6000]);
    });

    test('Un acte facturé hors de la période recherchée n\'est pas proposé', async ({ page }) => {
      const { rows } = await search(page, yesterday, yesterday);
      expect(rows, 'Aucun acte du patient la veille').toHaveLength(0);
    });

    test("Facture supprimée : son acte n'est plus proposé", async ({ page }) => {
      await test.step('Supprimer la facture de 6 000', async () => {
        await new PortalPage(page).enterModule('Facturation');
        await new PortalPage(page).openMenu('Factures patients', '**/billing/billings-patients');
        const list = new BillingListPatientPage(page);
        const invoice = (await list.invoicesOf(patient.identifier)).find(i => i.amount === 6000);
        expect(invoice, 'Facture de 6 000').toBeDefined();
        await list.deleteInvoice(invoice!.order);
      });
      const { rows } = await search(page);
      expect(rows.map(r => r.amount), "Seul l'acte encore facturé reste proposé").toEqual([4000]);
    });

    test('Payer un relevé : statut "Payé", montants inchangés, plus modifiable ni supprimable', async ({ page }) => {
      const fee = feeOf(rule, 4000);
      reference = await createStatement(page, [4000]);
      const { listPage, row } = await openStatement(page, reference);
      const before = await listPage.amountsOf(row);
      await listPage.openPaymentModal(row);
      await listPage.fillPaymentDate(today);
      await listPage.confirmerPaiement();
      await listPage.terminerPaiement();
      const paid = (await openStatement(page, reference, 'Payé')).row;
      expect.soft(await listPage.getRowStatutLibelle(paid), 'Statut').toBe('Payé');
      expect.soft(await listPage.amountsOf(paid), 'Montants inchangés').toEqual(before);
      expect.soft(before.net, 'Honoraire net = honoraire × 0,9').toBeCloseTo(fee * 0.9, 0);
      for (const action of ['Payer relevé', 'Modifier', 'Supprimer']) {
        await expect.soft(paid.getByTitle(action), `"${action}" indisponible sur un relevé payé`).toHaveCount(0);
      }
    });

    test("Deuxième règle de rémunération (montant fixe ou taux) : honoraire conforme", async ({ page }) => {
      test.skip(!otherRule, `Aucun autre acte de la spécialité "${HONORAIRE_SPECIALITY}" disponible pour un profil de l'autre type`);
      await bill(page, otherRule!, 7000);
      const { rows } = await search(page);
      const row = rows.find(r => r.act.toUpperCase().includes(otherRule!.act.toUpperCase()));
      expect(row, `Acte "${otherRule!.act}" proposé`).toBeDefined();
      expect.soft(row!.rate, 'Taux du profil').toBe(otherRule!.rate);
      expect.soft(row!.fee, otherRule!.rate === null ? "Montant fixe, quel que soit le montant de l'acte" : 'Taux × montant').toBeCloseTo(feeOf(otherRule!, 7000), 0);
    });
  });
});
