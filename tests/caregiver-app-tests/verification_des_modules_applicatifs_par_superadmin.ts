import { test } from '@playwright/test';
import { DashboardPage } from '../../pages/dashboard.page';
import { MedecinsPage } from '../../pages/medecins.page';
import { StructuresPage } from '../../pages/structures.page';
import { UtilisateursPage } from '../../pages/utilisateurs.page';
import users from '../../test-data/users.json';
import { LoginPage } from '../../pages/login.page';


const user : any = users.find(item => item.role === "SUPERADMIN" )
 
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
      await loginPage.login(user.username, user.password);
     })

    await test.step('Vérification du module médecins', async()=> {
      await medecinsPage.searchMedecin("DIALLO")
      await medecinsPage.expectMedecinVisible("Alassane DIALLO")
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
