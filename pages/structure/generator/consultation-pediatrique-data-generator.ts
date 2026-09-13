// pages/structure/generator/consultation-pediatrique-data-generator.ts
import { faker } from '@faker-js/faker';

export interface ConsultationPediatriqueData {
    specialty: string;           // 'pédiatrie'
    consultationType: string;    // 'CONSULTATION PÉDIATRIQUE'
    caregiver: string;           // Nom du médecin (liste réelle)
    weight: string;
    height: string;
    temperature: string;
    tension: string;
    pulse: string;
    pc: string;                  // périmètre crânien
    pb: string;                  // périmètre brachial (? à adapter)
    report: string;
    summary: string;
    prescription: string;
    acts: string[];
}

export class ConsultationPediatriqueDataGenerator {
    // Liste réelle des soignants (basée sur les données actuelles de l'environnement de test).
    private static readonly realCaregivers = [
        'KANE AMADOU',
        'BOL@ KARIM',
        'KADER Abdallah',
        'KONATE 12 ALY 12',
        'NANO ADO',
        'SERELA ANAIS'
    ];

    static generate(): ConsultationPediatriqueData {
        return {
            specialty: 'pédiatrie',
            consultationType: 'CONSULTATION pédiatrique',
            caregiver: faker.helpers.arrayElement(this.realCaregivers),
            weight: faker.number.int({ min: 5, max: 50 }).toString(),
            height: faker.number.int({ min: 50, max: 150 }).toString(),
            temperature: faker.number.float({ min: 36, max: 39, fractionDigits: 1 }).toString(),
            tension: faker.number.int({ min: 8, max: 15 }).toString(),
            pulse: faker.number.int({ min: 80, max: 140 }).toString(),
            pc: faker.number.int({ min: 30, max: 55 }).toString(),
            pb: faker.number.int({ min: 10, max: 25 }).toString(),
            report: faker.lorem.sentence(10),
            summary: faker.lorem.sentence(5),
            prescription: faker.lorem.sentence(8),
            acts: faker.helpers.arrayElements([
                'INJECTION INTRA-MUSCULAIRE',
                'INJECTION INTRA-VEINEUSE DIRECTE',
                'ANTIGÈNE HBS',
                'GLYCÉMIE',
                'PRÉLÈVEMENT'
            ], { min: 1, max: 2 })
        };
    }

    static generateUpdatedData(): Partial<ConsultationPediatriqueData> {
        return {
            report: faker.lorem.sentence(12) + ' (modifié)',
            summary: faker.lorem.sentence(6) + ' (modifié)',
            prescription: faker.lorem.sentence(9) + ' (modifié)',
            acts: faker.helpers.arrayElements([
                'GLYCÉMIE'
            ], { min: 1, max: 2 })
        };
    }
}