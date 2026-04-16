import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { PatientPage } from '../../../pages/structure/patient/patient.page';
import { DetailPatientPage } from '../../../pages/structure/patient/detail_administratif.page';
import { CareData, PatientCarePage } from '../../../pages/structure/patient/patient-care.page';
import { CareDataGenerator } from '../../../pages/structure/generator/care-data-generator';

const adminUser = {
  username: 'hi-admin',
  hicode: 'NEST',
  password: 'BcIsX7V&ZRh7',
};

test('Ajouter une prise en charge pour un patient', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const patientPage = new PatientPage(page);
  const detailPatientPage = new DetailPatientPage(page);
  const carePage = new PatientCarePage(page);

  const careData: CareData = CareDataGenerator.generate();

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


  await test.step('Onglet Prise en charge', async () => {
    await carePage.goToCareTab();
  });

  await test.step('Ouvrir modal une prise en charge', async () => {
    await carePage.openAddCareModal();

  });
  await test.step('Saisir modal une prise en charge', async () => {
    await carePage.fillCareForm(careData);
  });
  await test.step('Enregistrer une prise en charge', async () => {

    await carePage.saveCare();
  });


});