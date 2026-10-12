import { type Page, type Locator } from '@playwright/test';

/** Pièce jointe générique (PDF minimal généré en mémoire). */
const ATTACHMENT = {
  name: 'piece-jointe-qa.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4\n%QA iCare\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'),
};

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Remplit tous les champs visibles et modifiables d'un formulaire Angular (attribut
 * formcontrolname), quel que soit le formulaire : utile pour les actes d'un parcours de soins,
 * dont le type de formulaire dépend de l'acte paramétré. Les champs déjà renseignés sont
 * conservés. Deux passes : un choix (case, radio, liste) peut faire apparaître d'autres champs.
 * Le gestionnaire de prescriptions est exclu (il a son propre page object).
 * Les listes ng-select sont refermées par leur flèche et jamais par Échap, qui fermerait la
 * fenêtre Bootstrap contenant le formulaire.
 */
export async function fillAllFields(page: Page, root: Locator, label = 'QA') {
  for (let pass = 0; pass < 2; pass++) {
    const controls = root.locator('[formcontrolname]');
    const count = await controls.count();
    for (let i = 0; i < count; i++) {
      const control = controls.nth(i);
      if (!(await control.isVisible().catch(() => false))) continue;
      const info = await control.evaluate((el: HTMLElement) => ({
        tag: el.tagName.toLowerCase(),
        type: (el as HTMLInputElement).type?.toLowerCase() ?? '',
        name: el.getAttribute('formcontrolname') ?? '',
        inPrescriptions: !!el.closest('app-prescription-manager'),
        disabled: (el as HTMLInputElement).disabled || el.classList.contains('ng-select-disabled')
          || el.hasAttribute('readonly'),
        value: (el as HTMLInputElement).value ?? '',
        checked: (el as HTMLInputElement).checked ?? false,
        multiple: el.classList.contains('ng-select-multiple'),
      })).catch(() => null);
      if (!info || info.inPrescriptions || info.disabled) continue;

      if (info.tag === 'ng-select') {
        // Valeur réellement choisie = libellé non vide (certaines listes affichent la croix
        // d'effacement avec une valeur vide, ex. le consultant d'une consultation de parcours)
        const chosen = (await control.locator('.ng-value-label').allTextContents()).join('').trim();
        if (chosen) continue;
        await pickFirstOption(page, control);
      } else if (info.tag === 'select') {
        const selected = await control.evaluate((el: HTMLSelectElement) => el.selectedIndex);
        const options = control.locator('option:not([disabled])');
        const n = await options.count();
        if (n === 0 || (selected > 0 && info.value)) continue;
        const option = options.nth(n > 1 ? 1 : 0);
        const value = await option.getAttribute('value');
        if (value !== null) await control.selectOption(value).catch(() => {});
        else await control.selectOption({ index: 0 }).catch(() => {});
      } else if (info.tag === 'textarea') {
        if (!info.value) await control.fill(`${info.name} ${label}`);
      } else if (info.tag === 'input') {
        switch (info.type) {
          case 'checkbox':
            if (!info.checked) await control.evaluate((el: HTMLInputElement) => el.click());
            break;
          case 'radio': {
            const group = root.locator(`input[type="radio"][formcontrolname="${info.name}"]`);
            if (await group.evaluateAll((els: HTMLInputElement[]) => els.some(e => e.checked))) break;
            await control.evaluate((el: HTMLInputElement) => el.click());
            break;
          }
          case 'file':
            await control.setInputFiles(ATTACHMENT).catch(() => {});
            break;
          case 'date':
            if (!info.value) await control.fill(today());
            break;
          case 'time':
            if (!info.value) await control.fill('10:00');
            break;
          case 'number':
            if (!info.value) await control.fill('1');
            break;
          case 'email':
            if (!info.value) await control.fill('qa@icare.test');
            break;
          case 'tel':
            if (!info.value) await control.fill('770000000');
            break;
          case 'hidden':
            break;
          default:
            if (!info.value) await control.fill(`${info.name} ${label}`);
        }
      }
    }
  }
}

/** Choisit la première option libre d'une ng-select (sans option : liste ignorée). */
async function pickFirstOption(page: Page, select: Locator) {
  await select.scrollIntoViewIfNeeded().catch(() => {});
  await select.locator('.ng-select-container').click({ timeout: 10000 }).catch(() => {});
  const option = page.locator('.ng-dropdown-panel .ng-option:not(.ng-option-disabled):not(.ng-option-selected)').first();
  if (await option.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
    await option.click({ timeout: 5000 }).catch(() => option.dispatchEvent('click'));
  }
  // Liste restée ouverte (sélection multiple, ou aucune option) : fermeture par la flèche
  const panel = page.locator('.ng-dropdown-panel');
  if (await panel.first().isVisible().catch(() => false)) {
    await select.locator('.ng-arrow-wrapper').click().catch(() => {});
  }
  await panel.first().waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
}
