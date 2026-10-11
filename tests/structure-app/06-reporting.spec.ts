import { test, expect } from '../../fixtures/structure.fixture';
import { MedicalActsReportingPage, BillableBillingReportingPage } from '../../pages/structure/my-space/reporting.page';

// Le dashboard statistique historique (/my-space/dashboard) redirige désormais vers le portail
// des modules (cf. my-space.routes.ts) : il n'existe plus de fonctionnalité à tester.

test.describe('Module Reporting', () => {

  test.beforeEach(async ({ portal, page }) => {
    await portal.enterModule('Reporting');
    await page.waitForURL('**/my-space/reporting/prestations');
  });

  // ======================================================================
  // Prestations (Reporting médical)
  // ======================================================================
  test.describe('Prestations', () => {
    test("Parcourir les onglets du reporting médical", async ({ page }) => {
      await new MedicalActsReportingPage(page).expectLoaded();
      // Chaque onglet affiche son libellé suivi d'un compteur (ex: "Imagerie 6")
      const tabs: [string, RegExp, string][] = [
        ['Imagerie', /Imagerie \d+$/, "Filtres d'imagerie"],
        ['Bilans', /Bilans \d+$/, 'Filtres des bilans'],
        ['Vaccinations', /Vaccinations \d+$/, 'Filtres des vaccinations'],
        ['Consultations', /Consultations \d+$/, 'Filtres des consultations'],
      ];
      for (const [label, tab, filtersTitle] of tabs) {
        await test.step(`Onglet ${label}`, async () => {
          await page.getByRole('button', { name: tab }).click();
          await expect(page.getByRole('heading', { name: filtersTitle })).toBeVisible();
        });
      }
    });

    test('Valider puis lancer une recherche de consultations', async ({ page }) => {
      const reportingPage = new MedicalActsReportingPage(page);
      await reportingPage.expectLoaded();

      await test.step('Sans date de début : message de validation', async () => {
        await reportingPage.searchConsultations();
        await reportingPage.expectConsultationValidationMessage(/Veuillez saisir la date de début/);
      });

      await test.step('Avec dates mais sans type : message de validation', async () => {
        const today = new Date();
        const dateEnd = today.toISOString().slice(0, 10);
        const dateStart = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate()).toISOString().slice(0, 10);
        await reportingPage.fillConsultationDateRange(dateStart, dateEnd);
        await reportingPage.searchConsultations();
        await reportingPage.expectConsultationValidationMessage(/Veuillez choisir un type/);
      });

      await test.step('Avec un type de consultation : résultat affiché', async () => {
        await reportingPage.selectFirstConsultationType();
        await reportingPage.searchConsultations();
        await reportingPage.expectConsultationValidationMessage(/consultation\(s\) trouvée\(s\)|Aucune consultation trouvée/);
      });

      await test.step('Réinitialiser les filtres', async () => {
        await reportingPage.resetConsultationFilters();
      });
    });

    test("Configurer la modale d'export sans télécharger", async ({ page }) => {
      const reportingPage = new MedicalActsReportingPage(page);
      await reportingPage.expectLoaded();

      await test.step('Valeurs par défaut : Consultations en Excel', async () => {
        await reportingPage.openExportModal();
        await reportingPage.expectExportSourceActive('Consultations');
        await reportingPage.expectExportFormatActive('Excel');
        await reportingPage.expectExportSummary(/Export\s*:\s*Consultations\s+en\s+Excel/);
      });

      await test.step('Source : Imagerie', async () => {
        await reportingPage.selectExportSource('Imagerie');
        await reportingPage.expectExportSourceActive('Imagerie');
        await reportingPage.expectExportSubCategorySelectVisible();
        await reportingPage.expectExportSummary(/Export\s*:\s*Imagerie/);
      });

      await test.step('Période : "Mois dernier"', async () => {
        const initialRange = await reportingPage.getExportDateRange();
        await reportingPage.selectExportPeriodPreset('Mois dernier');
        const updatedRange = await reportingPage.getExportDateRange();
        expect(updatedRange.start).not.toBe(initialRange.start);
        expect(new Date(updatedRange.start).getTime()).toBeLessThanOrEqual(new Date(updatedRange.end).getTime());
      });

      await test.step('Formats : CSV, DHIS2 (champs dédiés) puis Excel', async () => {
        await reportingPage.selectExportFormat('CSV');
        await reportingPage.expectExportFormatActive('CSV');
        await reportingPage.expectExportSummary(/en\s+CSV/);
        await reportingPage.selectExportFormat('DHIS2');
        await reportingPage.expectExportFormatActive('DHIS2');
        await reportingPage.expectDhis2FieldsVisible();
        await reportingPage.selectExportFormat('Excel');
        await reportingPage.expectExportFormatActive('Excel');
        await reportingPage.expectDhis2FieldsHidden();
      });

      await test.step('Fermer via "Annuler"', async () => {
        await reportingPage.closeExportModalViaAnnuler();
      });
    });
  });

  // ======================================================================
  // Liste des actes
  // ======================================================================
  test.describe('Liste des actes', () => {
    test('Rechercher dans la liste des actes', async ({ portal, page }) => {
      const actsPage = new BillableBillingReportingPage(page);

      await test.step('Ouvrir "Liste des actes" depuis le menu', async () => {
        await portal.openMenu('Liste des actes', '**/my-space/reporting/billable-billing');
        await actsPage.expectLoaded();
      });

      await test.step('Recherche sans filtre', async () => {
        await actsPage.search();
        await actsPage.expectResultsRendered();
      });

      await test.step('Identifiant patient inexistant : aucun résultat', async () => {
        await actsPage.fillPatientIdentifier('QA-TEST-INEXISTANT-999999');
        await actsPage.search();
        await actsPage.expectNoResults();
      });

      await test.step('Filtrer par statut "Facturé" puis "Non Facturé"', async () => {
        await actsPage.reset();
        for (const status of ['Facturé', 'Non Facturé'] as const) {
          await actsPage.selectStatus(status);
          await actsPage.search();
          await actsPage.expectResultsRendered();
        }
      });

      await test.step('Réinitialiser le formulaire', async () => {
        await actsPage.reset();
        await actsPage.expectLoaded();
      });
    });
  });
});
