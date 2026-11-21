import { type Page } from '@playwright/test';
import { test, expect } from '../../fixtures/structure.fixture';
import { createDossierPatient, openDossier, DOSSIER_SETUP_TIMEOUT, type DossierPatient } from '../../fixtures/dossier-patient';
import { DossierSearchPage } from '../../pages/structure/patient/dossier-search.page';
import { PortalPage } from '../../pages/structure/portal/portal.page';
import { ConsultationPage } from '../../pages/structure/consultation/consultation.page';
import { ConsultationFormPage, type FieldSpec, type FilledValues } from '../../pages/structure/consultation/consultation-form.page';
import { PrescriptionManagerPage } from '../../pages/structure/consultation/prescription-manager.page';
import { DentalChartPage, ADULT_TEETH, CHILD_TEETH } from '../../pages/structure/consultation/dental-chart.page';
import { ConsultationStandardDataGenerator, type ConsultationData } from '../../pages/structure/generator/consultation-standard-data-generator';
import { prenatalFields, planificationFields, pediatricFields, dentalFields, isoDate } from '../../test-data/consultation-fields';
import { clearPrefilledConsultant } from '../../pages/structure/shared/consultant';
import { UnsavedDialog, DraftBanner } from '../../pages/structure/shared/unsaved-dialog';

test.setTimeout(240000);

// Description de chaque type de consultation : choix dans la fenêtre "Nouvelle consultation",
// filtre de la liste, composants Angular de création / modification et champ témoin d'activation.
type ConsultationType = {
  label: string;
  specialty: string;
  type: string;
  filter: string;
  createRoot: string;
  editRoot: string;
  probe: string;
  fields: (v: 1 | 2) => FieldSpec[];
};

const TYPES: Record<'prenatal' | 'planification' | 'pediatric' | 'dental', ConsultationType> = {
  prenatal: {
    label: 'Consultation prénatale', specialty: 'gynécologie-obstétrique', type: 'CONSULTATION prénatale',
    filter: 'CONSULTATION PRÉNATALE', createRoot: 'app-consultation-prenatal', editRoot: 'app-consultation-prenatal-edit',
    probe: 'appearance', fields: prenatalFields,
  },
  planification: {
    label: 'Consultation de planification familiale', specialty: 'gynécologie-obstétrique', type: 'CONSULTATION planification familiale',
    filter: 'CONSULTATION PLANIFICATION', createRoot: 'app-consultation-planification-familiale', editRoot: 'app-consultation-planification-familiale-edit',
    probe: 'observations', fields: planificationFields,
  },
  pediatric: {
    label: 'Consultation pédiatrique', specialty: 'pédiatrie', type: 'CONSULTATION pédiatrique',
    filter: 'CONSULTATION PÉDIATRIQUE', createRoot: 'app-consultation-pediatric', editRoot: 'app-consultation-pediatric-edit',
    probe: 'report', fields: pediatricFields,
  },
  dental: {
    label: 'Consultation dentaire', specialty: 'dentiste', type: 'CONSULTATION dentaire',
    filter: 'CONSULTATION DENTAIRE', createRoot: 'app-consultation-tooth', editRoot: 'app-consultation-tooth-edit',
    probe: 'conclusion', fields: dentalFields,
  },
};

const consultationRoot = (page: Page, selector: string) => page.locator(selector).filter({ visible: true }).first();

/** Ouvre la liste des consultations du dossier de la patiente. */
async function openConsultations(page: Page, patient: DossierPatient) {
  const consultationPage = new ConsultationPage(page);
  await openDossier(page, patient);
  await consultationPage.goToConsultationTab();
  await consultationPage.expectConsultationsListLoaded();
  return consultationPage;
}

/** Démarre une nouvelle consultation du type donné et renvoie son formulaire de création. */
async function startConsultation(page: Page, patient: DossierPatient, def: ConsultationType) {
  const consultationPage = await openConsultations(page, patient);
  await consultationPage.openNewConsultationModal();
  await consultationPage.fillConsultationBasics({ specialty: def.specialty, consultationType: def.type });
  await consultationPage.createConsultation();
  const root = consultationRoot(page, def.createRoot);
  await expect(root, `Formulaire de création "${def.label}"`).toBeVisible({ timeout: 15000 });
  return root;
}

/** Rouvre la (seule) consultation du type donné et renvoie son formulaire de modification. */
async function openExistingConsultation(page: Page, patient: DossierPatient, def: ConsultationType) {
  const consultationPage = await openConsultations(page, patient);
  await consultationPage.filterByConsultationType(def.filter);
  await consultationPage.openFirstConsultation();
  const root = consultationRoot(page, def.editRoot);
  await expect(root, `Formulaire de modification "${def.label}"`).toBeVisible({ timeout: 15000 });
  return root;
}

/** Champs dynamiques "Résultat …" créés par les examens cliniques / bandelettes choisis (prénatale). */
const dynamicResults = (root: ReturnType<Page['locator']>) => ({
  exams: root.locator('.clinical-exam .dynamic-input-modern input'),
  urine: root.locator('.urine-test .dynamic-input-modern input'),
});

async function fillDynamicResults(root: ReturnType<Page['locator']>, suffix: string) {
  const { exams, urine } = dynamicResults(root);
  for (const [group, list] of [['examen', exams], ['bandelette', urine]] as const) {
    const count = await list.count();
    expect(count, `Champs de résultat "${group}" affichés`).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) await list.nth(i).fill(`Résultat ${group} ${i + 1}${suffix}`);
  }
}

async function expectDynamicResults(root: ReturnType<Page['locator']>, suffix: string) {
  const { exams, urine } = dynamicResults(root);
  for (const [group, list] of [['examen', exams], ['bandelette', urine]] as const) {
    const count = await list.count();
    expect(count, `Champs de résultat "${group}" après réouverture`).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) await expect(list.nth(i)).toHaveValue(`Résultat ${group} ${i + 1}${suffix}`);
  }
}

test.describe('Module Dossier médical — Consultations', () => {
  let patient: DossierPatient;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(DOSSIER_SETUP_TIMEOUT);
    patient = await createDossierPatient(browser);
  });

  test.beforeEach(async ({ portal, page }) => {
    await portal.enterModule('Dossier médical');
    await new DossierSearchPage(page).expectLoaded();
  });

  // ======================================================================
  // Prénatale, planification familiale, pédiatrique, dentaire :
  // créer (tous les champs + ordonnance, analyses, imagerie) -> vérifier -> modifier tous les
  // champs et les prescriptions -> vérifier -> supprimer. Mode série : chaque étape porte sur la
  // consultation créée à l'étape précédente.
  // ======================================================================
  for (const [key, def] of Object.entries(TYPES)) {
    test.describe(def.label, () => {
      test.describe.configure({ mode: 'serial' });
      const v1 = def.fields(1);
      const v2 = def.fields(2);
      let filled1: FilledValues = {};
      let filled2: FilledValues = {};
      // Prescriptions saisies (valeurs choisies), revérifiées après chaque enregistrement
      let lab1: FilledValues = {};
      let img1: FilledValues = {};
      // Titre d'ordonnance masqué depuis le 2026-11-20 (« Ordonnance jj/mm/aaaa ») : chaque
      // ordonnance est repérée par le nom de son médicament
      const medication1 = 'Paracétamol';
      const medication2 = 'Amoxicilline';
      const med1 = { medicationName: medication1, posologie: '1 cp matin et soir', recommandations: 'Hydratation', duree: { nombre: 10, unite: 'Jours' as const } };
      const med1Updated = { ...med1, posologie: '2 cp trois fois par jour' };
      const med2 = { medicationName: medication2, posologie: '1 gélule matin et soir' };
      // Champs saisis à la création et non touchés à la modification : doivent rester identiques
      const unchanged = v1.filter(f => !v2.some(g => g.name === f.name));
      // Après modification : valeurs modifiées ; une liste multiple complétée (actes à facturer)
      // garde ses valeurs d'origine plus celles ajoutées
      const afterUpdate = (): FilledValues => {
        const merged: FilledValues = { ...filled2 };
        for (const f of v2) {
          if (f.kind === 'multiselect' && Array.isArray(filled1[f.name])) {
            merged[f.name] = [...(filled1[f.name] as string[]), ...(filled2[f.name] as string[])];
          }
        }
        return merged;
      };

      test(`Créer une ${def.label.toLowerCase()} avec tous les champs et des prescriptions`, async ({ page }) => {
        const root = await startConsultation(page, patient, def);
        const form = new ConsultationFormPage(page, root);
        const prescriptions = new PrescriptionManagerPage(page);

        await test.step('Remplir tous les champs du formulaire', async () => {
          filled1 = await form.fill(v1);
          if (key === 'prenatal') await fillDynamicResults(root, '');
        });

        if (key === 'dental') {
          await test.step("Renseigner l'odontogramme (5 dents, 5 états différents)", async () => {
            const chart = new DentalChartPage(page, root);
            await chart.recordTooth({ number: '11', diagnostic: 'Carie', surfaces: ['O', 'M'], observations: 'Carie mésio-occlusale QA' });
            await chart.recordTooth({ number: '16', diagnostic: 'Carie', treatment: 'Composite', surfaces: ['O'] });
            await chart.recordTooth({ number: '21', diagnostic: 'Fracture', treatment: 'Couronne' });
            // Implant saisi sans diagnostic : avec "Absence", l'application affiche la dent absente.
            await chart.recordTooth({ number: '36', treatment: 'Implant' });
            await chart.recordTooth({ number: '46', diagnostic: 'Absence' });
            await chart.expectStats({ examined: 5, caries: 1, treatments: 3, missing: 1 });
          });
        }

        await test.step('Ajouter une ordonnance, une prescription d\'analyses et une d\'imagerie', async () => {
          await prescriptions.addMedicationPrescription(med1);
          lab1 = await prescriptions.addLaboratoryPrescription(`Bilan de contrôle ${key}`);
          img1 = await prescriptions.addImagingPrescription(`Imagerie de contrôle ${key}`, isoDate(7));
        });

        await test.step('Enregistrer la consultation', async () => {
          await form.saveNew();
        });
      });

      test(`Rouvrir la ${def.label.toLowerCase()} : tous les champs et prescriptions sont conservés`, async ({ page }) => {
        const root = await openExistingConsultation(page, patient, def);
        const form = new ConsultationFormPage(page, root);
        const prescriptions = new PrescriptionManagerPage(page);

        await test.step('Vérifier chaque champ', async () => {
          // Prénatale : "Autres" est enregistré "Autres : <texte>" puis restitué à la réouverture
          // ("Autres" coché + texte dans "Précisez les autres symptômes").
          if (key === 'dental') {
            // En dentaire, l'ajout de prescriptions ajoute un récapitulatif à la fin de la conclusion.
            await form.expectValues(v1.filter(f => f.name !== 'conclusion'), filled1, { exact: true });
            const conclusion = root.locator('[formcontrolname="conclusion"]');
            await expect(conclusion).toHaveValue(new RegExp('^' + escapeRegExp(filled1.conclusion as string)));
            await expect(conclusion).toHaveValue(/=== PRESCRIPTIONS DENTAIRES ===/);
          } else {
            await form.expectValues(v1, filled1, { exact: true });
          }
          if (key === 'prenatal') await expectDynamicResults(root, '');
        });

        if (key === 'dental') {
          await test.step("Vérifier l'odontogramme enregistré", async () => {
            const chart = new DentalChartPage(page, root);
            await chart.expectToothState('11', 'caries');
            await chart.expectSurfaces('11', ['O', 'M']);
            await chart.expectNotesIndicator('11', true);
            await chart.expectToothState('16', 'filling');
            await chart.expectToothState('21', 'crown');
            await chart.expectToothState('36', 'implant');
            await chart.expectToothState('46', 'missing');
            await chart.expectToothState('12', 'healthy');
          });
        }

        await test.step('Vérifier les prescriptions', async () => {
          await prescriptions.expectCount('Ordonnance', 1);
          await prescriptions.expectCount('Analyses', 1);
          await prescriptions.expectCount('Imagerie', 1);
          await prescriptions.expectPrescriptionText('Ordonnance', medication1);
        });

        await test.step('Détail des prescriptions : durée recomposée, analyses et examen prescrits', async () => {
          // Durée = nombre + unité (« 10 jours ») ; plus de colonne Qté
          const medication = await prescriptions.details('Ordonnance', medication1);
          await expect(medication.getByRole('columnheader')).toHaveText(['Médicament', 'Posologie', 'Durée', 'Remarques']);
          await expect(medication.locator('tbody tr').first()).toContainText('10 jours');
          // Analyses et imagerie : résumé compact (plus le formulaire en lecture seule)
          const analyses = await prescriptions.details('Analyses', '');
          await expect(analyses.getByText('Analyses prescrites')).toBeVisible();
          await expect(analyses.locator('ul li'), 'Les 2 analyses prescrites').toHaveCount(2);
          await expect(analyses).toContainText(`Bilan de contrôle ${key}`);
          await expect(analyses.locator('app-laboratory-prescription')).toHaveCount(0);
          const imaging = await prescriptions.details('Imagerie', '');
          await expect(imaging.getByText('Examen prescrit')).toBeVisible();
          await expect(imaging).toContainText(`Imagerie de contrôle ${key}`);
          await expect(imaging.locator('app-imaging-prescription')).toHaveCount(0);
        });

        await test.step('Contenu de chaque prescription : médicament, analyses choisies, examen et diagnostics', async () => {
          await prescriptions.expectMedicationRow(medication1, { nom: med1.medicationName, posologie: med1.posologie, duree: '10 jours', recommandations: med1.recommandations });
          await prescriptions.expectLaboratorySummary(lab1);
          await prescriptions.expectImagingSummary(img1);
        });
      });

      test(`Rouvrir chaque prescription de la ${def.label.toLowerCase()} en modification : tous ses champs sont restitués`, async ({ page }) => {
        const root = await openExistingConsultation(page, patient, def);
        await new ConsultationFormPage(page, root).activate(def.probe);
        const prescriptions = new PrescriptionManagerPage(page);
        // Formulaires refermés par « Annuler » : rien n'est enregistré
        await test.step('Ordonnance', () => prescriptions.expectMedicationForm(med1));
        await test.step("Bulletin d'analyses", () => prescriptions.expectLaboratoryForm(lab1));
        await test.step("Bulletin d'imagerie", () => prescriptions.expectImagingForm(img1));
      });

      if (key === 'dental') {
        test('Le récapitulatif des prescriptions de la conclusion reprend le nom des médicaments', async ({ page }) => {
          const root = await openExistingConsultation(page, patient, def);
          const conclusion = root.locator('[formcontrolname="conclusion"]');
          await expect(conclusion).not.toHaveValue(/undefined/);
        });
      }

      test(`Modifier tous les champs et les prescriptions de la ${def.label.toLowerCase()}`, async ({ page }) => {
        const root = await openExistingConsultation(page, patient, def);
        const form = new ConsultationFormPage(page, root);
        const prescriptions = new PrescriptionManagerPage(page);

        await test.step('Activer le formulaire', async () => {
          await form.activate(def.probe);
        });

        // Les prescriptions sont modifiées avant les champs : en pédiatrie (et en standard), toute
        // modification de prescription réécrit le champ "Ordonnance de la consultation".
        await test.step('Modifier, supprimer et ajouter des prescriptions', async () => {
          await prescriptions.editFirstMedication(med1Updated.posologie);
          await prescriptions.removeFirst('Imagerie');
          await prescriptions.addMedicationPrescription(med2);
        });

        await test.step('Modifier tous les champs', async () => {
          filled2 = await form.fill(v2);
          if (key === 'prenatal') await fillDynamicResults(root, ' (modifié)');
        });

        if (key === 'dental') {
          await test.step("Modifier l'odontogramme (traiter, ajouter, effacer une dent)", async () => {
            const chart = new DentalChartPage(page, root);
            await chart.recordTooth({ number: '11', treatment: 'Composite' });
            await chart.recordTooth({ number: '26', diagnostic: 'Fracture', surfaces: ['V'] });
            await chart.openTooth('21');
            await chart.clearToothButton.click();
            await chart.confirmModal();
            await chart.expectToothState('21', 'healthy');
          });
        }

        await test.step('Enregistrer les modifications', async () => {
          await form.saveUpdate();
        });
      });

      test(`Rouvrir la ${def.label.toLowerCase()} : les modifications sont conservées`, async ({ page }) => {
        const root = await openExistingConsultation(page, patient, def);
        const form = new ConsultationFormPage(page, root);
        const prescriptions = new PrescriptionManagerPage(page);

        await test.step('Vérifier chaque champ modifié', async () => {
          await form.expectValues(v2, afterUpdate(), { exact: true });
          if (key === 'prenatal') await expectDynamicResults(root, ' (modifié)');
        });

        await test.step('Champs non modifiés : valeurs de la création conservées', async () => {
          await form.expectValues(unchanged, filled1, { exact: true });
        });

        if (key === 'dental') {
          await test.step("Vérifier l'odontogramme modifié", async () => {
            const chart = new DentalChartPage(page, root);
            await chart.expectToothState('11', 'filling');
            await chart.expectToothState('26', 'caries');
            await chart.expectSurfaces('26', ['V']);
            await chart.expectToothState('21', 'healthy');
          });
        }

        await test.step('Vérifier les prescriptions : 2 ordonnances, 1 analyse, 0 imagerie', async () => {
          await prescriptions.expectCount('Ordonnance', 2);
          await prescriptions.expectCount('Analyses', 1);
          await prescriptions.expectCount('Imagerie', 0);
          await prescriptions.expectPrescriptionText('Ordonnance', medication2);
          await prescriptions.expectPrescriptionDetail('Ordonnance', medication1, med1Updated.posologie);
        });

        await test.step('Contenu des prescriptions : seule la posologie modifiée change, nouvelle ordonnance complète, analyses inchangées', async () => {
          await prescriptions.expectMedicationRow(medication1, { nom: med1.medicationName, posologie: med1Updated.posologie, duree: '10 jours', recommandations: med1.recommandations });
          await prescriptions.expectMedicationRow(medication2, { nom: med2.medicationName, posologie: med2.posologie });
          await prescriptions.expectLaboratorySummary(lab1);
        });
      });

      test(`Rouvrir les prescriptions modifiées de la ${def.label.toLowerCase()} : tous leurs champs sont restitués`, async ({ page }) => {
        const root = await openExistingConsultation(page, patient, def);
        await new ConsultationFormPage(page, root).activate(def.probe);
        const prescriptions = new PrescriptionManagerPage(page);
        await test.step('Ordonnance modifiée (seule la posologie change)', () => prescriptions.expectMedicationForm(med1Updated));
        await test.step('Ordonnance ajoutée', () => prescriptions.expectMedicationForm(med2));
        await test.step("Bulletin d'analyses inchangé", () => prescriptions.expectLaboratoryForm(lab1));
      });

      test(`Enregistrer la ${def.label.toLowerCase()} sans rien modifier : aucune donnée ne change`, async ({ page }) => {
        let root = await openExistingConsultation(page, patient, def);
        let form = new ConsultationFormPage(page, root);
        let prescriptions = new PrescriptionManagerPage(page);
        const fieldsBefore = await form.snapshot();
        const prescriptionsBefore = await prescriptions.snapshot();
        await form.activate(def.probe);
        await form.saveUpdate();
        await new PortalPage(page).openMenu('Dossiers patients', '**/patient/patients');
        root = await openExistingConsultation(page, patient, def);
        form = new ConsultationFormPage(page, root);
        prescriptions = new PrescriptionManagerPage(page);
        // Chaque champ du formulaire à l'identique : rien de perdu, rien d'ajouté ni de réécrit
        await expect.poll(() => form.snapshot(), { timeout: 20000, message: 'Champs du formulaire inchangés' }).toEqual(fieldsBefore);
        expect(await prescriptions.snapshot(), 'Prescriptions inchangées').toEqual(prescriptionsBefore);
        await prescriptions.expectMedicationRow(medication1, { nom: med1.medicationName, posologie: med1Updated.posologie, duree: '10 jours', recommandations: med1.recommandations });
        await prescriptions.expectMedicationRow(medication2, { nom: med2.medicationName, posologie: med2.posologie });
        await prescriptions.expectLaboratorySummary(lab1);
      });

      if (key === 'pediatric') {
        test("Le résumé automatique de l'ordonnance reprend le nom des médicaments", async ({ page }) => {
          const root = await openExistingConsultation(page, patient, def);
          const form = new ConsultationFormPage(page, root);
          await form.activate(def.probe);
          await new PrescriptionManagerPage(page).addMedicationPrescription({ medicationName: 'Ibuprofène', posologie: '1 cp le soir' });
          const description = root.locator('[formcontrolname="description"]');
          await expect(description).toHaveValue(/Ibuprofène/);
          await expect(description).not.toHaveValue(/undefined/);
        });
      }

      test(`Supprimer la ${def.label.toLowerCase()}`, async ({ page }) => {
        const root = await openExistingConsultation(page, patient, def);
        await new ConsultationFormPage(page, root).deleteConsultation();
        await test.step("Vérifier qu'il n'existe plus de consultation de ce type", async () => {
          await new PortalPage(page).openMenu('Dossiers patients', '**/patient/patients');
          const consultationPage = await openConsultations(page, patient);
          await consultationPage.filterByConsultationType(def.filter);
          await expect(page.locator('app-consultations').getByRole('button', { name: /Consultation/ })).toHaveCount(0);
        });
      });
    });
  }

  // ======================================================================
  // Consultation standard (anesthésique) : parcours de base
  // ======================================================================
  test.describe('Consultation standard', () => {
    test.describe.configure({ mode: 'serial' });
    const TYPE = 'CONSULTATION ANESTHÉSIQUE';
    // Valeurs saisies, revérifiées après réouverture (les actes, choisis selon le catalogue, à part)
    let created: Partial<ConsultationData> = {};

    async function reopen(page: Page) {
      const consultationPage = await openConsultations(page, patient);
      await consultationPage.filterByConsultationType(TYPE);
      await consultationPage.selectFirstConsultation();
      return consultationPage;
    }

    test('Créer une consultation standard', async ({ page }) => {
      const data = ConsultationStandardDataGenerator.generate();
      const consultationPage = await openConsultations(page, patient);
      await consultationPage.openNewConsultationModal();
      await consultationPage.fillConsultationBasics(data);
      await consultationPage.createConsultation();
      await consultationPage.fillMedicalConsultationForm(data);
      await consultationPage.saveConsultation();
      await consultationPage.filterByConsultationType(data.consultationType);
      await expect(page.locator('app-consultations').getByRole('button', { name: /Consultation/ }).first()).toBeVisible();
      const { acts: _acts, prescription: _prescription, ...saved } = data;
      created = saved;
    });

    test('Rouvrir la consultation standard : constantes, compte-rendu et synthèse enregistrés', async ({ page }) => {
      const consultationPage = await reopen(page);
      await consultationPage.expectSavedValues(created);
    });

    test('Modifier la consultation standard : modifications conservées, le reste inchangé', async ({ page }) => {
      const updated = ConsultationStandardDataGenerator.generateUpdatedData();
      await test.step('Modifier compte-rendu et synthèse', async () => {
        const consultationPage = await reopen(page);
        await consultationPage.activateForm();
        await consultationPage.fillUpdatedForm(updated);
        await consultationPage.updateConsultation();
        await expect(consultationPage.confirmButton).not.toBeVisible();
      });
      await test.step('Rouvrir le dossier : valeurs modifiées et constantes inchangées', async () => {
        // Retour à la recherche de dossiers (un rechargement resterait sur le dossier ouvert)
        await new PortalPage(page).openMenu('Dossiers patients', '**/patient/patients');
        const consultationPage = await reopen(page);
        await consultationPage.expectSavedValues({ ...created, report: updated.report, summary: updated.summary });
      });
    });

    test('Enregistrer la consultation standard sans rien modifier : aucune donnée ne change', async ({ page }) => {
      const form = () => new ConsultationFormPage(page, page.locator('app-consultation-standard-edit').filter({ visible: true }).first());
      let consultationPage = await reopen(page);
      await expect(consultationPage.reportInput).toBeVisible({ timeout: 15000 });
      const before = await form().snapshot();
      await consultationPage.activateForm();
      await consultationPage.updateConsultation();
      await expect(consultationPage.confirmButton).not.toBeVisible();
      await new PortalPage(page).openMenu('Dossiers patients', '**/patient/patients');
      consultationPage = await reopen(page);
      await expect(consultationPage.reportInput).toBeVisible({ timeout: 15000 });
      await expect.poll(() => form().snapshot(), { timeout: 20000, message: 'Champs du formulaire inchangés' }).toEqual(before);
    });

    test('Supprimer la consultation standard', async ({ page }) => {
      const consultationPage = await openConsultations(page, patient);
      await consultationPage.filterByConsultationType(TYPE);
      await consultationPage.openFirstConsultation();
      await consultationPage.deleteConsultation();
      await expect(consultationPage.confirmButton).not.toBeVisible();
    });
  });

  // ======================================================================
  // Odontogramme : cas possibles (sans enregistrer la consultation)
  // ======================================================================
  test.describe('Consultation dentaire — odontogramme', () => {
    let chart: DentalChartPage;

    test.beforeEach(async ({ page }) => {
      const root = await startConsultation(page, patient, TYPES.dental);
      chart = new DentalChartPage(page, root);
    });

    test('Afficher les 32 dents permanentes (adulte) puis les 20 dents temporaires (enfant)', async () => {
      await test.step('Adulte : dents 11 à 48', async () => {
        await chart.selectPatientType('adult');
        await chart.expectTeeth(ADULT_TEETH);
      });
      await test.step('Enfant : dents 51 à 85', async () => {
        await chart.selectPatientType('child');
        await chart.expectTeeth(CHILD_TEETH);
      });
    });

    // Numérotation FDI : le premier chiffre du numéro de dent est son quadrant.
    const expectToothInfo = async (tooth: string, type: string | null, quadrant: string | null) => {
      await chart.openTooth(tooth);
      if (type) await expect(chart.detailCard.locator('.info-card').filter({ hasText: 'Type' })).toContainText(type);
      if (quadrant) await expect(chart.detailCard.locator('.info-card').filter({ hasText: 'Quadrant' }).locator('.info-value')).toHaveText(quadrant);
      await chart.cancelToothButton.click();
      await expect(chart.detailCard).toBeHidden();
    };

    test('Afficher le type de chaque famille de dents', async () => {
      await chart.selectPatientType('adult');
      for (const [tooth, type] of [['11', 'Incisive'], ['23', 'Canine'], ['34', 'Prémolaire'], ['46', 'Molaire']]) {
        await test.step(`Dent ${tooth} : ${type}`, async () => expectToothInfo(tooth, type, null));
      }
    });

    test('Afficher le quadrant des arcades supérieures (1 et 2)', async () => {
      await chart.selectPatientType('adult');
      for (const tooth of ['11', '18', '21', '28']) {
        await test.step(`Dent ${tooth} : quadrant ${tooth[0]}`, async () => expectToothInfo(tooth, null, tooth[0]));
      }
    });

    test('Afficher le quadrant des arcades inférieures (3 et 4) selon la numérotation FDI', async () => {
      await chart.selectPatientType('adult');
      for (const tooth of ['31', '38', '41', '48']) {
        await test.step(`Dent ${tooth} : quadrant ${tooth[0]}`, async () => expectToothInfo(tooth, null, tooth[0]));
      }
    });

    test('Chaque état dentaire est représenté et comptabilisé dans les statistiques', async () => {
      await chart.selectPatientType('adult');
      await test.step('À traiter : diagnostic sans traitement', async () => {
        await chart.recordTooth({ number: '14', diagnostic: 'Pulpite aiguë réversible' });
        await chart.expectToothState('14', 'caries');
      });
      await test.step('Traitement réalisé : composite', async () => {
        await chart.recordTooth({ number: '15', diagnostic: 'Carie', treatment: 'Composite' });
        await chart.expectToothState('15', 'filling');
      });
      await test.step('Couronne', async () => {
        await chart.recordTooth({ number: '24', diagnostic: 'Fracture', treatment: 'Couronne' });
        await chart.expectToothState('24', 'crown');
      });
      await test.step('Implant', async () => {
        await chart.recordTooth({ number: '36', treatment: 'Implant' });
        await chart.expectToothState('36', 'implant');
      });
      await test.step('Absente', async () => {
        await chart.recordTooth({ number: '47', diagnostic: 'Absence' });
        await chart.expectToothState('47', 'missing');
      });
      await test.step('Statistiques : 5 examinées, 1 à traiter, 3 traitements, 1 manquante', async () => {
        await chart.expectStats({ examined: 5, caries: 1, treatments: 3, missing: 1 });
        await chart.expectToothState('11', 'healthy');
      });
    });

    test('Sélectionner puis désélectionner des surfaces', async () => {
      await chart.selectPatientType('adult');
      await chart.openTooth('16');
      await chart.diagnosticSelect.selectOption({ label: 'Carie' });
      for (const surface of ['O', 'M', 'D', 'V', 'L'] as const) await chart.toggleSurface(surface);
      await chart.toggleSurface('M');
      await chart.toggleSurface('L');
      await chart.saveToothButton.click();
      await chart.expectSurfaces('16', ['O', 'D', 'V']);
    });

    test('Une observation affiche un indicateur de note sur la dent', async () => {
      await chart.selectPatientType('adult');
      await chart.recordTooth({ number: '31', diagnostic: 'Gingivite', observations: 'Saignement au sondage QA' });
      await chart.expectNotesIndicator('31', true);
      await chart.expectNotesIndicator('32', false);
    });

    test('Annuler la saisie d\'une dent ne modifie pas le schéma', async () => {
      await chart.selectPatientType('adult');
      await chart.openTooth('22');
      await chart.diagnosticSelect.selectOption({ label: 'Carie' });
      await chart.treatmentSelect.selectOption({ label: 'Composite' });
      await chart.cancelToothButton.click();
      await expect(chart.detailCard).toBeHidden();
      await chart.expectToothState('22', 'healthy');
      await expect(chart.stats).toBeHidden();
    });

    test('Effacer les données d\'une dent (annuler puis confirmer)', async () => {
      await chart.selectPatientType('adult');
      await chart.recordTooth({ number: '13', diagnostic: 'Carie', treatment: 'Composite', surfaces: ['O'] });
      await chart.expectToothState('13', 'filling');

      await test.step('Effacer puis fermer l\'avertissement : la dent garde ses données', async () => {
        await chart.openTooth('13');
        await chart.clearToothButton.click();
        await chart.cancelModal();
        await chart.cancelToothButton.click();
        await chart.expectToothState('13', 'filling');
      });

      await test.step('Effacer et confirmer : la dent redevient saine', async () => {
        await chart.openTooth('13');
        await chart.clearToothButton.click();
        await chart.confirmModal();
        await chart.expectToothState('13', 'healthy');
        await chart.expectSurfaces('13', []);
      });
    });

    test('Changer le type de patient avec des données demande une confirmation', async () => {
      await chart.selectPatientType('adult');
      await chart.recordTooth({ number: '17', diagnostic: 'Carie' });

      await test.step('Refuser : le schéma adulte et ses données sont conservés', async () => {
        await chart.selectPatientType('child');
        await expect(chart.warningModal()).toContainText(/effacera toutes les données dentaires/i);
        await chart.cancelModal();
        await chart.expectTeeth(ADULT_TEETH);
        await chart.expectToothState('17', 'caries');
      });

      await test.step('Confirmer : schéma enfant vierge', async () => {
        await chart.selectPatientType('child');
        await chart.confirmModal();
        await chart.expectTeeth(CHILD_TEETH);
        await expect(chart.stats).toBeHidden();
      });
    });

    test('Une avulsion est comptée dans les extractions', async () => {
      await chart.selectPatientType('adult');
      await chart.recordTooth({ number: '48', diagnostic: 'Dent incluse', treatment: 'Alvulsion dentaire' });
      await chart.expectStats({ examined: 1, extractions: 1, treatments: 0 });
    });
  });

  // ======================================================================
  // Saisie non enregistrée : avertissement avant de quitter et brouillon sur le poste
  // ======================================================================
  // Chaque type : tous les champs + les 3 prescriptions, relevé complet comparé avant / après ;
  // rien n'existe sur le serveur tant que la consultation n'est pas enregistrée ; un brouillon repris
  // puis enregistré donne une consultation conforme à la saisie.
  test.describe('Consultation non enregistrée — avertissement et brouillon', () => {
    const leave = (page: Page) => page.locator('.patient-header .btn-back').click();
    const LEAVE_TITLE = /CONSULTATION NON ENREGISTRÉE/;
    const listed = (page: Page) => page.locator('app-consultations').getByRole('button', { name: /Consultation/ });
    const todayFr = () => new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    type Entry = {
      filled: FilledValues;
      fields: Record<string, string>;
      prescriptions: Awaited<ReturnType<PrescriptionManagerPage['snapshot']>>;
      med: { medicationName: string; posologie: string; recommandations: string; duree: { nombre: number; unite: 'Jours' } };
      lab: FilledValues;
      img: FilledValues;
    };

    /** Nombre de consultations de la liste, relu jusqu'à ce qu'il ne bouge plus (liste chargée). */
    async function stableCount(page: Page): Promise<number> {
      let previous = -1;
      let count = await listed(page).count();
      while (count !== previous) {
        previous = count;
        await page.waitForTimeout(1500);
        count = await listed(page).count();
      }
      return count;
    }

    /**
     * Réponse du serveur à la lecture de la liste des consultations : après un rechargement, la liste
     * affiche 0 avant de recevoir les consultations (compter trop tôt donnait 0 alors qu'une consultation
     * venait d'être enregistrée). En arrivant depuis le tableau de bord, la liste est remplie par
     * /medical/stats ; après un rechargement de la page, par /medical/consultations.
     */
    const listLoaded = (page: Page) => page.waitForResponse(r => /\/medical\/(consultations\?|stats)/.test(r.url()) && r.request().method() === 'GET' && r.ok(), { timeout: 30000 });

    async function reloadList(page: Page) {
      const loaded = listLoaded(page);
      await page.reload();
      await loaded;
    }

    async function openConsultationsLoaded(page: Page) {
      const loaded = listLoaded(page);
      const consultationPage = await openConsultations(page, patient);
      await loaded;
      return consultationPage;
    }

    /** Ouvre la liste (nombre de consultations relevé) puis le formulaire de création du type. */
    async function start(page: Page, def: ConsultationType) {
      const consultationPage = await openConsultationsLoaded(page);
      const before = await stableCount(page);
      await consultationPage.openNewConsultationModal();
      await consultationPage.fillConsultationBasics({ specialty: def.specialty, consultationType: def.type });
      await consultationPage.createConsultation();
      const root = consultationRoot(page, def.createRoot);
      await expect(root, `Formulaire de création "${def.label}"`).toBeVisible({ timeout: 15000 });
      return { root, before };
    }

    /** Revient sur la page Consultations depuis le tableau de bord du patient. */
    async function backToConsultations(page: Page) {
      const consultationPage = new ConsultationPage(page);
      await expect(page).toHaveURL(/patient-dashboard/);
      await consultationPage.goToConsultationTab();
      await consultationPage.expectConsultationsListLoaded();
      return consultationPage;
    }

    /** Remplit tous les champs du type et ajoute les 3 prescriptions ; renvoie le relevé complet. */
    async function fillEverything(page: Page, root: ReturnType<Page['locator']>, def: ConsultationType, key: string): Promise<Entry> {
      const form = new ConsultationFormPage(page, root);
      const prescriptions = new PrescriptionManagerPage(page);
      const filled = await form.fill(def.fields(1));
      if (key === 'prenatal') await fillDynamicResults(root, ' (brouillon)');
      const med = { medicationName: 'Ibuprofène', posologie: '1 cp le soir', recommandations: 'Pendant le repas', duree: { nombre: 5, unite: 'Jours' as const } };
      await prescriptions.addMedicationPrescription(med);
      const lab = await prescriptions.addLaboratoryPrescription(`Bilan brouillon ${key}`);
      const img = await prescriptions.addImagingPrescription(`Imagerie brouillon ${key}`, isoDate(7));
      return { filled, fields: await form.snapshot(), prescriptions: await prescriptions.snapshot(), med, lab, img };
    }

    /** Tous les champs et toutes les prescriptions affichés sont ceux de la saisie. */
    async function expectEverything(page: Page, root: ReturnType<Page['locator']>, entry: Entry, key: string) {
      const form = new ConsultationFormPage(page, root);
      const prescriptions = new PrescriptionManagerPage(page);
      await expect.poll(() => form.snapshot(), { timeout: 20000, message: 'Tous les champs identiques à la saisie' }).toEqual(entry.fields);
      if (key === 'prenatal') await expectDynamicResults(root, ' (brouillon)');
      await expect.poll(() => prescriptions.snapshot(), { timeout: 15000, message: 'Prescriptions identiques à la saisie' }).toEqual(entry.prescriptions);
      await prescriptions.expectCount('Ordonnance', 1);
      await prescriptions.expectCount('Analyses', 1);
      await prescriptions.expectCount('Imagerie', 1);
      await prescriptions.expectMedicationRow(entry.med.medicationName, { nom: entry.med.medicationName, posologie: entry.med.posologie, duree: '5 jours', recommandations: entry.med.recommandations });
      await prescriptions.expectLaboratorySummary(entry.lab);
      await prescriptions.expectImagingSummary(entry.img);
    }

    for (const [key, def] of Object.entries(TYPES)) {
      test(`${def.label} : « Rester sur la page » garde tous les champs et toutes les prescriptions`, async ({ page }) => {
        const { root, before } = await start(page, def);
        const entry = await test.step('Remplir tous les champs et les 3 prescriptions, sans enregistrer', () => fillEverything(page, root, def, key));
        const dialog = new UnsavedDialog(page);
        await test.step('Retour : la popup prévient que la consultation est gardée en brouillon', async () => {
          await leave(page);
          await dialog.expectOpen(LEAVE_TITLE, /gardées en brouillon sur ce poste/);
        });
        await test.step('« Rester sur la page » : saisie complète intacte', async () => {
          await dialog.answer(/Rester sur la page/);
          await expect(page).toHaveURL(/consultations\//);
          await expectEverything(page, root, entry, key);
        });
        await test.step('Annuler puis « Abandonner la saisie » : aucune consultation créée, plus de brouillon', async () => {
          await new ConsultationPage(page).cancelButton.click();
          await dialog.expectOpen(LEAVE_TITLE, /seront perdues/);
          await dialog.answer(/Abandonner la saisie/);
          await expect(consultationRoot(page, def.createRoot)).toHaveCount(0);
          await reloadList(page);
          await new ConsultationPage(page).expectConsultationsListLoaded();
          expect(await stableCount(page), 'Aucune consultation enregistrée').toBe(before);
          await expect(new DraftBanner(page).root, 'Brouillon supprimé').toHaveCount(0);
        });
      });

      test(`${def.label} : quitter puis « Reprendre » restaure tous les champs et prescriptions ; enregistrée, elle est conforme`, async ({ page }) => {
        const { root, before } = await start(page, def);
        const entry = await test.step('Remplir tous les champs et les 3 prescriptions, sans enregistrer', () => fillEverything(page, root, def, key));
        const dialog = new UnsavedDialog(page);
        await test.step('Quitter quand même', async () => {
          await leave(page);
          await dialog.expectOpen(LEAVE_TITLE);
          await dialog.answer(/Quitter quand même/);
        });
        const banner = new DraftBanner(page);
        await test.step('Retour : rien sur le serveur, brouillon proposé (type, date du jour, 3 prescriptions)', async () => {
          await backToConsultations(page);
          expect(await stableCount(page), 'Aucune consultation enregistrée').toBe(before);
          await expect(banner.root).toBeVisible();
          await expect(banner.root).toContainText(/Consultation non enregistrée/);
          await expect(banner.root).toContainText(new RegExp(escapeRegExp(def.type).replace(/ /g, '\\s+'), 'i')); // espaces du libellé variables
          await expect(banner.root).toContainText(`du ${todayFr()} à`);
          await expect(banner.root).toContainText(/\(3 prescriptions\)/);
        });
        await test.step('« Reprendre » : tous les champs et les prescriptions restaurés', async () => {
          await banner.resume.click();
          const resumed = consultationRoot(page, def.createRoot);
          await expect(resumed).toBeVisible({ timeout: 15000 });
          await expect(banner.root, 'Bandeau retiré').toHaveCount(0);
          await expectEverything(page, resumed, entry, key);
        });
        await test.step('Enregistrer : une seule consultation créée, brouillon supprimé', async () => {
          await new ConsultationFormPage(page, consultationRoot(page, def.createRoot)).saveNew();
          await reloadList(page);
          await new ConsultationPage(page).expectConsultationsListLoaded();
          expect(await stableCount(page), 'Une consultation de plus').toBe(before + 1);
          await expect(banner.root, 'Plus de brouillon').toHaveCount(0);
        });
        await test.step('Rouvrir la consultation : chaque champ et chaque prescription conformes à la saisie', async () => {
          const saved = await openExistingConsultation(page, patient, def);
          const form = new ConsultationFormPage(page, saved);
          const v1 = def.fields(1);
          if (key === 'dental') {
            // Le récapitulatif des prescriptions s'ajoute à la fin de la conclusion
            await form.expectValues(v1.filter(f => f.name !== 'conclusion'), entry.filled, { exact: true });
            await expect(saved.locator('[formcontrolname="conclusion"]')).toHaveValue(new RegExp('^' + escapeRegExp(entry.filled.conclusion as string)));
          } else {
            await form.expectValues(v1, entry.filled, { exact: true });
          }
          if (key === 'prenatal') await expectDynamicResults(saved, ' (brouillon)');
          const prescriptions = new PrescriptionManagerPage(page);
          await prescriptions.expectCount('Ordonnance', 1);
          await prescriptions.expectCount('Analyses', 1);
          await prescriptions.expectCount('Imagerie', 1);
          await prescriptions.expectMedicationRow(entry.med.medicationName, { nom: entry.med.medicationName, posologie: entry.med.posologie, duree: '5 jours', recommandations: entry.med.recommandations });
          await prescriptions.expectLaboratorySummary(entry.lab);
          await prescriptions.expectImagingSummary(entry.img);
          await prescriptions.expectMedicationForm(entry.med);
        });
        await test.step('Nettoyage : supprimer la consultation', async () => {
          const saved = consultationRoot(page, def.editRoot);
          await new ConsultationFormPage(page, saved).deleteConsultation();
          await new PortalPage(page).openMenu('Dossiers patients', '**/patient/patients');
          await openConsultationsLoaded(page);
          expect(await stableCount(page), 'Nombre de consultations de départ').toBe(before);
        });
      });
    }

    test("Consultation dentaire : le brouillon garde l'odontogramme", async ({ page }) => {
      // Lecture du code (b19dc7cb) : le brouillon enregistre le formulaire et les prescriptions, mais
      // les dents saisies sont dans dentalRecord, hors du formulaire, jusqu'à l'enregistrement.
      // Constaté le 21/11 : seul l'odontogramme saisi, quitter la page ne prévient pas (formulaire
      // vierge) et aucun brouillon n'est proposé : la saisie des dents est perdue sans avertissement.
      test.fail(true, "Anomalie : l'odontogramme seul n'est ni protégé par l'avertissement avant de quitter, ni gardé dans le brouillon");
      const { root } = await start(page, TYPES.dental);
      const chart = new DentalChartPage(page, root);
      await chart.recordTooth({ number: '11', diagnostic: 'Carie', surfaces: ['O', 'M'], observations: 'Carie brouillon QA' });
      await chart.recordTooth({ number: '46', diagnostic: 'Absence' });
      const dialog = new UnsavedDialog(page);
      await leave(page);
      await test.step('Avertissement « CONSULTATION NON ENREGISTRÉE » attendu (dents saisies)', async () => {
        const warned = await dialog.root.waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false);
        expect.soft(warned, 'Avertissement avant de quitter avec un odontogramme saisi').toBe(true);
        if (warned) await dialog.answer(/Quitter quand même/);
      });
      const banner = new DraftBanner(page);
      await backToConsultations(page);
      await expect(banner.root, "Brouillon proposé pour l'odontogramme saisi").toBeVisible({ timeout: 10000 });
      await banner.resume.click();
      const resumed = consultationRoot(page, TYPES.dental.createRoot);
      await expect(resumed).toBeVisible({ timeout: 15000 });
      const resumedChart = new DentalChartPage(page, resumed);
      try {
        await resumedChart.expectToothState('11', 'caries');
        await resumedChart.expectSurfaces('11', ['O', 'M']);
        await resumedChart.expectNotesIndicator('11', true);
        await resumedChart.expectToothState('46', 'missing');
      } finally {
        await new ConsultationPage(page).cancelButton.click().catch(() => {});
        await dialog.answer(/Abandonner la saisie/).catch(() => {});
      }
    });

    test('Quitter la page Consultations sans rien saisir : aucun avertissement, aucun brouillon', async ({ page }) => {
      const { before } = await start(page, TYPES.pediatric);
      await leave(page);
      await expect(page, 'Tableau de bord ouvert directement').toHaveURL(/patient-dashboard/);
      await new UnsavedDialog(page).expectClosed();
      await backToConsultations(page);
      expect(await stableCount(page)).toBe(before);
      await expect(new DraftBanner(page).root).toHaveCount(0);
    });

    test('Supprimer le brouillon retrouvé : confirmation, puis plus proposé, rien sur le serveur', async ({ page }) => {
      const { root, before } = await start(page, TYPES.pediatric);
      await fillEverything(page, root, TYPES.pediatric, 'pediatric');
      const dialog = new UnsavedDialog(page);
      await leave(page);
      await dialog.answer(/Quitter quand même/);
      await backToConsultations(page);
      const banner = new DraftBanner(page);
      await expect(banner.root).toBeVisible();
      await test.step('« Supprimer » puis « Annuler » : le brouillon reste', async () => {
        await banner.discard.click();
        await dialog.expectOpen(/SUPPRIMER LE BROUILLON/, /Supprimer définitivement cette consultation non enregistrée et ses prescriptions/);
        await dialog.answer(/^Annuler$/);
        await expect(banner.root).toBeVisible();
      });
      await test.step('« Supprimer » confirmé : bandeau retiré, même après rechargement ; aucune consultation créée', async () => {
        await banner.discard.click();
        await dialog.answer(/^Supprimer$/);
        await expect(banner.root).toHaveCount(0);
        await reloadList(page);
        await new ConsultationPage(page).expectConsultationsListLoaded();
        await expect(banner.root).toHaveCount(0);
        expect(await stableCount(page)).toBe(before);
      });
    });

    test('Annuler une saisie en cours : confirmation, « Revenir à la saisie » garde tous les champs et prescriptions', async ({ page }) => {
      const { root, before } = await start(page, TYPES.pediatric);
      const entry = await fillEverything(page, root, TYPES.pediatric, 'pediatric');
      const consultationPage = new ConsultationPage(page);
      const dialog = new UnsavedDialog(page);
      await consultationPage.cancelButton.click();
      await dialog.expectOpen(LEAVE_TITLE, /Les données saisies et les prescriptions de cette consultation seront perdues/);
      await dialog.answer(/Revenir à la saisie/);
      await expectEverything(page, root, entry, 'pediatric');
      await consultationPage.cancelButton.click();
      await dialog.answer(/Abandonner la saisie/);
      await expect(consultationPage.newConsultationBar).toBeVisible();
      await reloadList(page);
      await consultationPage.expectConsultationsListLoaded();
      expect(await stableCount(page)).toBe(before);
      await expect(new DraftBanner(page).root).toHaveCount(0);
    });
  });

  // ======================================================================
  // Cas d'exception
  // ======================================================================
  test.describe("Consultations — cas d'exception", () => {
    for (const def of Object.values(TYPES)) {
      test(`${def.label} : enregistrer sans consultant est refusé`, async ({ page }) => {
        const root = await startConsultation(page, patient, def);
        // Consultant prérempli si l'utilisateur connecté est soignant (selon la structure)
        await clearPrefilledConsultant(root);
        await root.getByRole('button', { name: /Enregistrer la consultation/ }).click();
        await expect(root.getByText('Le consultant est obligatoire').first()).toBeVisible();
        await expect(page.getByRole('button', { name: /^\W*Confirmer$/ })).toHaveCount(0);
      });
    }

    test("Une ordonnance sans médicament ne peut pas être enregistrée", async ({ page }) => {
      await startConsultation(page, patient, TYPES.pediatric);
      const prescriptions = new PrescriptionManagerPage(page);
      await prescriptions.expectMedicationRequiresAMedication('Ordonnance vide QA');
      await prescriptions.expectCount('Ordonnance', 0);
    });

    test("Une prescription d'analyses incomplète n'est pas ajoutée", async ({ page }) => {
      await startConsultation(page, patient, TYPES.pediatric);
      const prescriptions = new PrescriptionManagerPage(page);
      await prescriptions.root.locator('.rx-panel-header').filter({ hasText: 'Analyses' }).click();
      const form = prescriptions.root.locator('app-laboratory-prescription');
      await expect(form).toBeVisible();
      await form.getByRole('button', { name: /^\W*Enregistrer$/ }).click();
      await expect(form, 'Le formulaire reste ouvert').toBeVisible();
      await form.getByRole('button', { name: /Annuler/ }).click();
      await prescriptions.expectCount('Analyses', 0);
    });

    // Diagnostic obligatoire depuis le 2026-11-18 (espaces seuls refusés) ; prescripteur présaisi
    for (const [label, value] of [['vide', ''], ['fait d\'espaces', '   ']] as const) {
      test(`Une prescription d'analyses au diagnostic ${label} n'est pas ajoutée (prescripteur présaisi)`, async ({ page }) => {
        await startConsultation(page, patient, TYPES.pediatric);
        await new PrescriptionManagerPage(page).expectLaboratoryRequiresDiagnostic(value);
      });

      test(`Une prescription d'imagerie au diagnostic ${label} n'est pas ajoutée (prescripteur présaisi)`, async ({ page }) => {
        await startConsultation(page, patient, TYPES.pediatric);
        await new PrescriptionManagerPage(page).expectImagingRequiresDiagnostic(value, isoDate(7));
      });
    }

    test('Annuler après le choix d\'un type ferme le formulaire sans rien créer', async ({ page }) => {
      const consultationPage = await openConsultations(page, patient);
      const def = TYPES.prenatal;
      await consultationPage.openNewConsultationModal();
      await consultationPage.fillConsultationBasics({ specialty: def.specialty, consultationType: def.type });
      await consultationPage.createConsultation();
      await expect(consultationRoot(page, def.createRoot), 'Formulaire du type choisi ouvert').toBeVisible();
      await consultationPage.cancelNewConsultation();
      for (const d of Object.values(TYPES)) {
        await expect(consultationRoot(page, d.createRoot)).toHaveCount(0);
      }
    });

    test('Rechercher un type inconnu ne propose aucun type', async ({ page }) => {
      const consultationPage = await openConsultations(page, patient);
      await consultationPage.openNewConsultationModal();
      await consultationPage.searchConsultationType('zzz-qa-inconnu');
      await expect(consultationPage.newConsultationBar.getByText(/Aucun type ne correspond/), 'Message "aucun type"').toBeVisible();
      await expect(consultationPage.typeChips, 'Aucun type proposé').toHaveCount(0);
      await expect(consultationPage.currentTypeBar, 'Aucun formulaire ouvert').toHaveCount(0);
    });

    test('Rechercher un type puis Entrée ouvre son formulaire', async ({ page }) => {
      const consultationPage = await openConsultations(page, patient);
      const def = TYPES.prenatal;
      await consultationPage.openNewConsultationModal();
      // Sans accent : la recherche ignore les accents
      await consultationPage.searchConsultationType('prenatale');
      await expect(consultationPage.typeChips, 'Un seul type correspond').toHaveCount(1);
      await consultationPage.typeSearchInput.press('Enter');
      await consultationPage.createConsultation();
      await expect(consultationRoot(page, def.createRoot), 'Formulaire prénatal ouvert').toBeVisible();
      await consultationPage.cancelNewConsultation();
    });
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
