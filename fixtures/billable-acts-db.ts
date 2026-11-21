import mysql from 'mysql2/promise';
import { test, expect } from '@playwright/test';

/**
 * Lecture seule de la table billable_act de la structure testée (base `hi_<TENANT>`), pour les
 * contrôles en base des actes à facturer : seulement en local (base Docker accessible avec les DB_*
 * de .env.local). Ailleurs, ou si la base ne répond pas, le contrôle est sauté et signalé en annotation.
 */
export type BillableActRow = {
  id: number;
  medical_act_id: number | null;
  invoice_id: number | null;
  medical_billable: string | null;
  status: number;
};

export async function billableActRows(patientIdentifier: string): Promise<BillableActRow[] | null> {
  if ((process.env.TEST_ENV ?? '') !== 'local' || !process.env.DB_HOST) return null;
  let connection: mysql.Connection | undefined;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: `hi_${process.env.TENANT || 'nest'}`,
      ssl: { rejectUnauthorized: false },
      connectTimeout: 10000,
    });
    const [rows] = await connection.query<mysql.RowDataPacket[]>(
      'SELECT id, medical_act_id, invoice_id, medical_billable, status FROM billable_act WHERE patient_identifier = ? ORDER BY id',
      [patientIdentifier],
    );
    return rows.map(r => ({ id: r.id, medical_act_id: r.medical_act_id, invoice_id: r.invoice_id, medical_billable: r.medical_billable, status: Number(r.status) }));
  } catch (error) {
    test.info().annotations.push({ type: 'Contrôle en base sauté', description: String((error as Error).message ?? error).slice(0, 200) });
    return null;
  } finally {
    await connection?.end().catch(() => {});
  }
}

/**
 * Contrôle en base des actes à facturer du patient : aucun acte orphelin (sans acte médical ni
 * facture, non facturé) en dehors de ceux attendus, aucun doublon, et le nombre attendu de lignes
 * rattachées à un acte médical (non facturées / facturées).
 */
export async function expectBillableActsInDb(
  patientIdentifier: string,
  expected: { pending: number; billed: number; orphans?: number },
): Promise<void> {
  await test.step(`Base : ${expected.pending} acte(s) à facturer et ${expected.billed} facturé(s) rattachés, sans orphelin ni doublon`, async () => {
    const rows = await billableActRows(patientIdentifier);
    if (!rows) return;
    const attached = rows.filter(r => r.medical_act_id != null);
    const orphans = rows.filter(r => r.medical_act_id == null && !r.invoice_id && r.status === 0);
    expect.soft(orphans.length, `Actes orphelins (sans acte médical ni facture) : ${JSON.stringify(orphans)}`).toBe(expected.orphans ?? 0);
    expect.soft(attached.filter(r => !r.invoice_id).length, 'Lignes rattachées non facturées').toBe(expected.pending);
    expect.soft(attached.filter(r => !!r.invoice_id).length, 'Lignes rattachées facturées').toBe(expected.billed);
    const keys = attached.map(r => `${r.medical_act_id}/${r.medical_billable}`);
    expect.soft(keys.filter((k, i) => keys.indexOf(k) !== i), 'Doublons (même acte médical, même acte à facturer)').toEqual([]);
  });
}
