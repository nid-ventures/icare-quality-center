import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/structure/login.page';
import { DashboardPage } from '../../pages/structure/dashboard.page';
import { PatientPage } from '../../pages/structure/patient.page';
import { DetailPatientPage, ContactPersonData } from '../../pages/structure/detail_administratif';
import { ContactPersonGenerator } from '../../pages/structure/contact-person-generator';

const adminUser = {
  username: 'hi-admin',
  hicode: 'NEST',
  password: 'BcIsX7V&ZRh7',
};

test('Ajouter une personne à contacter pour un patient', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const patientPage = new PatientPage(page);
  const detailPatientPage = new DetailPatientPage(page);

  // Génération des données dynamiques
  const contactData: ContactPersonData = ContactPersonGenerator.generate();

  await test.step('Connexion', async () => {
    await loginPage.goto();
    await loginPage.login(adminUser.username, adminUser.hicode, adminUser.password);
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