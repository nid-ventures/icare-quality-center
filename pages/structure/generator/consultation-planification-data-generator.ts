// tests/pages/structure/generator/consultation-planification-data-generator.ts
import { faker } from '@faker-js/faker';

export interface ConsultationPlanificationData {
    specialty: string;
    consultationType: string;
    consultant: string;
    height: string;
    weight: string;
    weightGain?: string;
    temperature: string;
    bloodPressure: string;
    heartRate: string;
    pb?: string;
    lastPeriodDate: string;
    desirePregnancy: 'oui' | 'non' | 'plusTard';
    usesMethod: 'oui' | 'non';
    currentMethods?: string[];
    chosenMethods: string[];
    correctUsageExplained: boolean;
    sideEffectsDiscussed: boolean;
    istPreventionDiscussed: boolean;
    observations: string;
    nextAppointmentDate: string;
    acts: string[];
}

export class ConsultationPlanificationDataGenerator {
    private static readonly realConsultants = [
        'Médecin Saré',
        'Diane Benao',
        'Medecin TEST',
        'SANOU AROUNA'
    ];

    private static readonly contraceptionOptions = [
        'Préservatif',
        'Implant',
        'Méthodes naturelles',
        'Injection',
        'DIU (stérilet)',
        'Pilule'
    ];

    private static readonly billingActs = [
        "SALLE D'ACCOUCHEMENT",
        "CHAMBRE CATÉGORIE 1",
        "ACCOUCHEMENT - HONORAIRES GYN",
        "CHAMBRE CATÉGORIE 2",
        "PHARMACIE",
        "ECG"
    ];

    static generate(): ConsultationPlanificationData {
        const usesMethod = faker.helpers.arrayElement(['oui', 'non']);
        return {
            specialty: 'gynécologie-obstétrique',
            consultationType: 'CONSULTATION planification familiale',
            consultant: faker.helpers.arrayElement(this.realConsultants),
            height: faker.number.int({ min: 140, max: 190 }).toString(),
            weight: faker.number.int({ min: 45, max: 120 }).toString(),
            weightGain: faker.number.float({ min: -2, max: 5, fractionDigits: 1 }).toString(),
            temperature: faker.number.float({ min: 36, max: 38.5, fractionDigits: 1 }).toString(),
            bloodPressure: `${faker.number.int({ min: 90, max: 140 })}/${faker.number.int({ min: 60, max: 90 })}`,
            heartRate: faker.number.int({ min: 60, max: 100 }).toString(),
            pb: faker.number.int({ min: 20, max: 35 }).toString(),
            lastPeriodDate: faker.date.past({ years: 1 }).toISOString().split('T')[0],
            desirePregnancy: faker.helpers.arrayElement(['oui', 'non', 'plusTard']),
            usesMethod: usesMethod,
            currentMethods: usesMethod === 'oui' ? faker.helpers.arrayElements(this.contraceptionOptions, { min: 1, max: 2 }) : [],
            chosenMethods: faker.helpers.arrayElements(this.contraceptionOptions, { min: 1, max: 2 }),
            correctUsageExplained: faker.datatype.boolean(),
            sideEffectsDiscussed: faker.datatype.boolean(),
            istPreventionDiscussed: faker.datatype.boolean(),
            observations: faker.lorem.sentence(6),
            nextAppointmentDate: faker.date.future().toISOString().split('T')[0],
            acts: faker.helpers.arrayElements(this.billingActs, { min: 1, max: 2 })
        };
    }

    static generateUpdatedData(): Partial<ConsultationPlanificationData> {
        return {
            observations: faker.lorem.sentence(8) + ' (modifié)',
            nextAppointmentDate: faker.date.future().toISOString().split('T')[0],
            acts: faker.helpers.arrayElements(this.billingActs, { min: 1, max: 2 })
        };
    }

}