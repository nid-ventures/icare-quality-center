import { type Page } from '@playwright/test';
import { test, expect } from '../../fixtures/structure.fixture';
import { createDossierPatient, openDossier, DOSSIER_SETUP_TIMEOUT, type DossierPatient } from '../../fixtures/dossier-patient';
import { DossierSearchPage } from '../../pages/structure/patient/dossier-search.page';
import { PortalPage } from '../../pages/structure/portal/portal.page';
import { ConsultationPage } from '../../pages/structure/consultation/consultation.page';
import { ConsultationFormPage, type FieldSpec, type FilledValues } from '../../pages/structure/consultation/consultation-form.page';
import { PrescriptionManagerPage } from '../../pages/structure/consultation/prescription-manager.page';
import { DentalChartPage, ADULT_TEETH, CHILD_TEETH } from '../../pages/structure/consultation/dental-chart.page';
import { ConsultationStandardDataGenerator } from '../../pages/structure/generator/consultation-standard-data-generator';
import { prenatalFields, planificationFields, pediatricFields, dentalFields, isoDate } from '../../test-data/consultation-fields';
import { clearPrefilledConsultant } from '../../pages/structure/shared/consultant';

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
      const stamp = Date.now();
      const medication1 = `Ordonnance ${key} ${stamp}`;
      const medication2 = `Ordonnance 2 ${key} ${stamp}`;

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
          await prescriptions.addMedicationPrescription({ title: medication1, medicationName: 'Paracétamol', posologie: '1 cp matin et soir', recommandations: 'Hydratation' });
          await prescriptions.addLaboratoryPrescription(`Bilan de contrôle ${key}`);
          await prescriptions.addImagingPrescription(`Imagerie de contrôle ${key}`, isoDate(7));
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
            await form.expectValues(v1.filter(f => f.name !== 'conclusion'), filled1);
            const conclusion = root.locator('[formcontrolname="conclusion"]');
            await expect(conclusion).toHaveValue(new RegExp('^' + escapeRegExp(filled1.conclusion as string)));
            await expect(conclusion).toHaveValue(/=== PRESCRIPTIONS DENTAIRES ===/);
          } else {
            await form.expectValues(v1, filled1);
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
      });

      if (key === 'dental') {
        test('Le récapitulatif des prescriptions de la conclusion reprend le nom des médicaments', async ({ page }) => {
          test.fail(true, "Anomalie : updateConsultationReportWithPrescriptions() lit med.name / med.dosage alors que les médicaments sont saisis dans med.nom / med.posologie : le récapitulatif écrit \"undefined\".");
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
          await prescriptions.editFirstMedication('2 cp trois fois par jour');
          await prescriptions.removeFirst('Imagerie');
          await prescriptions.addMedicationPrescription({ title: medication2, medicationName: 'Amoxicilline', posologie: '1 gélule matin et soir' });
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
          await form.expectValues(v2, filled2);
          if (key === 'prenatal') await expectDynamicResults(root, ' (modifié)');
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
          await prescriptions.expectPrescriptionDetail('Ordonnance', medication1, '2 cp trois fois par jour');
        });
      });

      if (key === 'pediatric') {
        test("Le résumé automatique de l'ordonnance reprend le nom des médicaments", async ({ page }) => {
          test.fail(true, "Anomalie : en modification, updateDescriptionWithPrescriptions() lit med.name / med.dosage alors que les médicaments sont saisis dans med.nom / med.posologie : le résumé écrit \"undefined\" (et écrase le texte saisi dans \"Ordonnance de la consultation\").");
          const root = await openExistingConsultation(page, patient, def);
          const form = new ConsultationFormPage(page, root);
          await form.activate(def.probe);
          await new PrescriptionManagerPage(page).addMedicationPrescription({ title: `Résumé ${stamp}`, medicationName: 'Ibuprofène', posologie: '1 cp le soir' });
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
    });

    test('Modifier la consultation standard', async ({ page }) => {
      const consultationPage = await openConsultations(page, patient);
      await consultationPage.filterByConsultationType(TYPE);
      await consultationPage.selectFirstConsultation();
      await consultationPage.activateForm();
      await consultationPage.fillUpdatedForm(ConsultationStandardDataGenerator.generateUpdatedData());
      await consultationPage.updateConsultation();
      await expect(consultationPage.confirmButton).not.toBeVisible();
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
      test.fail(true, 'Anomalie : constants/adult_teeth.ts range les dents 41-48 en quadrant 3 et 31-38 en quadrant 4 (inversé par rapport à la numérotation FDI ; idem 71-75 / 81-85 chez l\'enfant).');
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
      test.fail(true, "Anomalie : l'état 'extracted' n'est jamais calculé (getToothState) — une \"Alvulsion dentaire\" est comptée comme traitement, le compteur Extractions reste à 0.");
      await chart.selectPatientType('adult');
      await chart.recordTooth({ number: '48', diagnostic: 'Dent incluse', treatment: 'Alvulsion dentaire' });
      await chart.expectStats({ examined: 1, extractions: 1, treatments: 0 });
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
