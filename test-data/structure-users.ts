import { tenant, adminStorageState } from './tenants';

// Comptes utilisés par les tests de l'application structure (hi-icare-patient).
// Les valeurs par défaut correspondent au compte administrateur de test, présent dans chaque
// structure testée ; elles peuvent être surchargées via STRUCTURE_USER_EMAIL / _PASSWORD / _HI.
// La structure choisie à la connexion est celle de la variable TENANT (cf. test-data/tenants.ts).
export const adminUser = {
  username: process.env.STRUCTURE_USER_EMAIL || 'hi-admin@gmail.com',
  password: process.env.STRUCTURE_USER_PASSWORD || 'BcIsX7V&ZRh7',
  hi: process.env.STRUCTURE_USER_HI || tenant.name,
  fullName: tenant.adminFullName,
  role: 'Administrateur',
};

// Fichier de session partagé : écrit par tests/structure-app/auth.setup.ts, réutilisé par
// tous les specs du projet "structure-app" (cf. playwright.config.ts) ; un fichier par structure.
export const ADMIN_STORAGE_STATE = adminStorageState();
