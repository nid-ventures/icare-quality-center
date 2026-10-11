import { type Page } from '@playwright/test';
import { test, expect } from '../../fixtures/structure.fixture';
import { PortalPage } from '../../pages/structure/portal/portal.page';
import { CreateHonorairePage } from '../../pages/structure/honoraire/create-honoraire.page';
import { HonorairesListPage } from '../../pages/structure/honoraire/honoraires-list.page';
import { RemunerationProfilePage } from '../../pages/structure/my-space/remuneration-profile.page';
import { HonoraireDataGenerator } from '../../pages/structure/generator/honoraire-data-generator';
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
});
