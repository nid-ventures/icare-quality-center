import { type Page } from '@playwright/test';
import { PortalPage } from '../pages/structure/portal/portal.page';

/** Accès à l'API de la structure avec la session ouverte dans `page` (comme le front). */
export type StructureApi = {
  base: string;
  /** Référentiels et données de session du front (localStorage), lus en JSON. */
  storage: <T = any>(key: string, fallback?: T) => Promise<T>;
  call: (method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, data?: unknown) => Promise<{ status: number; json: any }>;
};

/** Ouvre Base patients pour lire l'adresse de l'API (elle dépend de l'environnement). */
export async function structureApi(page: Page): Promise<StructureApi> {
  const portal = new PortalPage(page);
  await portal.goto();
  const first = page.waitForResponse(r => r.url().includes('/nid-api/v1/patients/getAll'), { timeout: 60000 });
  await portal.enterModule('Base patients');
  const url = (await first).url();
  const base = url.slice(0, url.indexOf('/nid-api/v1/') + '/nid-api/v1'.length);
  const storage = async <T>(key: string, fallback?: T): Promise<T> => {
    const raw = await page.evaluate(k => localStorage.getItem(k), key);
    if (raw === null) return fallback as T;
    try { return JSON.parse(raw) as T; } catch { return raw as unknown as T; }
  };
  const call: StructureApi['call'] = async (method, path, data) => {
    const session = await page.evaluate(() => ({ token: localStorage.getItem('access_token') ?? '', hiCode: localStorage.getItem('x_hi_code') ?? '' }));
    const res = await page.request.fetch(`${base}${path}`, {
      method,
      headers: { Authorization: `Bearer ${session.token}`, 'X-HI-CODE': session.hiCode, 'Content-Type': 'application/json' },
      data: data === undefined ? undefined : data,
    });
    return { status: res.status(), json: await res.json().catch(() => ({})) };
  };
  return { base, storage, call };
}

/** Recharge la page et attend le rechargement des référentiels de session (après un ajout). */
export async function reloadConfigs(page: Page) {
  const loaded = page.waitForResponse(r => r.url().includes('/modules/loadconfigs'), { timeout: 60000 });
  await page.reload();
  await loaded;
}
