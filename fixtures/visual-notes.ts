import { type Page } from '@playwright/test';

/**
 * Bandeau affiché en bas de l'écran pendant les tests visuels (SLOWMO > 0, cf. "npm run test:visuel")
 * pour savoir quelle fonctionnalité est en cours : module › rubrique, test, étape.
 *
 * Il est rendu dans un shadow DOM *fermé*, marqué aria-hidden et sans événements de pointeur :
 * les sélecteurs Playwright (getByText, getByRole…) ne le voient pas et il n'intercepte aucun clic.
 * Le contenu est conservé dans sessionStorage pour survivre aux navigations.
 */
export type VisualNote = { context: string; test: string; step?: string };

export const visualNotesEnabled = () => Number(process.env.SLOWMO) > 0;

const STORAGE_KEY = '__qaVisualNote';

function initScript(storageKey: string) {
  let root: ShadowRoot | null = null;
  const render = () => {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return;
    if (!root) {
      const host = document.createElement('qa-visual-note');
      host.setAttribute('aria-hidden', 'true');
      host.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483647;pointer-events:none;';
      root = host.attachShadow({ mode: 'closed' });
      document.documentElement.appendChild(host);
    }
    const note = JSON.parse(raw) as { context: string; test: string; step?: string };
    const escape = (value: string) => value.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
    root.innerHTML = `
      <style>
        .box { background: rgba(17, 24, 39, .9); color: #fff; padding: 10px 18px; border-radius: 10px;
               font: 14px/1.45 system-ui, "Segoe UI", sans-serif; max-width: 70vw; text-align: center;
               box-shadow: 0 6px 20px rgba(0, 0, 0, .35); border-left: 4px solid #22c55e; }
        .ctx { font-size: 12px; opacity: .75; text-transform: uppercase; letter-spacing: .04em; }
        .test { font-weight: 600; font-size: 15px; }
        .step { color: #86efac; }
      </style>
      <div class="box">
        <div class="ctx">${escape(note.context)}</div>
        <div class="test">${escape(note.test)}</div>
        ${note.step ? `<div class="step">▶ ${escape(note.step)}</div>` : ''}
      </div>`;
  };
  (window as unknown as { __qaRenderVisualNote: () => void }).__qaRenderVisualNote = render;
  document.addEventListener('DOMContentLoaded', render);
  render();
}

export async function installVisualNotes(page: Page) {
  await page.addInitScript(initScript, STORAGE_KEY);
}

export async function showVisualNote(page: Page, note: VisualNote) {
  await page.evaluate(([storageKey, value]) => {
    sessionStorage.setItem(storageKey, JSON.stringify(value));
    (window as unknown as { __qaRenderVisualNote?: () => void }).__qaRenderVisualNote?.();
  }, [STORAGE_KEY, note] as const).catch(() => {
    // Page en cours de navigation : le bandeau sera redessiné au chargement suivant.
  });
}
