import { type Browser } from '@playwright/test';
import { PortalPage } from '../pages/structure/portal/portal.page';
import { ADMIN_STORAGE_STATE } from '../test-data/structure-users';

/** Type de bilan dont les analyses sont ajoutées si besoin (code du référentiel BILAN : prénatal). */
const BILAN_PRENATAL = '141';
/** Nombre d'analyses ajoutées aux actes de la structure quand aucun type de bilan n'en a. */
const ANALYSES_TO_ADD = 3;

type Ref = { code: number; display: string; parentCode?: string; countable?: boolean };

/**
 * Un bilan présélectionne les analyses que la structure a parmi ses actes facturables (domaine
 * ANALYSE) et qui sont rattachées à son type. Certaines structures n'en ont aucune (cabinet
 * paramédical…) : on ajoute alors quelques analyses du référentiel rattachées au bilan prénatal,
 * comme le ferait un administrateur dans Administration > Paramètres > Actes. Ne fait rien si au
 * moins un type de bilan a déjà des analyses dans la structure. Renvoie le nombre d'actes ajoutés.
 */
export async function ensureBilanAnalyses(browser: Browser): Promise<number> {
  const context = await browser.newContext({ baseURL: process.env.BASE_URL, storageState: ADMIN_STORAGE_STATE, viewport: null, ignoreHTTPSErrors: true });
  try {
    const page = await context.newPage();
    const portal = new PortalPage(page);
    await portal.goto();
    // Adresse de l'API lue sur un appel du front (elle dépend de l'environnement)
    const call = page.waitForResponse(r => r.url().includes('/nid-api/v1/patients/getAll'), { timeout: 60000 });
    await portal.enterModule('Base patients');
    const url = (await call).url();
    const api = url.slice(0, url.indexOf('/nid-api/v1/') + '/nid-api/v1'.length);

    const ls = await page.evaluate(() => ({
      token: localStorage.getItem('access_token') ?? '',
      hiCode: localStorage.getItem('x_hi_code') ?? '',
      analyses: JSON.parse(localStorage.getItem('ANALYSE') ?? '[]'),
      referential: JSON.parse(localStorage.getItem('billactActSpeciality') ?? '[]'),
      acts: JSON.parse(localStorage.getItem('hiBillactActs') ?? '[]'),
    }));
    const analyses = ls.analyses as Ref[];
    const structureAnalyses = (ls.acts as { code: number; type: string }[]).filter(a => a.type === 'ANALYSE').map(a => a.code);
    const linked = (a: Ref) => (a.parentCode ?? '').split(',').map(c => c.trim()).filter(Boolean);
    // Au moins une analyse de la structure rattachée à un type de bilan : rien à préparer
    if (analyses.some(a => structureAnalyses.includes(a.code) && linked(a).length > 0)) return 0;

    const candidates = analyses.filter(a => linked(a).includes(BILAN_PRENATAL) && !structureAnalyses.includes(a.code)).slice(0, ANALYSES_TO_ADD);
    if (candidates.length === 0) throw new Error(`Aucune analyse du référentiel rattachée au bilan ${BILAN_PRENATAL}`);
    const specialityOf = (code: number) => {
      const ref = (ls.referential as { code: number; refdataType: string; speciality: string }[]).find(r => r.refdataType === 'ANALYSE' && r.code === code);
      return Number((ref?.speciality ?? '0').split(',')[0]) || 0;
    };
    const body = candidates.map(a => ({
      name: a.display.toLocaleLowerCase(), code: a.code, countable: a.countable ?? true, parentCode: a.parentCode,
      specialities: [specialityOf(a.code)], active: true, type: 'ANALYSE',
    }));
    const res = await page.request.post(`${api}/his/billableacts`, {
      headers: { Authorization: `Bearer ${ls.token}`, 'X-HI-CODE': ls.hiCode, 'Content-Type': 'application/json' },
      data: body,
    });
    const json = await res.json().catch(() => ({}));
    if (json?.code !== 201) throw new Error(`Ajout des analyses refusé : HTTP ${res.status()} ${JSON.stringify(json).slice(0, 200)}`);
    return candidates.length;
  } finally {
    await context.close();
  }
}
