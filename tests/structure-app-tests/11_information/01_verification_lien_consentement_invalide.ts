// tests/structure-app-tests/11_information/01_verification_lien_consentement_invalide.ts
import { test } from '@playwright/test';
import { PatientConfirmPage } from '../../../pages/structure/information/patient-confirm.page';

// Ce test ne nécessite AUCUNE connexion : la route /information/consentement_patient/:id
// n'est pas protégée par authGuard (cf. src/app/app.routes.ts).
//
// PatientConfirmComponent décode l'id via js-base64 `decode(...)`, le sépare sur "=" en
// [hi_code, patientUUID], puis valide patientUUID avec uuid.validate(). Sans accès à une
// vraie base patient, il est impossible de fabriquer un id qui aboutirait à un succès
// (retour 200/201/406/208) côté backend live. Ce test se concentre donc sur le chemin
// `invalidCredentials`, entièrement déterminé côté client, qui ne dépend d'aucun appel
// serveur réussi.
test('Vérification du blocage de la confirmation avec un lien de consentement invalide', async ({ page }) => {
  const patientConfirmPage = new PatientConfirmPage(page);
  const invalidId = PatientConfirmPage.buildInvalidId();

  await test.step("Ouverture de l'écran de consentement avec un id mal formé", async () => {
    await patientConfirmPage.gotoConsentement(invalidId);
    await patientConfirmPage.expectConfirmScreenLoaded();
  });

  await test.step("Sélectionner \"J'accepte\"", async () => {
    await patientConfirmPage.selectAccept();
  });

  await test.step('Vérifier que le bouton Confirmer reste désactivé (id invalide)', async () => {
    await patientConfirmPage.expectConfirmButtonDisabled();
  });
});
