import { test } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';
import { DashboardPage } from '../../pages/dashboard.page';
import { UtilisateursPage } from '../../pages/utilisateurs.page';
import { MedecinsPage } from '../../pages/medecins.page';
import { PlanningsPage } from '../../pages/plannings.page';
import { cleanupTestUsers } from '../../utils/db.helper';
import users from '../../test-data/users.json';

const superadmin: any = users.find(item => item.role === 'SUPERADMIN');

// Données de test
const adminData = {
  nom: 'AUTO',
  prenom: 'ADMIN',
  structure: 'Clinique Tests Auto',
  username: 'auto.admin@yopmail.com',
  password: 'Passer2026*2026',
};

const medecinData = {
  nom: 'AUTO',
  prenom: 'Medecin',
  temps: '30',
  specialite: 'Pédiatrie',
  structure: 'Clinique Tests Auto',
  username: 'auto.medecin@yopmail.com',
  password: 'Passer2026*2026',
  color: '#d77e7e',
};

const planningDays = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

test.beforeAll(async () => {
  await cleanupTestUsers([adminData.username, medecinData.username]);
});

test.afterAll(async () => {
  await cleanupTestUsers([adminData.username, medecinData.username]);
});

test("Création d'un admin, d'un médecin et de son planning", async ({ page }) => {
  const loginPage = new LoginPage(page);
  const dashboardPage = new DashboardPage(page);
  const utilisateursPage = new UtilisateursPage(page);
  const medecinsPage = new MedecinsPage(page);
  const planningsPage = new PlanningsPage(page);

  await test.step('Connexion en tant que SUPERADMIN', async () => {
    await loginPage.goto();
    await loginPage.login(superadmin.username, superadmin.password);
  });

  await test.step("Création d'un administrateur de structure", async () => {
    await dashboardPage.goToUtilisateurs();
    await utilisateursPage.addAdmin(adminData);
  });

  await test.step("Création d'un médecin", async () => {
    await dashboardPage.goToMedecins();
    await medecinsPage.addMedecin(medecinData);
  });

  await test.step('Déconnexion du SUPERADMIN', async () => {
    await dashboardPage.logout();
  });

  await test.step("Connexion en tant qu'admin de structure", async () => {
    await loginPage.login(adminData.username, adminData.password);
  });

  await test.step('Configuration du planning du médecin', async () => {
    await dashboardPage.goToPlannings();
    await planningsPage.selectMedecin('Medecin AUTO');
    await planningsPage.modifierCreneau();
    for (const day of planningDays) {
      await planningsPage.setMorningSlot(day, '8', '0', '12', '0');
    }
    await planningsPage.appliquerEtConfirmer();
    await page.reload();
  });
});
