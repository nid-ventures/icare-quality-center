import { type Page, type APIResponse } from '@playwright/test';
import { test, expect } from '../../fixtures/structure.fixture';
import { type PortalPage } from '../../pages/structure/portal/portal.page';
import { tenant, otherTenants, type Tenant } from '../../test-data/tenants';

/**
 * Isolation entre structures (plateforme multitenant) : une donnée de la structure testée (TENANT)
 * ne doit jamais être visible depuis une autre structure. Vérifié par l'API, frontière réelle des
 * structures (en-tête X-HI-CODE), avec la session de l'administrateur de la structure testée.
 * Chaque cas vérifie d'abord que la donnée est bien trouvée dans sa propre structure (contrôle),
 * puis qu'elle est introuvable avec le code de chacune des autres structures.
 */

type Api = { base: string; token: string };

/** Adresse de l'API (lue sur l'appel de la liste des patients) et jeton de la session ouverte. */
async function api(page: Page, portal: PortalPage): Promise<Api> {
  const first = page.waitForResponse(r => r.url().includes('/nid-api/v1/patients/getAll'), { timeout: 60000 });
  await portal.enterModule('Base patients');
  const url = (await first).url();
  const base = url.slice(0, url.indexOf('/nid-api/v1/') + '/nid-api/v1'.length);
  const token = await page.evaluate(() => localStorage.getItem('access_token') ?? '');
  expect(token, 'Session ouverte').toBeTruthy();
  return { base, token };
}

function headers(a: Api, target: Tenant | string) {
  return { Authorization: `Bearer ${a.token}`, 'X-HI-CODE': typeof target === 'string' ? target : target.hiCode, 'Content-Type': 'application/json' };
}

async function body(res: APIResponse): Promise<any> {
  return res.json().catch(() => ({}));
}

/** Recherche de patients par identifiant dans la structure `target`. */
async function patientsByIdentifier(page: Page, a: Api, target: Tenant, identifier: string): Promise<any[]> {
  const res = await page.request.post(`${a.base}/patients/getAll`, {
    headers: headers(a, target),
    data: { active: true, page: 1, size: 20, firstName: '', lastName: '', email: '', doB: 0, patientIdentifier: identifier, nidIdentifier: '', middleName: '', sex: null, phone: '', city: null, tz: 0, gender: 0, inactive: false },
  });
  const json = await body(res);
  return json?.result?.data ?? [];
}

/** Factures patients par numéro dans la structure `target`. */
async function invoicesByOrder(page: Page, a: Api, target: Tenant, invoiceOrder: string | null): Promise<any[]> {
  const res = await page.request.post(`${a.base}/invoices/patients`, { headers: headers(a, target), data: { pageNo: 1, pageSize: 20, invoiceOrder } });
  const json = await body(res);
  const data = json?.result?.data;
  return (Array.isArray(data) ? data : data?.value ?? data ?? []) as any[];
}

test.describe(`Isolation entre structures — données de ${tenant.name}`, () => {
  test.describe.configure({ mode: 'serial' });

  test('Un patient de la structure est introuvable depuis les autres structures', async ({ portal, page }) => {
    const a = await api(page, portal);
    const [patient] = await patientsByIdentifier(page, a, tenant, '');
    test.skip(!patient, `Aucun patient dans ${tenant.name}`);
    const identifier: string = patient.identifier;

    await test.step(`Contrôle : trouvé dans ${tenant.name}`, async () => {
      expect((await patientsByIdentifier(page, a, tenant, identifier)).map(p => p.id), 'Patient trouvé dans sa structure').toContain(patient.id);
    });
    for (const other of otherTenants) {
      await test.step(`Introuvable depuis ${other.name}`, async () => {
        const found = await patientsByIdentifier(page, a, other, identifier);
        expect(found.map(p => p.id), `Recherche par identifiant depuis ${other.key}`).not.toContain(patient.id);
        const direct = await page.request.get(`${a.base}/patients/${patient.id}`, { headers: headers(a, other) });
        const json = await body(direct);
        const leaked = direct.ok() && json?.code === 200 && json?.result?.id === patient.id;
        expect(leaked, `Accès direct au patient ${patient.id} depuis ${other.key} (HTTP ${direct.status()}, code ${json?.code})`).toBe(false);
      });
    }
  });

  test('Une facture de la structure est introuvable depuis les autres structures', async ({ portal, page }) => {
    const a = await api(page, portal);
    const [invoice] = await invoicesByOrder(page, a, tenant, null);
    test.skip(!invoice, `Aucune facture dans ${tenant.name}`);
    const order: string = invoice.invoiceOrder;

    await test.step(`Contrôle : trouvée dans ${tenant.name}`, async () => {
      expect((await invoicesByOrder(page, a, tenant, order)).map(i => i.invoiceOrder), 'Facture trouvée dans sa structure').toContain(order);
    });
    for (const other of otherTenants) {
      await test.step(`Introuvable depuis ${other.name}`, async () => {
        const found = await invoicesByOrder(page, a, other, order);
        expect(found.map(i => i.id), `Recherche de la facture ${order} depuis ${other.key}`).not.toContain(invoice.id);
      });
    }
  });

  test('Un code de structure inconnu est refusé', async ({ portal, page }) => {
    const a = await api(page, portal);
    const res = await page.request.post(`${a.base}/patients/getAll`, { headers: headers(a, 'STRUCTURE-INCONNUE-QA'), data: { active: true, page: 1, size: 1 } });
    const json = await body(res);
    const data = json?.result?.data ?? [];
    expect(res.ok() && json?.code === 200 && data.length > 0, `Structure inconnue (HTTP ${res.status()}, code ${json?.code})`).toBe(false);
  });
});
