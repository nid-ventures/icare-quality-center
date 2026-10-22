import { type Locator } from '@playwright/test';

/**
 * Vide le consultant d'un formulaire d'acte (ng-select `caregiverId` dans `scope`) s'il est
 * prérempli. L'application préremplit le consultant avec l'utilisateur connecté quand il est
 * soignant : c'est le cas de l'administrateur de test dans certaines structures, pas dans d'autres.
 * À appeler avant de vérifier qu'un enregistrement sans consultant est refusé.
 */
export async function clearPrefilledConsultant(scope: Locator): Promise<void> {
  const clear = scope.locator('ng-select[formcontrolname="caregiverId"] .ng-clear-wrapper').first();
  if (await clear.isVisible().catch(() => false)) await clear.click();
}
