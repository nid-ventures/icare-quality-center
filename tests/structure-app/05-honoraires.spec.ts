import { type Page } from '@playwright/test';
import { test, expect } from '../../fixtures/structure.fixture';
import { CreateHonorairePage } from '../../pages/structure/honoraire/create-honoraire.page';
import { HonorairesListPage } from '../../pages/structure/honoraire/honoraires-list.page';
import { HonoraireDataGenerator } from '../../pages/structure/generator/honoraire-data-generator';

test.setTimeout(120000);

// Prérequis de données : la liste des médecins provient de leurs profils de rémunération. Sans
// profil configuré dans l'environnement, aucun relevé ne peut être créé : le test est ignoré.
const NO_MEDECIN_REASON = "Aucun médecin avec profil de rémunération dans cet environnement (Administration > Paramètres > Rémunération médecin)";

/**
 * Crée un relevé d'honoraires "Non Payé" pour le premier médecin disponible sur la période
 * donnée (12 derniers mois par défaut) et renvoie le nom du médecin.
 */
async function createReleve(page: Page, periode = HonoraireDataGenerator.generateLargePeriod()): Promise<string> {
  const createPage = new CreateHonorairePage(page);
  const listPage = new HonorairesListPage(page);
  let medecinNom = '';
  await createPage.gotoViaMenu();
  test.skip(!(await createPage.hasMedecinDisponible()), NO_MEDECIN_REASON);
  await test.step("Créer un relevé d'honoraires (pré-requis)", async () => {
    medecinNom = await createPage.selectFirstMedecinDisponible();
    await createPage.fillPeriode(periode.dateDebut, periode.dateFin);
    await createPage.rechercher();
    expect(await createPage.hasActesTrouves(), 'Aucun acte facturé trouvé pour le médecin/période sélectionnés').toBeTruthy();
    expect(await createPage.selectAllSelectableActes()).toBeGreaterThan(0);
    await createPage.creerHonoraire();
    await listPage.expectListLoaded();
  });
  return medecinNom;
}

test.describe('Module Honoraires', () => {

  test.beforeEach(async ({ portal, page }) => {
    await portal.enterModule('Honoraires');
    await page.waitForURL('**/honoraire/honoraires');
  });

  test("Créer un relevé d'honoraires pour un médecin", async ({ page }) => {
    const createPage = new CreateHonorairePage(page);
    const listPage = new HonorairesListPage(page);
    const periode = HonoraireDataGenerator.generateLargePeriod();
    let medecinNom = '';

    await test.step('Ouvrir "Nouveau relevé" depuis le menu', async () => {
      await createPage.gotoViaMenu();
    });
    test.skip(!(await createPage.hasMedecinDisponible()), NO_MEDECIN_REASON);

    await test.step('Sélectionner un médecin et une période large', async () => {
      medecinNom = await createPage.selectFirstMedecinDisponible();
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
      const ligne = await listPage.getMostRecentRowForMedecinAndStatut(medecinNom, 'Non Payé');
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
});
