import { test as base, expect } from '@playwright/test';
import { PortalPage } from '../pages/structure/portal/portal.page';

type StructureFixtures = {
  /**
   * Portail iCare déjà ouvert (`/modules`) avec la session administrateur partagée
   * (storageState écrit par auth.setup.ts). Chaque test part donc d'un état connecté.
   */
  portal: PortalPage;
};

export const test = base.extend<StructureFixtures>({
  portal: async ({ page }, use) => {
    const portal = new PortalPage(page);
    await portal.goto();
    await use(portal);
  },
});

export { expect };
