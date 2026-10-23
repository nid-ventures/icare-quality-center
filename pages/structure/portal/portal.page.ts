import { type Page, type Locator, expect } from '@playwright/test';

// Noms affichés des modules métier (cf. AppModulesService.modules côté application).
// "Laboratoire & Imagerie" existe dans le code mais est masqué (canAccess: () => false).
export type ModuleName =
  | 'Base patients'
  | 'Dossier médical'
  | 'Facturation'
  | 'Honoraires'
  | 'Rendez-vous'
  | 'Reporting'
  | 'Administration';

export const ADMIN_MODULES: ModuleName[] = [
  'Base patients',
  'Dossier médical',
  'Facturation',
  'Honoraires',
  'Rendez-vous',
  'Reporting',
  'Administration',
];

/**
 * Portail iCare (`/modules`) : page d'accueil après connexion, listant les modules accessibles,
 * plus le sélecteur "Changer de module" et le menu latéral présents dans chaque module.
 */
export class PortalPage {
  readonly modulesHeading: Locator;
  readonly modulesRegion: Locator;
  readonly searchBox: Locator;
  readonly searchResults: Locator;
  readonly greetingHeading: Locator;
  readonly changePasswordLink: Locator;
  readonly logoutButton: Locator;
  // Éléments communs aux pages internes d'un module
  readonly moduleSwitcher: Locator;
  readonly sideNav: Locator;

  constructor(private readonly page: Page) {
    this.modulesHeading = page.getByRole('heading', { name: 'Vos modules', level: 2 });
    this.modulesRegion = page.getByRole('region', { name: 'Vos modules' });
    this.searchBox = page.getByRole('searchbox', { name: 'Rechercher un module ou une page' });
    this.searchResults = page.getByRole('listbox');
    this.greetingHeading = page.getByRole('heading', { level: 1, name: /^(Bonjour|Bonsoir),/ });
    this.changePasswordLink = page.locator('a[title="Modifier mon mot de passe"]');
    this.logoutButton = page.locator('button[title="Déconnexion"]');
    this.moduleSwitcher = page.getByRole('button', { name: /Changer de module/ });
    this.sideNav = page.locator('nav.iq-sidebar-menu');
  }

  async goto() {
    await this.page.goto('/modules');
    await this.expectLoaded();
  }

  async expectLoaded() {
    await this.page.waitForURL('**/modules');
    await expect(this.modulesHeading).toBeVisible();
    await expect(this.modulesRegion).toBeVisible();
  }

  moduleCard(name: ModuleName): Locator {
    return this.modulesRegion.getByRole('button', { name: `Entrer dans ${name}`, exact: true });
  }

  async expectModulesVisible(names: ModuleName[]) {
    for (const name of names) {
      await expect(this.moduleCard(name), `Le module "${name}" doit être proposé`).toBeVisible();
    }
    await expect(this.page.getByText(`${names.length} disponible${names.length > 1 ? 's' : ''}`)).toBeVisible();
  }

  /** Entre dans un module depuis le portail et attend sa page d'accueil. */
  async enterModule(name: ModuleName) {
    if (!this.page.url().endsWith('/modules')) {
      await this.goto();
    }
    await this.moduleCard(name).click();
    // Le module charge sa page d'accueil avant d'afficher le sélecteur : plus de 5 s si la machine est
    // chargée, bien plus en mode visuel (SLOWMO), comme les autres délais (playwright.config.ts)
    await expect(this.moduleSwitcher).toContainText(name, { timeout: Number(process.env.SLOWMO) > 0 ? 60000 : 20000 });
  }

  /** Ouvre une entrée du menu latéral du module courant (ex: "Factures patients"). */
  async openMenu(label: string | RegExp, expectedUrl?: string) {
    const link = this.sideNav.getByRole('link', { name: typeof label === 'string' ? new RegExp(`${escapeRegExp(label)}$`) : label });
    await link.click();
    if (expectedUrl) {
      await this.page.waitForURL(expectedUrl);
    }
  }

  async expectMenuItems(labels: string[]) {
    for (const label of labels) {
      await expect(this.sideNav.getByRole('link', { name: new RegExp(`${escapeRegExp(label)}$`) })).toBeVisible();
    }
  }

  /** Bascule vers un autre module via le sélecteur "Changer de module" du menu latéral. */
  async switchModule(name: ModuleName) {
    await this.moduleSwitcher.click();
    await this.page.getByRole('menuitem', { name }).click();
    await expect(this.moduleSwitcher).toContainText(name);
  }

  async backToAllModules() {
    await this.moduleSwitcher.click();
    await this.page.getByRole('menuitem', { name: 'Tous les modules' }).click();
    await this.expectLoaded();
  }

  async search(query: string) {
    await this.searchBox.fill(query);
    await expect(this.searchResults).toBeVisible();
  }

  searchResult(label: string): Locator {
    return this.searchResults.getByRole('option', { name: new RegExp(escapeRegExp(label)) });
  }

  async logout() {
    await this.logoutButton.click();
    await this.page.waitForURL('**/auth/login');
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
