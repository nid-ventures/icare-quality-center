import { test as base, expect } from '@playwright/test';
import { PortalPage } from '../pages/structure/portal/portal.page';

type StructureFixtures = {
  /** Allonge le délai de chaque test quand le ralenti SLOWMO est activé (cf. playwright.config.ts). */
  slowMoTimeout: void;
  /**
   * Portail iCare déjà ouvert (`/modules`) avec la session administrateur partagée
   * (storageState écrit par auth.setup.ts). Chaque test part donc d'un état connecté.
   */
  portal: PortalPage;
};

export const test = base.extend<StructureFixtures>({
  slowMoTimeout: [async ({}, use, testInfo) => {
    if (Number(process.env.SLOWMO) > 0) {
      testInfo.setTimeout(testInfo.timeout * 4);
    }
    await use();
  }, { auto: true }],
  portal: async ({ page }, use) => {
    const portal = new PortalPage(page);
    await portal.goto();
    await use(portal);
  },
});

export { expect };
