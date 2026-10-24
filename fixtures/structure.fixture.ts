import { test as base, expect, type Page } from '@playwright/test';
import { PortalPage } from '../pages/structure/portal/portal.page';
import { ensureFreshAdminSession } from './admin-login';
import { ADMIN_STORAGE_STATE } from '../test-data/structure-users';
import { installVisualNotes, showVisualNote, visualNotesEnabled, visualPause, VISIBLE_STEPS, type VisualNote } from './visual-notes';

type StructureFixtures = {
  /** Allonge le délai de chaque test quand le ralenti SLOWMO est activé (cf. playwright.config.ts). */
  slowMoTimeout: void;
  /** Bandeau "module › rubrique / test / étape" affiché pendant les tests visuels (SLOWMO > 0). */
  visualNotes: void;
  /**
   * Portail iCare déjà ouvert (`/modules`) avec la session administrateur partagée
   * (storageState écrit par auth.setup.ts). Chaque test part donc d'un état connecté.
   */
  portal: PortalPage;
};

// Page et bandeau du test en cours (un seul worker, une page par test) : utilisés par test.step.
let currentPage: Page | null = null;
let currentNote: VisualNote | null = null;

export const test = base.extend<StructureFixtures>({
  // Session administrateur refaite avant le contexte du test si son jeton expire bientôt (le front
  // ne le renouvelle pas) ; sans effet pour les tests qui demandent un navigateur déconnecté.
  storageState: async ({ storageState, browser }, use) => {
    if (storageState === ADMIN_STORAGE_STATE) await ensureFreshAdminSession(browser);
    await use(storageState);
  },

  slowMoTimeout: [async ({}, use, testInfo) => {
    if (Number(process.env.SLOWMO) > 0) {
      testInfo.setTimeout(testInfo.timeout * 6);
    }
    await use();
  }, { auto: true }],

  visualNotes: [async ({ page }, use, testInfo) => {
    if (!visualNotesEnabled()) {
      await use();
      return;
    }
    // titlePath : [fichier, "Module …", rubrique(s)…, titre du test]
    const [, ...describes] = testInfo.titlePath.slice(0, -1);
    currentPage = page;
    currentNote = { context: describes.join(' › '), test: testInfo.title, steps: [] };
    await installVisualNotes(page, currentNote);
    page.on('load', () => { if (currentNote) void showVisualNote(page, currentNote); });
    await use();
    currentPage = null;
    currentNote = null;
  }, { auto: true }],

  portal: async ({ page }, use) => {
    const portal = new PortalPage(page);
    await portal.goto();
    await use(portal);
  },
});

// Chaque étape (test.step) s'ajoute au bandeau visuel (les dernières restent affichées), suivie d'une
// courte pause pour laisser le temps de la lire.
const originalStep = test.step.bind(test);
test.step = (async (title: string, body: (...args: any[]) => any, options?: any) =>
  originalStep(title, async (...args: any[]) => {
    if (currentPage && currentNote) {
      currentNote = { ...currentNote, steps: [...(currentNote.steps ?? []), title].slice(-VISIBLE_STEPS) };
      await showVisualNote(currentPage, currentNote);
      const pause = visualPause();
      if (pause > 0) await currentPage.waitForTimeout(pause).catch(() => {});
    }
    return body(...args);
  }, options)) as typeof test.step;

export { expect };
