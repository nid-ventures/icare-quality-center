import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { PatientPage } from '../../../pages/structure/patient/patient.page';
import { ContactPersonData, DetailPatientPage } from '../../../pages/structure/patient/detail_administratif.page';
import { ContactPersonGenerator } from '../../../pages/structure/generator/contact-person-generator';
const adminUser = {
  username: 'hi-admin@gmail.com',
  hi: 'NEST FOR ALL',
  password: 'BcIsX7V&ZRh7',
  role: 'Administrateur'
};
test('Ajouter une personne à contacter pour un patient', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const patientPage = new PatientPage(page);
  const detailPatientPage = new DetailPatientPage(page);

  // Génération des données dynamiques
  const contactData: ContactPersonData = ContactPersonGenerator.generate();

  await test.step('Ouverture de la page de connexion', async () => {
    await loginPage.goto();
  })
  await test.step('connexion', async () => {
    await loginPage.login(adminUser.username, adminUser.password);

  })
  await test.step('Sélection de la structure', async () => {
    await loginPage.selectStructure(adminUser.hi);
  });

  await test.step('Sélectionner le premier patient', async () => {
    await patientPage.chooseFirstPatient();
  });

  await test.step('Accéder aux détails administratifs', async () => {
    await detailPatientPage.gotoDetailsPatient();
  });

  await test.step('Onglet Personne à contacter', async () => {
    await detailPatientPage.goToPersonContactTab();
  });

  await test.step('Ouvrir le modal d’ajout', async () => {
    await detailPatientPage.openAddPersonModal();
  });

  await test.step('Remplir le formulaire avec des données dynamiques', async () => {
    await detailPatientPage.fillPersonContactForm(contactData);
  });

  await test.step('Sauvegarder et vérifier l’ajout', async () => {
    await detailPatientPage.savePersonContact();

  });
});