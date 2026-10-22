import { TENANT, tenant, adminStorageState } from './tenants';

// Comptes utilisés par les tests de l'application structure (hi-icare-patient).
// Les valeurs par défaut correspondent au compte administrateur de test, présent dans chaque
// structure testée ; elles peuvent être surchargées via STRUCTURE_USER_EMAIL / _PASSWORD / _HI.
// La structure choisie à la connexion est celle dont le code vaut TENANT (cf. test-data/tenants.ts).
export const adminUser = {
  username: process.env.STRUCTURE_USER_EMAIL || 'hi-admin@gmail.com',
  password: process.env.STRUCTURE_USER_PASSWORD || 'BcIsX7V&ZRh7',
  /** Code de la structure choisie à la connexion (« Code : … ») */
  hi: (process.env.STRUCTURE_USER_HI || TENANT).toLowerCase(),
  /** Nom affiché de l'administrateur, relevé à la connexion */
  get fullName(): string { return tenant.adminFullName; },
  role: 'Administrateur',
};

// Fichier de session partagé : écrit par tests/structure-app/auth.setup.ts, réutilisé par
// tous les specs du projet "structure-app" (cf. playwright.config.ts) ; un fichier par structure.
export const ADMIN_STORAGE_STATE = adminStorageState();
