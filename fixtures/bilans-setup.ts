import { type Browser } from '@playwright/test';
import { ADMIN_STORAGE_STATE } from '../test-data/structure-users';
import { structureApi, type StructureApi } from './structure-api';
import { ensureFreshAdminSession } from './admin-login';

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
 * moins un type de bilan a déjà des analyses dans la structure. Renvoie les analyses ajoutées.
 */
export async function addBilanAnalyses(api: StructureApi): Promise<string[]> {
  const analyses = await api.storage<Ref[]>('ANALYSE', []);
  const referential = await api.storage<{ code: number; refdataType: string; speciality: string }[]>('billactActSpeciality', []);
  const acts = await api.storage<{ code: number; type: string }[]>('hiBillactActs', []);
  const structureAnalyses = acts.filter(a => a.type === 'ANALYSE').map(a => a.code);
  const linked = (a: Ref) => (a.parentCode ?? '').split(',').map(c => c.trim()).filter(Boolean);
  // Au moins une analyse de la structure rattachée à un type de bilan : rien à préparer
  if (analyses.some(a => structureAnalyses.includes(a.code) && linked(a).length > 0)) return [];

  // Analyses déjà présentes mais désactivées : le backend refuse de les ajouter une seconde fois
  const { json: all } = await api.call('GET', '/his/billableacts');
  const present = (Array.isArray(all?.result) ? all.result as { code: number; type: string }[] : []).filter(a => a.type === 'ANALYSE').map(a => a.code);
  const candidates = analyses.filter(a => linked(a).includes(BILAN_PRENATAL) && !structureAnalyses.includes(a.code) && !present.includes(a.code)).slice(0, ANALYSES_TO_ADD);
  if (candidates.length === 0) throw new Error(`Aucune analyse du référentiel rattachée au bilan ${BILAN_PRENATAL}`);
  const specialityOf = (code: number) => {
    const ref = referential.find(r => r.refdataType === 'ANALYSE' && r.code === code);
    return Number((ref?.speciality ?? '0').split(',').map(s => s.trim()).filter(Boolean)[0]) || 0;
  };
  const body = candidates.map(a => ({
    name: a.display.toLocaleLowerCase(), code: a.code, countable: a.countable ?? true, parentCode: a.parentCode,
    specialities: [specialityOf(a.code)], active: true, type: 'ANALYSE',
  }));
  const { status, json } = await api.call('POST', '/his/billableacts', body);
  if (json?.code !== 201) throw new Error(`Ajout des analyses refusé : HTTP ${status} ${JSON.stringify(json).slice(0, 200)}`);
  return candidates.map(a => a.display);
}

/** Même vérification depuis un spec (beforeAll), dans un contexte de navigateur à part. */
export async function ensureBilanAnalyses(browser: Browser): Promise<number> {
  await ensureFreshAdminSession(browser);
  const context = await browser.newContext({ baseURL: process.env.BASE_URL, storageState: ADMIN_STORAGE_STATE, viewport: null, ignoreHTTPSErrors: true });
  try {
    const page = await context.newPage();
    return (await addBilanAnalyses(await structureApi(page))).length;
  } finally {
    await context.close();
  }
}
