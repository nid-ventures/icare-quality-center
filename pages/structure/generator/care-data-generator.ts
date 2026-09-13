import { faker } from '@faker-js/faker';
import { CareData } from '../patient/patient-care.page';

// Liste réelle des assureurs (basée sur les données actuelles de l'environnement de test).
const INSURERS = [
    'AMSA ASSURANCE (ASSURANCE)',
    'AFRIC MANAGEMENT (IPM)',
];

/**
 * Prestations gérées par PatientCarePage.fillCareForm, qui est actuellement figée sur
 * exactement ces 3 prestations (nom + sélecteur ng-select associé dans le modal).
 */
const BENEFIT_DEFINITIONS = [
    {
        name: 'SALLE D\'ACCOUCHEMENT',
        locator: '#formAddPriseEnCharge ng-select[formcontrolname="billableActs"]',
    },
    {
        name: 'CHAMBRE CATÉGORIE 2',
        locator: '#formAddPriseEnCharge ng-select[formcontrolname="billableActs"]',
    },
    {
        name: 'PHARMACIE',
        locator: '#formAddPriseEnCharge ng-select[formcontrolname="billableActs"]',
    },
];

export class CareDataGenerator {
    static generate(): CareData {
        const startDate = faker.date.between({ from: '2025-01-01', to: '2025-12-31' });
        const endDate = faker.date.between({ from: startDate, to: '2026-12-31' });

        return {
            insurerName: faker.helpers.arrayElement(INSURERS),
            startingDate: startDate.toISOString().split('T')[0],
            endingDate: endDate.toISOString().split('T')[0],
            insuranceNumber: faker.string.alphanumeric(8).toUpperCase(),
            cardNumber: faker.string.alphanumeric(10).toUpperCase(),
            coverageRate: faker.number.int({ min: 10, max: 100 }).toString(),
            paymentCap: faker.number.int({ min: 50000, max: 5000000 }).toString(),
            benefits: BENEFIT_DEFINITIONS.map((benefit) => ({
                ...benefit,
                taux: faker.number.int({ min: 5, max: 30 }).toString(),
                montant: faker.number.int({ min: 1000, max: 10000 }).toString(),
            })),
        };
    }
}
