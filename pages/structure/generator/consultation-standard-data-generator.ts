// pages/structure/generator/consultation-standard-data-generator.ts
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
    // Liste réelle des soignants (basée sur les données actuelles de l'environnement de test).
    private static readonly realCaregivers = [
        'KANE AMADOU',
        'BOL@ KARIM',
        'KADER Abdallah',
        'KONATE 12 ALY 12',
        'NANO ADO',
        'SERELA ANAIS'
    ];
    static generate(): ConsultationData {
        return {
            specialty: 'anesthésie-réanimation',
            consultationType: 'CONSULTATION anesthésique',
            caregiver: faker.helpers.arrayElement(this.realCaregivers),
            weight: faker.number.int({ min: 50, max: 120 }).toString(),
            height: faker.number.int({ min: 150, max: 200 }).toString(),
            temperature: faker.number.float({ min: 36, max: 39, fractionDigits: 1 }).toString(),
            tension: faker.number.int({ min: 10, max: 20 }).toString(),
            pulse: faker.number.int({ min: 60, max: 100 }).toString(),
            report: faker.lorem.sentence(10),
            summary: faker.lorem.sentence(5),
            prescription: faker.lorem.sentence(8),
            // Actes réels proposés pour la spécialité "anesthésie-réanimation" / type "CONSULTATION anesthésique"
            // dans l'environnement de test (catalogue différent de celui de la prise en charge).
            acts: faker.helpers.arrayElements([
                'INJECTION INTRA-MUSCULAIRE',
                'INJECTION INTRA-VEINEUSE DIRECTE',
                'ANTIGÈNE HBS',
                'GLYCÉMIE',
                'GROUPAGE SANGUIN & RHÉSUS (GSRH)',
                'PRÉLÈVEMENT'
            ], { min: 1, max: 3 })
        };
    }

    static generateUpdatedData(): Partial<ConsultationData> {
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