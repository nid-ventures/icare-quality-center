/**
 * Scénarios de calcul de la prise en charge à la facturation (étape "Facturation" de l'assistant),
 * avec les montants attendus calculés à la main selon les règles métier :
 * - acte normal : garant = montant × taux global ; patient = le reste ;
 * - acte exclu : 100 % patient ;
 * - cas spécifique : garant = min(montant, plafond de l'acte) × taux de l'acte (taux global si le
 *   taux de l'acte est vide) ; patient = montant − part garant ;
 * - chambre : montant journalier × nombre de jours (plafond d'un cas spécifique appliqué par jour) ;
 * - plafond global : le garant paie au plus le plafond, l'excédent passe au patient.
 * Les montants évitent les demi-unités (arrondis séparés garant / patient, non corrigés).
 */

export type BillableAct = { category: string; act: string };

export const ACTS = {
  cardio: { category: 'ACTE DE CONSULTATION', act: 'CONSULTATION CARDIOLOGIQUE' },
  uro: { category: 'ACTE DE CONSULTATION', act: 'CONSULTATION UROLOGIQUE' },
  echo: { category: "ACTE D'IMAGERIE", act: 'ÉCHOGRAPHIE GYNÉCOLOGIQUE-OBSTÉTRIQUE' },
  accouchement: { category: 'ACTE MÉDICAL', act: 'ACCOUCHEMENT - HONORAIRES GYNÉCOLOGUE' },
  visite: { category: 'ACTE DE VISITE', act: 'VISITE HOSPITALISATION' },
  pharmacie: { category: 'ACTE DE PHARMACIE', act: 'PHARMACIE' },
  chirurgie: { category: 'ACTE DE CHIRURGIE', act: 'EXÉRÈSE DE MICRO-KYSTES - HONORAIRES DERMATOLOGUE' },
  glycemie: { category: "ACTE D'ANALYSE", act: 'GLYCÉMIE' },
  chambre: { category: 'ACTE DE CHAMBRE', act: 'CHAMBRE CATÉGORIE 1' },
} satisfies Record<string, BillableAct>;

/** Acte à facturer : montant (journalier pour une chambre, sur `days` jours). */
export type InvoiceLine = BillableAct & { amount: number; days?: number };

export type CoverConfig = {
  insurer: string;
  rate: number;
  /** Plafond global (absent = sans plafond). */
  cap?: number;
  excluded?: BillableAct[];
  specifics?: (BillableAct & { rate?: number; cap?: number })[];
};

export type CoverScenario = {
  title: string;
  /** Absent : facture sans prise en charge. */
  cover?: CoverConfig;
  lines: InvoiceLine[];
  expected: { garant: number; patient: number };
  /** Anomalie connue de l'application : le test est attendu en échec (test.fail). */
  anomaly?: string;
};

export const INSURER = 'AMSA ASSURANCE (ASSURANCE)';

const line = (act: BillableAct, amount: number, days?: number): InvoiceLine => ({ ...act, amount, days });

export const COVER_SCENARIOS: CoverScenario[] = [
  {
    title: 'Sans prise en charge : tout est à la charge du patient',
    lines: [line(ACTS.cardio, 10000), line(ACTS.pharmacie, 2000)],
    expected: { garant: 0, patient: 12000 },
  },
  {
    title: 'Actes normaux : taux global, sans plafond',
    cover: { insurer: INSURER, rate: 80 },
    lines: [line(ACTS.cardio, 10000), line(ACTS.pharmacie, 5000)],
    // 15 000 × 80 % = 12 000
    expected: { garant: 12000, patient: 3000 },
  },
  {
    title: 'Taux global de 100 %',
    cover: { insurer: INSURER, rate: 100 },
    lines: [line(ACTS.cardio, 10000)],
    // Corrigé côté backend : la facture patient est créée même à 0.
    expected: { garant: 10000, patient: 0 },
  },
  {
    title: 'Acte exclu : entièrement à la charge du patient',
    cover: { insurer: INSURER, rate: 80, excluded: [ACTS.accouchement] },
    lines: [line(ACTS.cardio, 10000), line(ACTS.accouchement, 20000)],
    // cardio 8 000 / 2 000 ; accouchement 0 / 20 000
    expected: { garant: 8000, patient: 22000 },
  },
  {
    title: "Cas spécifique avec son propre taux, sans plafond d'acte",
    cover: { insurer: INSURER, rate: 80, specifics: [{ ...ACTS.uro, rate: 30 }] },
    lines: [line(ACTS.uro, 8000), line(ACTS.cardio, 10000)],
    // uro 8 000 × 30 % = 2 400 / 5 600 ; cardio 8 000 / 2 000
    expected: { garant: 10400, patient: 7600 },
  },
  {
    title: "Cas spécifique sans taux : taux global appliqué au plafond de l'acte",
    cover: { insurer: INSURER, rate: 80, specifics: [{ ...ACTS.cardio, cap: 4000 }] },
    lines: [line(ACTS.cardio, 10000)],
    // min(10 000 ; 4 000) × 80 % = 3 200
    expected: { garant: 3200, patient: 6800 },
  },
  {
    title: "Cas spécifique : plafond de l'acte inférieur au montant",
    cover: { insurer: INSURER, rate: 80, specifics: [{ ...ACTS.echo, rate: 50, cap: 6000 }] },
    lines: [line(ACTS.echo, 10000)],
    // min(10 000 ; 6 000) × 50 % = 3 000
    expected: { garant: 3000, patient: 7000 },
  },
  {
    title: "Cas spécifique : plafond de l'acte supérieur au montant (sans effet)",
    cover: { insurer: INSURER, rate: 80, specifics: [{ ...ACTS.echo, rate: 50, cap: 20000 }] },
    lines: [line(ACTS.echo, 10000)],
    // min(10 000 ; 20 000) × 50 % = 5 000
    expected: { garant: 5000, patient: 5000 },
  },
  {
    title: 'Chambre sur plusieurs jours : montant journalier × jours au taux global',
    cover: { insurer: INSURER, rate: 80 },
    lines: [line(ACTS.chambre, 10000, 4)],
    // 4 × 10 000 = 40 000 × 80 %
    expected: { garant: 32000, patient: 8000 },
  },
  {
    title: 'Chambre en cas spécifique : plafond appliqué par jour',
    cover: { insurer: INSURER, rate: 80, specifics: [{ ...ACTS.chambre, rate: 50, cap: 4000 }] },
    lines: [line(ACTS.chambre, 12000, 4)],
    // par jour min(12 000 ; 4 000) × 50 % = 2 000, × 4 = 8 000 ; total 48 000
    expected: { garant: 8000, patient: 40000 },
  },
  {
    title: 'Chambre exclue : tous les jours à la charge du patient',
    cover: { insurer: INSURER, rate: 80, excluded: [ACTS.chambre] },
    lines: [line(ACTS.chambre, 10000, 4), line(ACTS.cardio, 10000)],
    // chambre 0 / 40 000 ; cardio 8 000 / 2 000
    expected: { garant: 8000, patient: 42000 },
  },
  {
    title: 'Même acte facturé deux fois : chaque occurrence plafonnée séparément',
    cover: { insurer: INSURER, rate: 80, specifics: [{ ...ACTS.cardio, rate: 100, cap: 3000 }] },
    lines: [line(ACTS.cardio, 4000), line(ACTS.cardio, 9000)],
    // 3 000 / 1 000 et 3 000 / 6 000
    expected: { garant: 6000, patient: 7000 },
  },
  {
    title: 'Plafond global non atteint',
    cover: { insurer: INSURER, rate: 80, cap: 50000 },
    lines: [line(ACTS.cardio, 10000)],
    expected: { garant: 8000, patient: 2000 },
  },
  {
    title: "Plafond global atteint : l'excédent passe au patient",
    cover: { insurer: INSURER, rate: 80, cap: 5000 },
    lines: [line(ACTS.cardio, 10000)],
    // garant 8 000 ramené à 5 000 ; patient 2 000 + 3 000
    expected: { garant: 5000, patient: 5000 },
  },
  {
    title: 'Plafond global atteint avec exclus et cas spécifiques (cas de la production)',
    cover: {
      insurer: INSURER, rate: 90, cap: 3000,
      excluded: [ACTS.accouchement],
      specifics: [{ ...ACTS.chambre, rate: 50, cap: 4000 }, { ...ACTS.cardio, cap: 4000 }, { ...ACTS.uro, rate: 30 }],
    },
    lines: [
      line(ACTS.cardio, 3000), line(ACTS.uro, 8000), line(ACTS.echo, 6000), line(ACTS.accouchement, 5000),
      line(ACTS.chambre, 12000, 4), line(ACTS.pharmacie, 2000),
    ],
    // garant avant plafond : 2 700 + 2 400 + 5 400 + 0 + 8 000 + 1 800 = 20 300 → 3 000
    // total 72 000 ; patient = 72 000 − 3 000
    expected: { garant: 3000, patient: 69000 },
  },
  {
    title: 'Toutes les catégories ensemble, avec exclu et cas spécifiques, sans plafond',
    cover: {
      insurer: INSURER, rate: 80,
      excluded: [ACTS.accouchement],
      specifics: [{ ...ACTS.uro, rate: 30 }, { ...ACTS.chambre, rate: 50, cap: 4000 }],
    },
    lines: [
      line(ACTS.cardio, 10000), line(ACTS.uro, 8000), line(ACTS.echo, 6000), line(ACTS.accouchement, 5000),
      line(ACTS.visite, 3000), line(ACTS.pharmacie, 2000), line(ACTS.chirurgie, 20000), line(ACTS.glycemie, 1000),
      line(ACTS.chambre, 12000, 4),
    ],
    // normaux 42 000 → 33 600 / 8 400 ; uro 2 400 / 5 600 ; chambre 8 000 / 40 000 ; exclu 0 / 5 000
    expected: { garant: 44000, patient: 59000 },
  },
];

/** Total facturé d'un scénario (chambre : montant journalier × jours). */
export const scenarioTotal = (s: CoverScenario) => s.lines.reduce((sum, l) => sum + l.amount * (l.days ?? 1), 0);

export type LineShare = { line: InvoiceLine; total: number; garant: number; patient: number };
export type CoverComputation = { total: number; garant: number; patient: number; capReached: boolean; lines: LineShare[] };

/**
 * Calcul de référence des règles métier, indépendant de l'application : parts garant / patient de
 * chaque acte, puis plafond global (le garant paie au plus le plafond, l'excédent au patient).
 */
export function computeCover(lines: InvoiceLine[], cover?: CoverConfig): CoverComputation {
  const same = (a: BillableAct, b: BillableAct) => a.category === b.category && a.act === b.act;
  const shares = lines.map(line => {
    const days = line.days ?? 1;
    const total = line.amount * days;
    if (!cover || cover.excluded?.some(e => same(e, line))) return { line, total, garant: 0, patient: total };
    const specific = cover.specifics?.find(s => same(s, line));
    const rate = specific ? (specific.rate ?? cover.rate) : cover.rate;
    const base = specific?.cap ? Math.min(line.amount, specific.cap) : line.amount;
    const garant = (base * rate / 100) * days;
    return { line, total, garant, patient: total - garant };
  });
  const total = shares.reduce((s, l) => s + l.total, 0);
  const garantBeforeCap = shares.reduce((s, l) => s + l.garant, 0);
  const capReached = !!cover?.cap && garantBeforeCap >= cover.cap;
  const garant = Math.round(capReached ? cover!.cap! : garantBeforeCap);
  return { total, garant, patient: total - garant, capReached, lines: shares };
}
