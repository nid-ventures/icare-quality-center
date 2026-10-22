import fs from 'fs';

// Structure (tenant) testée : choisie par son code à la connexion (variable TENANT, nest par
// défaut), comme le fait un utilisateur dans « Sélectionnez votre établissement » :
//   npx cross-env TEST_ENV=local TENANT=mcad npx playwright test --project=structure-app
// Rien n'est décrit à la main : le projet « setup » (auth.setup.ts) relève à la connexion le nom de
// la structure, son code d'API, l'administrateur, les modules du portail et les autres structures,
// et les enregistre dans un fichier propre à la structure, lu ici par les tests.
// Ce module ne dépend pas du fichier .env : playwright.config.ts peut l'importer.

/** Modules que certaines structures n'ont pas (le front les retire selon la structure). */
export type OptionalModule = 'Facturation' | 'Honoraires' | 'Rendez-vous';

/** Code de la structure testée (celui affiché « Code : … » à la connexion). */
export const TENANT = (process.env.TENANT || 'nest').trim().toLowerCase();

export interface StructureRef {
  /** Code affiché à la connexion (« Code : nest ») */
  code: string;
  /** Nom affiché à la connexion */
  name: string;
  /** Code de l'API (en-tête X-HI-CODE) */
  hiCode: string;
}

export interface StructureContext extends StructureRef {
  /** Nom de l'administrateur de test dans cette structure (sa fiche personnel lui est propre) */
  adminFullName: string;
  /** Modules proposés sur le portail */
  modules: string[];
  /** Autres structures proposées au même compte (tests d'isolation) */
  others: StructureRef[];
}

/** Session de l'administrateur, un fichier par structure (NEST garde le chemin historique). */
export function adminStorageState(code: string = TENANT): string {
  return code === 'nest' ? 'playwright/.auth/structure-admin.json' : `playwright/.auth/structure-admin-${code}.json`;
}

/** Informations relevées à la connexion, un fichier par structure. */
export function structureContextPath(code: string = TENANT): string {
  return `playwright/.auth/structure-${code}.json`;
}

export function saveStructureContext(context: StructureContext): void {
  fs.mkdirSync('playwright/.auth', { recursive: true });
  fs.writeFileSync(structureContextPath(context.code), JSON.stringify(context, null, 2));
  cached = context;
}

let cached: StructureContext | undefined;

/**
 * Informations de la structure testée. Avant la première connexion (liste des tests faite par
 * Playwright avant le projet « setup »), le fichier peut manquer : valeurs neutres, tous modules.
 */
export function structure(): StructureContext {
  if (cached) return cached;
  const path = structureContextPath();
  if (!fs.existsSync(path)) {
    return { code: TENANT, name: TENANT, hiCode: TENANT.toUpperCase(), adminFullName: '', modules: [], others: [] };
  }
  cached = JSON.parse(fs.readFileSync(path, 'utf8')) as StructureContext;
  return cached;
}

/** Structure testée (lue à la demande dans le fichier relevé à la connexion). */
export const tenant = {
  get key(): string { return TENANT; },
  get code(): string { return TENANT; },
  get name(): string { return structure().name; },
  get hiCode(): string { return structure().hiCode; },
  get adminFullName(): string { return structure().adminFullName; },
};

/** Autres structures, pour les tests d'isolation. */
export function otherTenants(): StructureRef[] {
  return structure().others;
}

/** La structure testée a-t-elle ce module ? (vrai tant que les modules ne sont pas relevés) */
export function hasModule(name: OptionalModule): boolean {
  const modules = structure().modules;
  return modules.length === 0 || modules.includes(name);
}

/** Modules optionnels absents de la structure testée. */
export function absentModules(): OptionalModule[] {
  return (['Facturation', 'Honoraires', 'Rendez-vous'] as OptionalModule[]).filter(m => !hasModule(m));
}

/** Raison affichée quand un test est ignoré faute de module. */
export function withoutModuleReason(name: OptionalModule): string {
  return `${tenant.name} n'a pas le module ${name}`;
}
