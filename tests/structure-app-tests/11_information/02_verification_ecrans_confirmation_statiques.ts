// tests/structure-app-tests/11_information/02_verification_ecrans_confirmation_statiques.ts
import { test } from '@playwright/test';
import { PatientConfirmPage } from '../../../pages/structure/information/patient-confirm.page';

// Ces écrans ne sont normalement atteints qu'après redirection suite à la soumission du
// consentement (codes 200/201/406/208, cf. patient-confirm.component.ts). En l'absence
// d'un vrai couple hi_code/UUID patient permettant de déclencher ce parcours complet
// contre le backend live (non accessible depuis ce contexte de test statique), on
// vérifie ici directement le rendu de chaque écran statique par navigation directe.
test('Vérification du contenu des écrans statiques du module information', async ({ page }) => {
  const patientConfirmPage = new PatientConfirmPage(page);

  await test.step("Écran 'consentement accepté'", async () => {
    await patientConfirmPage.gotoApproved();
    await patientConfirmPage.expectApprovedContent();
  });

  await test.step("Écran 'consentement refusé'", async () => {
    await patientConfirmPage.gotoRefused();
    await patientConfirmPage.expectRefusedContent();
  });

  await test.step("Écran 'consentement expiré'", async () => {
    await patientConfirmPage.gotoExpired();
    await patientConfirmPage.expectExpiredContent();
  });

  await test.step("Écran 'consentement déjà pris en compte'", async () => {
    await patientConfirmPage.gotoAlready();
    await patientConfirmPage.expectAlreadyContent();
  });

  await test.step("Écran d'accueil du module information (infos)", async () => {
    await patientConfirmPage.gotoInfos();
    await patientConfirmPage.expectInfosContent();
  });
});
