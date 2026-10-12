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
export async function fillAllFields(page: Page, root: Locator, label = 'QA'): Promise<FieldSnapshot> {
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
  return snapshotFields(root);
}

/**
 * Valeurs affichées des champs visibles d'un formulaire, par nom de champ (et rang parmi les
 * champs de même nom, ex. fiches foetus) : `nom#rang` -> valeur affichée. Le gestionnaire de
 * prescriptions et les pièces jointes sont exclus.
 */
export type FieldSnapshot = Record<string, string>;

export async function snapshotFields(root: Locator): Promise<FieldSnapshot> {
  return root.locator('[formcontrolname]').evaluateAll((els: HTMLElement[]) => {
    const snapshot: Record<string, string> = {};
    const ranks: Record<string, number> = {};
    for (const el of els) {
      if (el.getClientRects().length === 0 || el.closest('app-prescription-manager')) continue;
      const input = el as HTMLInputElement;
      if (el.tagName === 'INPUT' && (input.type === 'file' || input.type === 'hidden')) continue;
      const name = el.getAttribute('formcontrolname') ?? '';
      let value: string;
      if (el.tagName === 'NG-SELECT') {
        value = Array.from(el.querySelectorAll('.ng-value-label')).map(l => (l.textContent ?? '').trim()).filter(Boolean).join(' | ');
      } else if (el.tagName === 'SELECT') {
        value = ((el as HTMLSelectElement).selectedOptions[0]?.textContent ?? '').trim();
      } else if (input.type === 'checkbox') {
        value = String(input.checked);
      } else if (input.type === 'radio') {
        if (!input.checked) continue;
        value = input.value;
      } else {
        value = (input.value ?? '').trim();
      }
      const rank = ranks[name] = (ranks[name] ?? -1) + 1;
      snapshot[`${name}#${rank}`] = value.replace(/\s+/g, ' ');
    }
    return snapshot;
  });
}

/**
 * Écarts entre les valeurs saisies (`expected`) et celles réaffichées à la réouverture : liste
 * "champ : attendu ≠ affiché" (vide si tout est conservé). `ignore` : champs recalculés par
 * l'application (ex. description d'une consultation, réécrite avec le résumé des prescriptions).
 */
export async function keptFieldsDiff(root: Locator, expected: FieldSnapshot, ignore: string[] = []): Promise<string[]> {
  const actual = await snapshotFields(root);
  const diffs: string[] = [];
  for (const [key, value] of Object.entries(expected)) {
    const name = key.split('#')[0];
    if (!value || ignore.includes(name)) continue;
    const shown = actual[key];
    // Liste à choix multiples ("a | b | c") : mêmes valeurs, quel que soit l'ordre réaffiché
    const asSet = (v: string) => v.split(' | ').map(x => x.toLowerCase()).sort().join(' | ');
    const same = shown !== undefined && (shown === value || asSet(shown) === asSet(value)
      || (!isNaN(Number(shown)) && !isNaN(Number(value)) && Number(shown) === Number(value))
      || shown.toLowerCase() === value.toLowerCase());
    if (!same) diffs.push(`${key} : saisi "${value}" ≠ réaffiché "${shown ?? '(champ absent)'}"`);
  }
  return diffs;
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
