// Comptes utilisés par les tests de l'application structure (hi-icare-patient).
// Les valeurs par défaut correspondent au compte administrateur de la structure de test ;
// elles peuvent être surchargées par environnement via STRUCTURE_USER_EMAIL / _PASSWORD / _HI.
export const adminUser = {
  username: process.env.STRUCTURE_USER_EMAIL || 'hi-admin@gmail.com',
  password: process.env.STRUCTURE_USER_PASSWORD || 'BcIsX7V&ZRh7',
  hi: process.env.STRUCTURE_USER_HI || 'NEST FOR ALL',
  fullName: 'Test ADMINISTRATEUR STRUCTURE',
  role: 'Administrateur',
};

// Fichier de session partagé : écrit par tests/structure-app/auth.setup.ts, réutilisé par
// tous les specs du projet "structure-app" (cf. playwright.config.ts).
export const ADMIN_STORAGE_STATE = 'playwright/.auth/structure-admin.json';
