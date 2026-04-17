import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { PatientPage } from '../../../pages/structure/patient/patient.page';
import { DetailPatientPage } from '../../../pages/structure/patient/detail_administratif.page';

const adminUser = {
  username: 'hi-admin',
  hicode: 'NEST',
  password: 'BcIsX7V&ZRh7',
};

test('Modifier une personne à contacter (région et nationalité)', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const patientPage = new PatientPage(page);
  const detailPatientPage = new DetailPatientPage(page);

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

  await test.step('Modifier la première personne à contacter', async () => {
    await detailPatientPage.modifyFirstContactPerson('50', '32');
  });
});