import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Description d'un champ de formulaire de consultation, repéré par son formControlName.
 * - text / number / date / textarea : valeur saisie, relue telle quelle (number : comparaison numérique)
 * - radio : valeur de l'option à cocher (attribut value)
 * - checkbox : état coché attendu
 * - select : ng-select à choix unique ; `option` = libellé à choisir (sinon la 1re option disponible)
 * - multiselect : ng-select multiple ; `options` = libellés à choisir, complétés par les premières
 *   options libres jusqu'à `count`
 */
export type FieldSpec =
  | { name: string; kind: 'text' | 'number' | 'date' | 'textarea'; value: string }
  | { name: string; kind: 'radio'; value: string }
  | { name: string; kind: 'checkbox'; value: boolean }
  | { name: string; kind: 'select'; option?: string; index?: number }
  | { name: string; kind: 'multiselect'; count?: number; options?: string[] };

/** Valeurs réellement retenues pour les listes (libellés choisis), pour la vérification ultérieure. */
export type FilledValues = Record<string, string | string[] | boolean>;

/**
 * Remplissage et vérification génériques des formulaires de consultation (création et
 * modification), champ par champ, à partir de leur formControlName. Permet de couvrir tous les
 * champs d'un formulaire et de contrôler, après enregistrement et réouverture, que chaque valeur
 * a bien été conservée.
 */
export class ConsultationFormPage {
  constructor(private readonly page: Page, private readonly root: Locator) {}

  private control(name: string): Locator {
    return this.root.locator(`[formcontrolname="${name}"]`);
  }

  /**
   * Referme la liste d'un ng-select si elle est restée ouverte, en cliquant sur sa flèche : la
   * touche Échap fermerait aussi la fenêtre Bootstrap qui contient le formulaire (vaccination,
   * bilan…). La plupart des ng-select se referment d'eux-mêmes après le choix.
   */
  private async closeDropdown(select: Locator) {
    const panel = this.page.locator('.ng-dropdown-panel');
    if (await panel.first().isVisible().catch(() => false)) {
      await select.locator('.ng-arrow-wrapper').click().catch(() => {});
    }
    await panel.first().waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  }

  /**
   * Choisit une option d'ng-select. Le clic natif peut ne jamais devenir "actionnable" sur
   * certaines longues listes : on déclenche alors directement l'événement click de l'option
   * (gestionnaire Angular de ng-select). La valeur retenue est vérifiée par l'appelant.
   */
  private async pick(option: Locator) {
    await option.click({ timeout: 5000 }).catch(() => option.dispatchEvent('click'));
  }

  private async openDropdown(select: Locator) {
    await select.scrollIntoViewIfNeeded();
    await select.locator('.ng-select-container').click();
    await this.page.locator('.ng-dropdown-panel .ng-option').first().waitFor({ state: 'visible', timeout: 10000 });
  }

  /** Remplit les champs dans l'ordre donné (placer d'abord les choix qui affichent d'autres champs). */
  async fill(fields: FieldSpec[]): Promise<FilledValues> {
    const filled: FilledValues = {};
    for (const field of fields) {
      const control = this.control(field.name);
      switch (field.kind) {
        case 'text':
        case 'number':
        case 'date':
        case 'textarea': {
          const input = control.first();
          await expect(input, `Champ "${field.name}" attendu dans le formulaire`).toBeVisible();
          await input.fill(field.value);
          filled[field.name] = field.value;
          break;
        }
        case 'radio': {
          const radio = this.root.locator(`input[type="radio"][formcontrolname="${field.name}"][value="${field.value}"]`);
          await expect(radio, `Option "${field.value}" du champ "${field.name}"`).toBeAttached();
          // Certains boutons radio sont masqués derrière un habillage (label stylé) : clic DOM direct,
          // qui déclenche l'événement change écouté par Angular.
          if (await radio.isVisible()) await radio.check();
          else await radio.evaluate((el: HTMLInputElement) => el.click());
          await expect(radio).toBeChecked();
          filled[field.name] = field.value;
          break;
        }
        case 'checkbox': {
          const checkbox = control.first();
          await expect(checkbox, `Case "${field.name}"`).toBeAttached();
          if (await checkbox.isVisible()) await checkbox.setChecked(field.value);
          else if ((await checkbox.isChecked()) !== field.value) await checkbox.evaluate((el: HTMLInputElement) => el.click());
          await expect(checkbox).toBeChecked({ checked: field.value });
          filled[field.name] = field.value;
          break;
        }
        case 'select': {
          const select = control.first();
          await expect(select, `Liste "${field.name}"`).toBeVisible();
          // Liste déroulante native (<select>) : choix par libellé ou par position.
          if (await select.evaluate(el => el.tagName === 'SELECT')) {
            const nativeOptions = select.locator('option:not([disabled])');
            const nativeCount = await nativeOptions.count();
            const nativeOption = field.option
              ? nativeOptions.filter({ hasText: field.option }).first()
              : nativeOptions.nth(Math.min(field.index ?? 0, nativeCount - 1));
            const nativeLabel = ((await nativeOption.textContent()) ?? '').replace(/\s+/g, ' ').trim();
            await select.selectOption({ label: ((await nativeOption.textContent()) ?? '').trim() });
            filled[field.name] = nativeLabel;
            break;
          }
          await this.openDropdown(select);
          const options = this.page.locator('.ng-dropdown-panel .ng-option:not(.ng-option-disabled)');
          // Par libellé, sinon par position (index), en restant dans les options disponibles.
          const count = await options.count();
          const option = field.option
            ? options.filter({ hasText: field.option }).first()
            : options.nth(Math.min(field.index ?? 0, count - 1));
          const label = ((await option.textContent()) ?? '').replace(/\s+/g, ' ').trim();
          await this.pick(option);
          await this.closeDropdown(select);
          await expect(select.locator('.ng-value'), `Valeur choisie pour "${field.name}"`).toContainText(label, { ignoreCase: true });
          filled[field.name] = label;
          break;
        }
        case 'multiselect': {
          const select = control.first();
          await expect(select, `Liste multiple "${field.name}"`).toBeVisible();
          const labels: string[] = [];
          const wanted = field.options ?? [];
          const total = Math.max(field.count ?? 0, wanted.length);
          for (let i = 0; i < total; i++) {
            await this.openDropdown(select);
            // Les options déjà choisies sont marquées .ng-option-selected : on prend la suivante libre.
            const free = this.page.locator('.ng-dropdown-panel .ng-option:not(.ng-option-disabled):not(.ng-option-selected)');
            const option = i < wanted.length
              ? free.filter({ hasText: new RegExp(`^\\s*${escapeRegExp(wanted[i])}\\s*$`) }).first()
              : free.first();
            const label = ((await option.textContent()) ?? '').replace(/\s+/g, ' ').trim();
            labels.push(label);
            await this.pick(option);
            await this.closeDropdown(select);
            await expect(select.locator('.ng-value').filter({ hasText: new RegExp(escapeRegExp(label), 'i') }), `Valeur "${label}" ajoutée à "${field.name}"`).toHaveCount(1);
          }
          filled[field.name] = labels;
          break;
        }
      }
    }
    return filled;
  }

  /**
   * Formulaire de modification : bouton "Activer" / "Verrouiller". Si on active avant la fin du
   * chargement de la consultation, le rechargement re-désactive le formulaire alors que le bouton
   * affiche déjà "Verrouiller" : on rebascule tant que le champ témoin reste grisé.
   */
  async activate(probeField: string) {
    const toggle = this.root.getByRole('button', { name: /^\W*(Activer|Verrouiller)$/ }).first();
    const probe = this.control(probeField).first();
    await expect(toggle).toBeVisible({ timeout: 15000 });
    await expect(async () => {
      if (/Verrouiller/.test(await toggle.innerText())) await toggle.click();
      await toggle.click();
      await expect(probe).toBeEnabled({ timeout: 3000 });
      // Les données de la consultation peuvent arriver après le clic : leur chargement reverrouille
      // le formulaire (patchValue puis disable). On vérifie qu'il reste modifiable, sinon on recommence.
      await this.page.waitForTimeout(1000);
      await expect(probe).toBeEnabled({ timeout: 500 });
    }).toPass({ timeout: 30000 });
  }

  /** Enregistre une nouvelle consultation ("Enregistrer la consultation") et confirme. */
  async saveNew() {
    await this.root.getByRole('button', { name: /Enregistrer la consultation/ }).click();
    await this.confirm();
  }

  /** Enregistre les modifications ("Mettre à jour…") et confirme. */
  async saveUpdate() {
    await this.root.getByRole('button', { name: /^\W*Mettre à jour/ }).click();
    await this.confirm();
  }

  /** Supprime la consultation ouverte (bouton d'action, pas ceux des prescriptions) et confirme. */
  async deleteConsultation() {
    await this.root.locator('button:not([title])').filter({ hasText: /^\s*Supprimer\s*$/ }).first().click();
    await this.confirm();
  }

  private async confirm() {
    const confirm = this.page.getByRole('button', { name: /^\W*Confirmer$/ }).last();
    await expect(confirm).toBeVisible({ timeout: 10000 });
    await confirm.click();
    await expect(confirm).toBeHidden({ timeout: 20000 });
  }

  /** Vérifie, après réouverture de la consultation, que chaque champ a conservé sa valeur. */
  async expectValues(fields: FieldSpec[], filled: FilledValues) {
    for (const field of fields) {
      const expected = filled[field.name];
      const control = this.control(field.name);
      switch (field.kind) {
        case 'number': {
          const value = await control.first().inputValue();
          expect(Number(value), `Champ "${field.name}"`).toBeCloseTo(Number(expected), 2);
          break;
        }
        case 'text':
        case 'date':
        case 'textarea':
          await expect(control.first(), `Champ "${field.name}"`).toHaveValue(expected as string);
          break;
        case 'radio':
          await expect(this.root.locator(`input[type="radio"][formcontrolname="${field.name}"][value="${expected}"]`),
            `Option du champ "${field.name}"`).toBeChecked();
          break;
        case 'checkbox':
          await expect(control.first(), `Case "${field.name}"`).toBeChecked({ checked: expected as boolean });
          break;
        case 'select': {
          const select = control.first();
          if (await select.evaluate(el => el.tagName === 'SELECT')) {
            const selected = await select.evaluate((el: HTMLSelectElement) => el.selectedOptions[0]?.textContent?.replace(/\s+/g, ' ').trim() ?? '');
            expect(selected.toLowerCase(), `Liste "${field.name}"`).toBe((expected as string).toLowerCase());
          } else {
            await expect(select.locator('.ng-value'), `Liste "${field.name}"`).toContainText(expected as string, { ignoreCase: true });
          }
          break;
        }
        case 'multiselect':
          for (const label of expected as string[]) {
            await expect(control.first().locator('.ng-value').filter({ hasText: new RegExp(escapeRegExp(label), 'i') }), `Liste "${field.name}" : ${label}`).toHaveCount(1);
          }
          break;
      }
    }
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
