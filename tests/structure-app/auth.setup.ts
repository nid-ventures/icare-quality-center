import { test as setup } from '@playwright/test';
import { loginAdminAndSave } from '../../fixtures/admin-login';

// Connexion unique de l'administrateur de structure : la session (localStorage : token,
// structure choisie, référentiels) est sauvegardée puis réutilisée par tous les specs.
// La structure est choisie par son code (TENANT) ; ce qu'on en voit à la connexion (nom, code
// d'API, administrateur, modules du portail, autres structures du compte) est relevé pour les tests.
setup('Connexion administrateur structure', async ({ page }) => {
  // Le premier chargement des référentiels (loadconfigs) après une longue inactivité du backend peut
  // dépasser 30 s ; mode visuel (SLOWMO) : chaque action attend SLOWMO ms en plus
  setup.setTimeout(Number(process.env.SLOWMO) > 0 ? 180000 : 90000);
  await loginAdminAndSave(page);
});
