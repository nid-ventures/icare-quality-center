// tests/pages/consultation-data-generator.ts
import { faker } from '@faker-js/faker';

export interface ConsultationData {
    specialty: string;           // ex: 'anesthésie-réanimation'
    consultationType: string;    // ex: 'CONSULTATION anesthésique'
    caregiver: string;           // ex: 'Diane Benao'
    weight: string;
    height: string;
    temperature: string;
    tension: string;             // pression artérielle
    pulse: string;
    report: string;              // compte-rendu détaillé
    summary: string;             // synthèse
    prescription: string;        // ordonnance
    acts: string[];              // liste des actes sélectionnés
}

export class ConsultationStandardDataGenerator {
    // Liste réelle des médecins (basée sur les données de l'API)
    private static readonly realCaregivers = [
        'Médecin Saré',
        'Diane Benao',
        'Medecin TEST',
        'SANOU AROUNA'
    ];
    static generate(): ConsultationData {
        return {
            specialty: faker.helpers.arrayElement([
                'anesthésie-réanimation',
                //   'cardiologie',
                //   'dermatologie',
                //    'gynécologie',
                //    'pédiatrie'
            ]),
            consultationType: faker.helpers.arrayElement([
                'CONSULTATION anesthésique',
                //     'CONSULTATION cardiologique',
                //     'CONSULTATION dermatologique',
                //     'CONSULTATION gynécologique',
                //     'CONSULTATION pédiatrique'
            ]),
            caregiver: faker.helpers.arrayElement(this.realCaregivers),
            weight: faker.number.int({ min: 50, max: 120 }).toString(),
            height: faker.number.int({ min: 150, max: 200 }).toString(),
            temperature: faker.number.float({ min: 36, max: 39, fractionDigits: 1 }).toString(),
            tension: faker.number.int({ min: 10, max: 20 }).toString(),
            pulse: faker.number.int({ min: 60, max: 100 }).toString(),
            report: faker.lorem.sentence(10),
            summary: faker.lorem.sentence(5),
            prescription: faker.lorem.sentence(8),
            acts: faker.helpers.arrayElements([
                "SALLE D'ACCOUCHEMENT",
                'CHAMBRE CATÉGORIE 1',
                'ACCOUCHEMENT - HONORAIRES GYN',
                'CHAMBRE CATÉGORIE 2',
                'PHARMACIE'
            ], { min: 1, max: 3 })
        };
    }
    // consultation-data-generator.ts
    static generateUpdatedData(): Partial<ConsultationData> {
        return {
            report: faker.lorem.sentence(12) + ' (modifié)',
            summary: faker.lorem.sentence(6) + ' (modifié)',
            prescription: faker.lorem.sentence(9) + ' (modifié)',
            acts: faker.helpers.arrayElements([
                "ECG"
            ], { min: 1, max: 2 })
        };
    }
}