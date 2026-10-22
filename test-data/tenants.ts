// Structures (tenants) de la plateforme sur lesquelles la suite peut tourner. Une exécution teste
// une seule structure, choisie par la variable TENANT (nest par défaut) :
//   npx cross-env TEST_ENV=local TENANT=mcad npx playwright test --project=structure-app
// Ce module ne dépend pas du fichier .env : playwright.config.ts peut l'importer.

export type TenantKey = 'nest' | 'mboursaly' | 'mcad';

export interface Tenant {
  key: TenantKey;
  /** Nom affiché dans la fenêtre « Sélectionnez votre établissement » */
  name: string;
  /** Code de la structure (en-tête X-HI-CODE de l'API, en majuscules) */
  hiCode: string;
  /** Nom de l'administrateur de test dans cette structure (fiche personnel propre à chaque structure) */
  adminFullName: string;
  /**
   * Modules absents de cette structure : le front les retire pour certaines structures
   * (EXCLUS_HIS_INVOICE / EXCLUS_HIS_FEE_STATEMENT dans app-modules.service.ts ; Rendez-vous exige
   * aussi la facturation). Les tests qui en
   * dépendent sont ignorés pour elle.
   */
  withoutModules: OptionalModule[];
}

/** Modules que certaines structures n'ont pas. */
export type OptionalModule = 'Facturation' | 'Honoraires' | 'Rendez-vous';

export const TENANTS: Record<TenantKey, Tenant> = {
  nest: { key: 'nest', name: 'Nest For All', hiCode: 'NEST', adminFullName: 'Test ADMINISTRATEUR STRUCTURE', withoutModules: [] },
  mboursaly: { key: 'mboursaly', name: 'Cabinet Paramédical Mbour Saly', hiCode: 'MBOURSALY', adminFullName: 'Lauriane LE FLOUR', withoutModules: [] },
  mcad: { key: 'mcad', name: 'Maternité du Camp Abdou Diassé', hiCode: 'MCAD', adminFullName: 'Administrateur ICARE', withoutModules: ['Facturation', 'Honoraires', 'Rendez-vous'] },
};

function resolveTenant(): Tenant {
  const key = (process.env.TENANT || 'nest').trim().toLowerCase() as TenantKey;
  const tenant = TENANTS[key];
  if (!tenant) throw new Error(`TENANT inconnu : "${process.env.TENANT}". Valeurs possibles : ${Object.keys(TENANTS).join(', ')}`);
  return tenant;
}

/** Structure testée par cette exécution. */
export const tenant: Tenant = resolveTenant();

/** Autres structures, pour les tests d'isolation. */
export const otherTenants: Tenant[] = Object.values(TENANTS).filter(t => t.key !== tenant.key);

/** La structure testée a-t-elle ce module ? */
export function hasModule(name: OptionalModule): boolean {
  return !tenant.withoutModules.includes(name);
}

/** Raison affichée quand un test est ignoré faute de module. */
export function withoutModuleReason(name: OptionalModule): string {
  return `${tenant.name} n'a pas le module ${name}`;
}

/**
 * Session de l'administrateur, un fichier par structure (jamais de session d'une structure réutilisée
 * dans une autre). NEST garde le chemin historique.
 */
export function adminStorageState(key: TenantKey = tenant.key): string {
  return key === 'nest' ? 'playwright/.auth/structure-admin.json' : `playwright/.auth/structure-admin-${key}.json`;
}
