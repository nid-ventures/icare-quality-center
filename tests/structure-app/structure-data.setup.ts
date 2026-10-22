import { test as setup, expect } from '@playwright/test';
import { structureApi, type StructureApi } from '../../fixtures/structure-api';
import { loginAdminAndSave } from '../../fixtures/admin-login';
import { addBilanAnalyses } from '../../fixtures/bilans-setup';
import { ACTS, ACT_REFS, INSURER, INSURER_REF } from '../../test-data/cover-scenarios';
import { adminUser } from '../../test-data/structure-users';
import { hasModule, saveStructureContext, structure, tenant } from '../../test-data/tenants';

/**
 * Données dont les tests ont besoin dans la structure testée, ajoutées seulement si elles
 * manquent (comme le ferait un administrateur dans Administration > Paramètres) :
 *  - les actes facturables des scénarios de prise en charge (référentiel commun) ;
 *  - le garant des scénarios (AMSA), ajouté ou réactivé ;
 *  - des analyses rattachées à un type de bilan (présélection des bilans) ;
 *  - la spécialité des relevés d'honoraires, choisie parmi les soignants de la structure.
 * Les référentiels de la structure étant chargés à la connexion, la session est refaite si
 * quelque chose a été ajouté.
 */

type Ref = { code: number; display: string; name?: string; parentCode?: string; countable?: boolean };
type StructureAct = { code: number; type: string; active?: boolean };

/** Spécialité du référentiel associée à un acte (premier code de billactActSpeciality). */
async function specialityOf(api: StructureApi, type: string, code: number): Promise<number> {
  const referential = await api.storage<{ code: number; refdataType: string; speciality: string }[]>('billactActSpeciality', []);
  const ref = referential.find(r => r.refdataType === type && r.code === code);
  return Number((ref?.speciality ?? '').split(',').map(s => s.trim()).filter(Boolean)[0]) || 0;
}

/**
 * Actes des scénarios absents de la structure : réactivés s'ils y sont désactivés (le backend
 * refuse d'ajouter un acte déjà présent), ajoutés sinon. Renvoie ce qui a été fait.
 */
async function ensureScenarioActs(api: StructureApi): Promise<string[]> {
  // Tous les actes de la structure, désactivés compris (la session ne garde que les actifs)
  const { json: all } = await api.call('GET', '/his/billableacts');
  const acts: (StructureAct & { id: number })[] = Array.isArray(all?.result) ? all.result : [];
  const find = (key: keyof typeof ACTS) => acts.filter(a => a.type === ACT_REFS[key].type && a.code === ACT_REFS[key].code);
  const keys = (Object.keys(ACT_REFS) as (keyof typeof ACTS)[]).filter(key => !find(key).some(a => a.active !== false));
  const done: string[] = [];
  const missing: (keyof typeof ACTS)[] = [];
  for (const key of keys) {
    const inactive = find(key)[0];
    if (!inactive) { missing.push(key); continue; }
    // Bascule actif / désactivé (bouton de la liste Administration > Paramètres > Actes)
    const res = await api.call('DELETE', `/his/billableacts/${inactive.id}`);
    expect(res.status, `Réactivation de l'acte ${ACTS[key].act}`).toBeLessThan(300);
    done.push(`${ACTS[key].act} réactivé`);
  }
  if (missing.length === 0) return done;
  const body = [];
  for (const key of missing) {
    const { type, code } = ACT_REFS[key];
    const ref = (await api.storage<Ref[]>(type, [])).find(r => r.code === code);
    expect(ref, `Acte ${type} ${code} (${ACTS[key].act}) dans le référentiel`).toBeDefined();
    body.push({
      name: (ref!.name ?? ref!.display).toLocaleLowerCase(), code, countable: ref!.countable ?? false,
      parentCode: ref!.parentCode ?? String(code), specialities: [await specialityOf(api, type, code)], active: true, type,
    });
  }
  const { status, json } = await api.call('POST', '/his/billableacts', body);
  expect(json?.code, `Ajout des actes ${missing.join(', ')} (HTTP ${status}) ${JSON.stringify(json).slice(0, 200)}`).toBe(201);
  return [...done, ...missing.map(key => `${ACTS[key].act} ajouté`)];
}

/**
 * En facturation, un acte ne propose que les praticiens de ses spécialités (sauf 0 « Toutes les
 * spécialités » et 30). Un acte des scénarios qu'aucun soignant actif de la structure ne peut
 * réaliser (consultation cardiologique sans cardiologue…) est ouvert à toutes les spécialités,
 * comme le ferait l'administrateur dans Paramètres > Actes.
 */
async function openScenarioActsToCaregivers(api: StructureApi): Promise<string[]> {
  const caregivers = await api.storage<{ active: boolean; specialities: number[] }[]>('caregivers', []);
  const available = new Set(caregivers.filter(c => c.active).flatMap(c => (c.specialities ?? []).map(Number)));
  const { json } = await api.call('GET', '/his/billableacts');
  const acts: (StructureAct & { id: number; name: string; specialities?: number[] })[] = Array.isArray(json?.result) ? json.result : [];
  const done: string[] = [];
  for (const key of Object.keys(ACT_REFS) as (keyof typeof ACTS)[]) {
    const act = acts.find(a => a.type === ACT_REFS[key].type && a.code === ACT_REFS[key].code && a.active !== false);
    const specialities = (act?.specialities ?? []).map(Number);
    if (!act || specialities.length === 0 || specialities.some(s => s === 0 || s === 30 || available.has(s))) continue;
    const res = await api.call('PUT', '/his/billableacts', { ...act, specialities: [0] });
    expect(res.json?.code, `Acte ${ACTS[key].act} ouvert à toutes les spécialités (HTTP ${res.status}) ${JSON.stringify(res.json).slice(0, 200)}`).toBe(200);
    done.push(`${ACTS[key].act} ouvert à toutes les spécialités`);
  }
  return done;
}

/** Garant des scénarios : ajouté s'il manque, réactivé s'il est désactivé. */
async function ensureInsurer(api: StructureApi): Promise<string | null> {
  const { json } = await api.call('GET', '/his/garants');
  const garants: { id: number; code: string | number; active?: boolean }[] = Array.isArray(json?.result) ? json.result : [];
  const garant = garants.find(g => String(g.code) === INSURER_REF.code);
  if (garant && garant.active !== false) return null;
  if (garant) {
    // Bascule actif / désactivé (bouton « Activer » de la liste des garants)
    const res = await api.call('DELETE', `/his/garants/${garant.id}`);
    expect(res.status, `Réactivation du garant ${INSURER}`).toBeLessThan(300);
    return `${INSURER} réactivé`;
  }
  const createdBy = await api.storage<string>('id', '');
  const res = await api.call('POST', '/his/garants', {
    id: null, name: INSURER, code: INSURER_REF.code, type: INSURER_REF.type,
    personCoverFullname: '', personCoverPhone: '', personCoverEmail: '', createdBy: String(createdBy),
  });
  expect(res.json?.code, `Ajout du garant ${INSURER} (HTTP ${res.status}) ${JSON.stringify(res.json).slice(0, 200)}`).toBe(201);
  return `${INSURER} ajouté`;
}

/**
 * Spécialité des relevés d'honoraires : pédiatrie si un soignant l'a, sinon celle du plus grand
 * nombre de soignants ayant au moins deux actes de la structure. Les soignants ne se créent pas
 * depuis l'application ; l'administrateur (parfois soignant aussi) n'est jamais retenu, un test le
 * désactiverait.
 */
async function honoraireSpeciality(api: StructureApi): Promise<string> {
  const caregivers = await api.storage<{ fullName: string; username: string; active: boolean; specialities: number[] }[]>('caregivers', []);
  const specialities = await api.storage<Ref[]>('SPECIALITY', []);
  const acts = await api.storage<{ specialities: number[] }[]>('hiBillactActs', []);
  const admin = (name: string) => name.replace(/\s+/g, ' ').trim().toLowerCase() === tenant.adminFullName.replace(/\s+/g, ' ').trim().toLowerCase();
  const doctors = caregivers.filter(c => c.active && c.username !== adminUser.username && !admin(c.fullName));
  const count = new Map<number, number>();
  for (const d of doctors) for (const s of d.specialities ?? []) count.set(s, (count.get(s) ?? 0) + 1);
  const label = (code: number) => specialities.find(s => s.code === code)?.display ?? '';
  const pediatrie = [...count.keys()].find(c => /pédiatrie/i.test(label(c)));
  const actsOf = (code: number) => acts.filter(a => a.specialities?.includes(code)).length;
  const chosen = pediatrie ?? [...count.entries()]
    .filter(([code]) => actsOf(code) >= 2 && label(code))
    .sort((a, b) => b[1] - a[1] || actsOf(b[0]) - actsOf(a[0]))[0]?.[0];
  expect(chosen, `Un soignant (autre que l'administrateur) avec une spécialité ayant des actes dans ${tenant.name}`).toBeDefined();
  return label(chosen!);
}

setup('Données de la structure nécessaires aux tests', async ({ page }) => {
  setup.setTimeout(Number(process.env.SLOWMO) > 0 ? 600000 : 180000);
  const api = await structureApi(page);
  const added: string[] = [];

  if (hasModule('Facturation')) {
    added.push(...await ensureScenarioActs(api));
    added.push(...await openScenarioActsToCaregivers(api));
    const insurer = await ensureInsurer(api);
    if (insurer) added.push(insurer);
  }
  const analyses = await addBilanAnalyses(api);
  if (analyses.length) added.push(...analyses);

  if (added.length) {
    setup.info().annotations.push({ type: 'Ajouté à la structure', description: added.join(' ; ') });
    // Référentiels (actes, garants) chargés à la connexion : nouvelle session à jour
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await loginAdminAndSave(page);
  }

  if (hasModule('Honoraires')) {
    const speciality = await honoraireSpeciality(api);
    saveStructureContext({ ...structure(), honoraireSpeciality: speciality });
    setup.info().annotations.push({ type: 'Spécialité des honoraires', description: speciality });
  }
});
