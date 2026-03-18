import { test } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { MedecinsPage } from '../pages/medecins.page';
import { StructuresPage } from '../pages/structures.page';
import { UtilisateursPage } from '../pages/utilisateurs.page';
import users from '../test-data/users.json';

for (const user of users) {
 
  test(`Vérification des modules de l'application par l'utilisateur ${user.expectedName}`, async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const medecinsPage = new MedecinsPage(page);
    const structuresPage = new StructuresPage(page);
    const utilisateursPage = new UtilisateursPage(page);

    await test.step('Ouverture de la page de connexion', async()=> {
      await loginPage.goto();
     })
    await test.step('connexion', async()=> { 
      await loginPage.login(process.env.USER_EMAIL!, process.env.USER_PASSWORD!);
     })

    await test.step('Vérification du module médecins', async()=> {
      await medecinsPage.searchMedecin("MEDECIN")
      await medecinsPage.expectMedecinVisible("TESTEUR MEDECIN")
    })

    await test.step('Vérification du module structures', async()=> {
      await dashboardPage.goToStructures();
      await structuresPage.expectStructureVisible(user.expectedStructure);
    })

    await test.step('Vérification du module utilisateurs', async()=> {
      await dashboardPage.goToUtilisateurs();
      await utilisateursPage.expectUserVisible(user.expectedUser);      
    })
  });
}
