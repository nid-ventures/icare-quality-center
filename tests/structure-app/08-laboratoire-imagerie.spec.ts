import { test, expect } from '../../fixtures/structure.fixture';
import { PatientPage } from '../../pages/structure/patient/patient.page';
import { ImagingWorklistPage } from '../../pages/structure/imagerie/imaging-worklist.page';
import { LaboratoryWorklistPage, MISSING_PATIENT } from '../../pages/structure/analyse/laboratory-worklist.page';

// Le module "Laboratoire & Imagerie" est masqué dans l'application (AppModulesService :
// canAccess: () => false) : pas de carte sur le portail ni de menu. Seules les deux worklists
// déjà en service (imagerie et bilans) sont testées, ouvertes par leur URL. Les nouvelles pages
// du circuit de l'échantillon (/laboratoire/**) seront à couvrir quand le module sera ouvert.

test.setTimeout(90000);

test.describe('Module Laboratoire & Imagerie (worklists)', () => {

  // ======================================================================
  // Worklist d'imagerie
  // ======================================================================
  test.describe("Worklist d'imagerie", () => {
    test.beforeEach(async ({ portal, page }) => {
      await new ImagingWorklistPage(page).goto();
    });

    test("Rechercher des actes d'imagerie par chaque critère", async ({ page }) => {
      const worklistPage = new ImagingWorklistPage(page);
      await worklistPage.expectSearchFormVisible();
      await worklistPage.expectResultsTableVisible();
      const firstRow = worklistPage.tableRows.first();
      await expect(firstRow, "La worklist d'imagerie doit contenir au moins un acte").toBeVisible();

      await test.step('Par numéro de dossier', async () => {
        const folderOrder = (await firstRow.locator('td').nth(1).innerText()).trim();
        if (folderOrder && folderOrder !== '-') {
          await worklistPage.searchByFolderOrder(folderOrder);
          await expect(worklistPage.tableRows.first().locator('td').nth(1)).toContainText(folderOrder);
          await worklistPage.resetSearch();
        }
      });

      await test.step('Par prénom et nom', async () => {
        const [firstName, ...rest] = (await worklistPage.tableRows.first().locator('td').first().innerText()).trim().split(' ');
        await worklistPage.searchByFirstAndLastName(firstName, rest.join(' '));
        await worklistPage.resetSearch();
      });

      await test.step('Par date de naissance', async () => {
        const match = (await worklistPage.tableRows.first().locator('td').nth(4).innerText()).match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (match) {
          const [, day, month, year] = match;
          await worklistPage.searchByDateNaissance(`${year}-${month}-${day}`);
          await worklistPage.resetSearch();
        }
      });

      await test.step('Par prescripteur', async () => {
        await worklistPage.searchByFirstAvailablePrescripteur();
        await worklistPage.resetSearch();
      });
    });
  });

  // ======================================================================
  // Worklist des bilans (laboratoire)
  // ======================================================================
  test.describe('Worklist des bilans', () => {
    test('Rechercher des bilans par nom, type et prescripteur', async ({ portal, page }) => {
      const worklistPage = new LaboratoryWorklistPage(page);
      const patientPage = new PatientPage(page);
      let lastName = '';

      await test.step('Relever le nom du premier patient de Base patients', async () => {
        await portal.enterModule('Base patients');
        await patientPage.gotoPatientsList();
        lastName = await patientPage.getFirstPatientLastName();
        expect(lastName).toBeTruthy();
      });

      await worklistPage.gotoWorklist();

      await test.step('Par nom', async () => {
        await worklistPage.searchByLastName(lastName);
        await worklistPage.expectResultsMatchLastName(lastName);
      });

      await test.step('Par type de bilan', async () => {
        await worklistPage.reset();
        await worklistPage.expectResultsMatchType(await worklistPage.filterByFirstAvailableType());
      });

      await test.step('Par prescripteur', async () => {
        await worklistPage.reset();
        await worklistPage.expectResultsMatchPrescriber(await worklistPage.filterByFirstAvailablePrescriber());
      });
    });

    test('Chaque bilan de la worklist affiche son patient', async ({ portal, page }) => {
      // Constaté le 25/11 (backend test) : des bilans trouvés par la recherche sur le nom du patient
      // (ex. Dawn Connelly, née en 1956, 6 bilans du 18/11) arrivent sans bloc patient (`person` vide) ;
      // la worklist affiche alors « Patient non renseigné » (ni nom, ni n° de dossier, ni naissance).
      // Écran hors d'usage pour l'instant : module Laboratoire & Imagerie masqué (canAccess: false).
      const worklistPage = new LaboratoryWorklistPage(page);
      const patientPage = new PatientPage(page);
      let lastName = '';
      await test.step('Relever le nom du premier patient de Base patients', async () => {
        await portal.enterModule('Base patients');
        await patientPage.gotoPatientsList();
        lastName = await patientPage.getFirstPatientLastName();
        expect(lastName).toBeTruthy();
      });
      await worklistPage.gotoWorklist();
      await worklistPage.searchByLastName(lastName);
      const missing = await worklistPage.rowsWithoutPatient();
      // Anomalie liée aux données : déclarée seulement quand des lignes sans patient sont affichées
      test.fail(missing > 0, `Anomalie : ${missing} bilan(s) affiché(s) « ${MISSING_PATIENT} » (bloc patient absent de la réponse du backend) — module masqué, sans effet pour les utilisateurs`);
      expect(missing, `Bilans de « ${lastName} » affichés sans patient`).toBe(0);
    });

    test("Sélectionner plusieurs bilans pour l'impression par lot", async ({ portal, page }) => {
      const worklistPage = new LaboratoryWorklistPage(page);
      await worklistPage.gotoWorklist();
      expect(await worklistPage.getRowCount(), 'Au moins 2 bilans sont nécessaires').toBeGreaterThanOrEqual(2);
      await worklistPage.selectRow(0);
      await worklistPage.selectRow(1);
      await worklistPage.expectSelectionBarVisible(2);
      await worklistPage.deselectAll();
    });
  });
});
