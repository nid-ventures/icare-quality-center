import { type Page } from '@playwright/test';

/**
 * Bandeau affiché en bas de l'écran pendant les tests visuels (SLOWMO > 0, cf. "npm run test:visuel")
 * pour savoir quelle fonctionnalité est en cours : module › rubrique, test, étape.
 *
 * Il est rendu dans un shadow DOM *fermé*, marqué aria-hidden et sans événements de pointeur :
 * les sélecteurs Playwright (getByText, getByRole…) ne le voient pas et il n'intercepte aucun clic.
 * Le contenu est conservé dans sessionStorage pour survivre aux navigations ; il est aussi injecté
 * dès l'ouverture de la page du test, pour être visible sans attendre le premier chargement.
 * Les dernières étapes restent affichées (la plus récente en vert) pour pouvoir être lues même
 * quand elles s'enchaînent vite.
 */
export type VisualNote = { context: string; test: string; steps?: string[] };

export const visualNotesEnabled = () => Number(process.env.SLOWMO) > 0;

/** Pause de lecture à chaque nouvelle étape en mode visuel (VISUAL_PAUSE ms, 1500 par défaut). */
export const visualPause = () => (visualNotesEnabled() ? Number(process.env.VISUAL_PAUSE ?? 1500) : 0);

/** Nombre d'étapes gardées à l'écran. */
export const VISIBLE_STEPS = 3;

const STORAGE_KEY = '__qaVisualNote';

function initScript([storageKey, initial]: [string, string]) {
  // sessionStorage est inaccessible sur certaines pages (about:blank…) : on ignore alors le bandeau.
  const read = () => { try { return sessionStorage.getItem(storageKey); } catch { return null; } };
  // Nouvelle page de test : la note du test est connue avant le premier chargement.
  try { if (initial && !sessionStorage.getItem(storageKey)) sessionStorage.setItem(storageKey, initial); } catch { /* idem */ }
  let root: ShadowRoot | null = null;
  const render = () => {
    const raw = read();
    if (!raw || !document.documentElement) return;
    if (!root) {
      const host = document.createElement('qa-visual-note');
      host.setAttribute('aria-hidden', 'true');
      host.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483647;pointer-events:none;';
      root = host.attachShadow({ mode: 'closed' });
      document.documentElement.appendChild(host);
    }
    const note = JSON.parse(raw) as { context: string; test: string; steps?: string[] };
    const escape = (value: string) => value.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
    const steps = note.steps ?? [];
    root.innerHTML = `
      <style>
        .box { background: rgba(17, 24, 39, .92); color: #fff; padding: 12px 20px; border-radius: 10px;
               font: 15px/1.5 system-ui, "Segoe UI", sans-serif; max-width: 75vw; text-align: center;
               box-shadow: 0 6px 20px rgba(0, 0, 0, .35); border-left: 4px solid #22c55e; }
        .ctx { font-size: 12px; opacity: .75; text-transform: uppercase; letter-spacing: .04em; }
        .test { font-weight: 600; font-size: 16px; }
        .step { color: #86efac; font-weight: 600; }
        .done { color: #9ca3af; font-size: 13px; }
      </style>
      <div class="box">
        <div class="ctx">${escape(note.context)}</div>
        <div class="test">${escape(note.test)}</div>
        ${steps.map((s, i) => i === steps.length - 1
          ? `<div class="step">▶ ${escape(s)}</div>`
          : `<div class="done">✓ ${escape(s)}</div>`).join('')}
      </div>`;
  };
  (window as unknown as { __qaRenderVisualNote: () => void }).__qaRenderVisualNote = render;
  document.addEventListener('DOMContentLoaded', render);
  render();
}

export async function installVisualNotes(page: Page, initial?: VisualNote) {
  await page.addInitScript(initScript, [STORAGE_KEY, initial ? JSON.stringify(initial) : ''] as [string, string]);
}

export async function showVisualNote(page: Page, note: VisualNote) {
  await page.evaluate(([storageKey, value]) => {
    sessionStorage.setItem(storageKey, JSON.stringify(value));
    (window as unknown as { __qaRenderVisualNote?: () => void }).__qaRenderVisualNote?.();
  }, [STORAGE_KEY, note] as const).catch(() => {
    // Page en cours de navigation : le bandeau sera redessiné au chargement suivant.
  });
}
