import { type FieldSpec } from '../pages/structure/consultation/consultation-form.page';

/** Date au format du champ date (AAAA-MM-JJ), décalée de `days` jours par rapport à aujourd'hui. */
export function isoDate(days = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type Version = 1 | 2;

// ======================================================================
// Consultation prénatale (43 champs). L'ordre compte : les choix qui affichent d'autres
// champs (1re consultation = non, symptôme "Autres", anomalie = oui) viennent avant ceux-ci.
// "Autres" est enregistré sous la forme "Autres : <texte>" et restitué à la réouverture.
// ======================================================================
export function prenatalFields(v: Version): FieldSpec[] {
  const t = v === 1 ? '' : ' (modifié)';
  return [
    { name: 'firstConsultation', kind: 'radio', value: 'non' },
    { name: 'previousConsultationsCount', kind: 'number', value: v === 1 ? '2' : '3' },
    { name: 'dateDerniereRegle', kind: 'date', value: isoDate(v === 1 ? -120 : -125) },
    { name: 'emergency', kind: 'radio', value: v === 1 ? 'non' : 'oui' },
    { name: 'date', kind: 'date', value: isoDate(0) },
    { name: 'caregiverId', kind: 'select', index: v === 1 ? 0 : 1 },
    { name: 'taille', kind: 'number', value: v === 1 ? '165' : '166' },
    { name: 'weight', kind: 'number', value: v === 1 ? '68' : '69' },
    { name: 'weightReport', kind: 'number', value: v === 1 ? '66' : '67' },
    { name: 'temperature', kind: 'text', value: v === 1 ? '37.2' : '37.6' },
    { name: 'ta', kind: 'text', value: v === 1 ? '12/8' : '13/8' },
    { name: 'pulse', kind: 'text', value: v === 1 ? '78' : '82' },
    { name: 'pb', kind: 'number', value: v === 1 ? '28' : '29' },
    ...(v === 1 ? [
      { name: 'symptomes', kind: 'multiselect', options: ['Autres'], count: 2 } as FieldSpec,
      { name: 'autresSymptomes', kind: 'text', value: 'Fatigue persistante QA' } as FieldSpec,
    ] : []),
    { name: 'maf', kind: 'select', index: v === 1 ? 0 : 1 },
    { name: 'signeParticulier', kind: 'text', value: `Aucun signe particulier QA${t}` },
    { name: 'appearance', kind: 'text', value: `Pertes normales QA${t}` },
    ...(v === 1 ? [
      { name: 'examensCliniques', kind: 'multiselect', count: 2 } as FieldSpec,
      { name: 'bandeletteTests', kind: 'multiselect', count: 2 } as FieldSpec,
    ] : []),
    { name: 'echoDate1', kind: 'date', value: isoDate(v === 1 ? -90 : -91) },
    { name: 'echoDate2', kind: 'date', value: isoDate(v === 1 ? -60 : -61) },
    { name: 'echoDate3', kind: 'date', value: isoDate(v === 1 ? -30 : -31) },
    { name: 'echoDateLast', kind: 'date', value: isoDate(v === 1 ? -7 : -6) },
    { name: 'echoPoidsBebe', kind: 'number', value: v === 1 ? '1500' : '1650' },
    { name: 'echoBip', kind: 'number', value: v === 1 ? '75' : '78' },
    { name: 'echoPerimetreCranien', kind: 'number', value: v === 1 ? '280' : '285' },
    { name: 'echoRythmeCardiaque', kind: 'number', value: v === 1 ? '140' : '145' },
    { name: 'echoAutresMesures', kind: 'text', value: `LF 55 mm QA${t}` },
    { name: 'echoPositionBebe', kind: 'radio', value: v === 1 ? 'tete' : 'siege' },
    { name: 'echoAnomalies', kind: 'radio', value: 'oui' },
    { name: 'echoPrecisionAnomalies', kind: 'text', value: `Hydramnios léger QA${t}` },
    ...(v === 1 ? [{ name: 'traitementsConseils', kind: 'multiselect', count: 2 } as FieldSpec] : []),
    { name: 'dateNextRdvConsultation', kind: 'date', value: isoDate(v === 1 ? 30 : 31) },
    { name: 'dateNextRdvConsultationEcho', kind: 'date', value: isoDate(v === 1 ? 45 : 46) },
    { name: 'termRDV', kind: 'date', value: isoDate(v === 1 ? 120 : 121) },
    { name: 'monitoringEndPregnancy', kind: 'text', value: `Monitoring hebdomadaire QA${t}` },
    { name: 'childbirthValidatedWay', kind: 'radio', value: v === 1 ? 'oui' : 'non' },
    { name: 'consultationAnesthesia', kind: 'radio', value: v === 1 ? 'non' : 'oui' },
    { name: 'billableActs', kind: 'multiselect', count: 1 },
  ];
}

// ======================================================================
// Consultation de planification familiale (41 champs)
// ======================================================================
const PLANIF_TEXT_FIELDS = [
  'muqueuses', 'varices', 'oedemes', 'exophtalmie', 'allergieCuivre', 'thyroide', 'foie', 'ganglions',
  'coeur', 'rate', 'poumons', 'peau', 'seins', 'vulve', 'periode', 'examenSpeculumVagin',
  'examenSpeculumCol', 'toucherVaginalCol', 'toucherVaginalUterus', 'toucherVaginalAnnexes', 'pertes',
];

export function planificationFields(v: Version): FieldSpec[] {
  const t = v === 1 ? '' : ' (modifié)';
  return [
    { name: 'date', kind: 'date', value: isoDate(0) },
    { name: 'caregiverId', kind: 'select', index: v === 1 ? 0 : 1 },
    { name: 'taille', kind: 'number', value: v === 1 ? '160' : '161' },
    { name: 'weight', kind: 'number', value: v === 1 ? '60' : '61' },
    { name: 'weightReport', kind: 'number', value: v === 1 ? '59' : '60' },
    { name: 'temperature', kind: 'text', value: v === 1 ? '36.8' : '37.1' },
    { name: 'ta', kind: 'text', value: v === 1 ? '11/7' : '12/7' },
    { name: 'pulse', kind: 'text', value: v === 1 ? '72' : '75' },
    { name: 'pb', kind: 'number', value: v === 1 ? '26' : '27' },
    { name: 'dateDerniereRegle', kind: 'date', value: isoDate(v === 1 ? -14 : -15) },
    { name: 'desirGrossesse', kind: 'radio', value: v === 1 ? 'plusTard' : 'non' },
    { name: 'utiliseMethodeContraceptive', kind: 'radio', value: 'oui' },
    ...(v === 1 ? [{ name: 'methodeActuelle', kind: 'multiselect', count: 1 } as FieldSpec] : []),
    ...PLANIF_TEXT_FIELDS.map(name => ({ name, kind: 'text', value: `${name} normal QA${t}` }) as FieldSpec),
    ...(v === 1 ? [{ name: 'methodeChoisie', kind: 'multiselect', count: 1 } as FieldSpec] : []),
    { name: 'utilisationCorrecteExpliquee', kind: 'checkbox', value: v === 1 },
    { name: 'effetsSecondairesDiscutes', kind: 'checkbox', value: v === 1 },
    { name: 'preventionISTAbordee', kind: 'checkbox', value: v === 1 },
    { name: 'observations', kind: 'textarea', value: `Méthode bien tolérée QA${t}` },
    { name: 'dateProchainRdv', kind: 'date', value: isoDate(v === 1 ? 90 : 91) },
    { name: 'billableActs', kind: 'multiselect', count: 1 },
  ];
}

// ======================================================================
// Consultation pédiatrique (spécialité et type sont choisis dans la fenêtre de création)
// ======================================================================
export function pediatricFields(v: Version): FieldSpec[] {
  const t = v === 1 ? '' : ' (modifié)';
  return [
    { name: 'caregiverId', kind: 'select', index: v === 1 ? 0 : 1 },
    { name: 'date', kind: 'date', value: isoDate(0) },
    { name: 'weight', kind: 'number', value: v === 1 ? '18' : '18.5' },
    { name: 'taille', kind: 'number', value: v === 1 ? '105' : '106' },
    { name: 'temperature', kind: 'number', value: v === 1 ? '37.5' : '38' },
    { name: 'tension', kind: 'text', value: v === 1 ? '10/6' : '10/7' },
    { name: 'pulse', kind: 'number', value: v === 1 ? '95' : '98' },
    { name: 'pc', kind: 'number', value: v === 1 ? '50' : '51' },
    { name: 'pb', kind: 'number', value: v === 1 ? '16' : '17' },
    { name: 'report', kind: 'textarea', value: `Compte-rendu pédiatrique QA${t}` },
    { name: 'synthesis', kind: 'textarea', value: `Synthèse : bon développement QA${t}` },
    // « Ordonnance de la consultation » (description) : plus saisie à la création, affichée en
    // modification seulement si elle existe (les ordonnances passent par les prescriptions)
    { name: 'billableActs', kind: 'multiselect', count: 1 },
  ];
}

// ======================================================================
// Consultation dentaire : constantes et conclusion (l'odontogramme est traité à part)
// ======================================================================
export function dentalFields(v: Version): FieldSpec[] {
  const t = v === 1 ? '' : ' (modifié)';
  return [
    { name: 'caregiverId', kind: 'select', index: v === 1 ? 0 : 1 },
    { name: 'date', kind: 'date', value: isoDate(0) },
    { name: 'weight', kind: 'number', value: v === 1 ? '70' : '71' },
    { name: 'tension', kind: 'text', value: v === 1 ? '12/8' : '13/8' },
    { name: 'glycemie', kind: 'number', value: v === 1 ? '1.05' : '1.1' },
    { name: 'temperature', kind: 'number', value: v === 1 ? '36.9' : '37.2' },
    { name: 'pulse', kind: 'number', value: v === 1 ? '74' : '76' },
    { name: 'conclusion', kind: 'textarea', value: `Bilan bucco-dentaire réalisé QA${t}` },
    { name: 'billableActs', kind: 'multiselect', count: 1 },
  ];
}
