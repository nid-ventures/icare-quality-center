import { test, expect } from '../../fixtures/structure.fixture';
import { ADMIN_MODULES, type ModuleName } from '../../pages/structure/portal/portal.page';
import { adminUser } from '../../test-data/structure-users';
import { tenant, hasModule, absentModules, withoutModuleReason, type OptionalModule } from '../../test-data/tenants';

// Modules de la structure testée (relevés sur son portail à la connexion) : certaines structures
// n'ont ni Facturation, ni Honoraires, ni Rendez-vous
const isOptional = (name: ModuleName): name is OptionalModule => name === 'Facturation' || name === 'Honoraires' || name === 'Rendez-vous';
const EXPECTED_MODULES = ADMIN_MODULES.filter(m => !isOptional(m) || hasModule(m));

// Menu latéral attendu à l'entrée de chaque module (cf. AppModulesService.modules)
const MODULE_MENUS: { name: ModuleName; url: string; menu: string[] }[] = [
  { name: 'Base patients', url: '**/patient/patients', menu: ['Patients'] },
  { name: 'Dossier médical', url: '**/patient/patients', menu: ['Dossiers patients'] },
  { name: 'Facturation', url: '**/billing/billings-create', menu: ['Nouvelle facture', 'Factures patients', 'Factures garants'] },
  { name: 'Honoraires', url: '**/honoraire/honoraires', menu: ["Relevés d'honoraires", 'Nouveau relevé'] },
  { name: 'Reporting', url: '**/my-space/reporting/prestations', menu: ['Prestations', 'Liste des actes'] },
  { name: 'Administration', url: '**/my-space/configuration', menu: ['Utilisateurs', 'Paramètres'] },
];

test.describe('Module Portail iCare', () => {

  test('Afficher le portail et les modules disponibles pour un administrateur', async ({ portal, page }) => {
    await test.step("Vérifier la salutation et l'utilisateur connecté", async () => {
      await expect(portal.greetingHeading).toContainText(adminUser.fullName);
      await expect(page.getByRole('banner')).toContainText('Connecté(e)');
    });

    await test.step('Vérifier la liste des modules accessibles', async () => {
      await portal.expectModulesVisible(EXPECTED_MODULES);
    });

    for (const absent of absentModules()) {
      await test.step(`Vérifier que le module ${absent} n'est pas proposé (${tenant.name})`, async () => {
        await expect(page.getByRole('button', { name: new RegExp(`Entrer dans ${absent}`) })).toHaveCount(0);
      });
    }

    await test.step('Vérifier que le module Laboratoire (masqué) n\'est pas proposé', async () => {
      await expect(page.getByRole('button', { name: /Entrer dans Laboratoire/ })).toHaveCount(0);
    });
  });

  for (const { name, url, menu } of MODULE_MENUS) {
    test(`Entrer dans le module ${name} et vérifier son menu`, async ({ portal, page }) => {
      test.skip(isOptional(name) && !hasModule(name), isOptional(name) ? withoutModuleReason(name) : '');
      await test.step(`Cliquer sur la carte "${name}"`, async () => {
        await portal.enterModule(name);
        await page.waitForURL(url);
      });

      await test.step('Vérifier les entrées du menu latéral', async () => {
        await portal.expectMenuItems(menu);
      });
    });
  }

  test('Rechercher une page depuis la barre de recherche du portail', async ({ portal, page }) => {
    test.skip(!hasModule('Facturation'), withoutModuleReason('Facturation'));
    await test.step('Rechercher "Factures garants"', async () => {
      await portal.search('garants');
      await expect(portal.searchResult('Factures garants')).toBeVisible();
    });

    await test.step('Ouvrir le résultat et arriver sur la page correspondante', async () => {
      await portal.searchResult('Factures garants').click();
      await page.waitForURL('**/billing/billings-garants');
      await expect(portal.moduleSwitcher).toContainText('Facturation');
    });
  });

  test('Rechercher un terme inconnu affiche un message vide', async ({ portal, page }) => {
    await portal.search('zzzz-introuvable');
    await expect(page.getByText(/Aucun module ni aucune page ne correspond/)).toBeVisible();
  });

  test('Changer de module depuis le menu latéral puis revenir au portail', async ({ portal, page }) => {
    // Base patients : présent dans toutes les structures (Facturation est absente de certaines)
    await test.step('Entrer dans le module Base patients', async () => {
      await portal.enterModule('Base patients');
    });

    await test.step('Basculer vers le module Reporting via "Changer de module"', async () => {
      await portal.switchModule('Reporting');
      await page.waitForURL('**/my-space/reporting/prestations');
    });

    await test.step('Revenir à la liste de tous les modules', async () => {
      await portal.backToAllModules();
    });
  });

  // Le panneau latéral du portail (astuces, support, lien de configuration) est masqué dans
  // l'application (ModuleLauncherComponent.showSide = false) : il n'est donc pas testé.

  test('Raccourcis clavier : "/" place le curseur dans la recherche', async ({ portal, page }) => {
    await page.locator('body').click({ position: { x: 5, y: 300 } });
    await page.keyboard.press('/');
    await expect(portal.searchBox).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(portal.searchBox).toHaveValue('');
  });

  test('Raccourcis clavier : "1" entre dans le premier module', async ({ portal, page }) => {
    await page.locator('body').click({ position: { x: 5, y: 300 } });
    await page.keyboard.press('1');
    await expect(portal.moduleSwitcher).toContainText(ADMIN_MODULES[0]);
    await page.waitForURL('**/patient/patients');
  });

  test('Accéder au changement de mot de passe depuis le portail', async ({ portal, page }) => {
    await portal.changePasswordLink.click();
    await page.waitForURL('**/auth/change-password');
  });

  test('Se déconnecter depuis le portail', async ({ portal, page }) => {
    await test.step('Cliquer sur le bouton de déconnexion', async () => {
      await portal.logout();
    });

    await test.step("Vérifier qu'une page protégée renvoie vers la connexion", async () => {
      await page.goto('/modules');
      await page.waitForURL('**/auth/**');
      await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
    });
  });
});
