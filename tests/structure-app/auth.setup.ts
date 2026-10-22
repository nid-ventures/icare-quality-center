import { test as setup } from '@playwright/test';
import { loginAdminAndSave } from '../../fixtures/admin-login';

// Connexion unique de l'administrateur de structure : la session (localStorage : token,
// structure choisie, référentiels) est sauvegardée puis réutilisée par tous les specs.
// La structure est choisie par son code (TENANT) ; ce qu'on en voit à la connexion (nom, code
// d'API, administrateur, modules du portail, autres structures du compte) est relevé pour les tests.
setup('Connexion administrateur structure', async ({ page }) => {
  // Mode visuel (SLOWMO) : chaque action attend SLOWMO ms, 30 s ne suffisent plus toujours
  if (Number(process.env.SLOWMO) > 0) setup.setTimeout(180000);
  await loginAdminAndSave(page);
});
