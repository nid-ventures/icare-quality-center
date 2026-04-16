import { faker } from '@faker-js/faker';
import { CareData } from '../patient/patient-care.page';

export class CareDataGenerator {
    static generate(): CareData {
        const startDate = faker.date.between({ from: '2025-01-01', to: '2025-12-31' });
        const endDate = faker.date.between({ from: startDate, to: '2026-12-31' });

        return {
            insurerName: faker.helpers.arrayElement([
                'AMSA ASSURANCE (ASSURANCE)',
                "WILLIS TOWERS WATSON (ASSURANCE)",
                "AGETIP (ASSURANCE)",
                "Ascoma Assurance (ASSURANCE)"
            ]),
            startingDate: startDate.toISOString().split('T')[0],
            endingDate: endDate.toISOString().split('T')[0],
            insuranceNumber: faker.string.alphanumeric(8).toUpperCase(),
            cardNumber: faker.string.alphanumeric(10).toUpperCase(),
            coverageRate: faker.number.int({ min: 10, max: 100 }).toString(),
            paymentCap: faker.number.int({ min: 50000, max: 5000000 }).toString(),
            benefits: [
                {
                    name: 'SALLE D\'ACCOUCHEMENT',
                    locator: '.ng-touched > .modal-dialog > .modal-content > .modal-body > div:nth-child(3) > .col-md-12 > .ng-select-multiple > .ng-select-container > .ng-value-container > .ng-input > input',
                    taux: faker.number.int({ min: 5, max: 30 }).toString(),
                    montant: faker.number.int({ min: 1000, max: 10000 }).toString(),
                },
                {
                    name: 'CHAMBRE CATÉGORIE 2',
                    locator: '.ng-touched > .modal-dialog > .modal-content > .modal-body > div:nth-child(4) > div > .ng-select-multiple > .ng-select-container > .ng-value-container > .ng-input > input',
                    taux: faker.number.int({ min: 5, max: 30 }).toString(),
                    montant: faker.number.int({ min: 1000, max: 10000 }).toString(),
                },
                {
                    name: 'PHARMACIE',
                    locator: '.ng-select-multiple.ng-select-searchable.ng-select-clearable.ng-select.ng-valid.ng-select-focused > .ng-select-container > .ng-value-container > .ng-input > input',
                    taux: faker.number.int({ min: 5, max: 30 }).toString(),
                    montant: faker.number.int({ min: 1000, max: 10000 }).toString(),
                },
            ],
        };
    }
}