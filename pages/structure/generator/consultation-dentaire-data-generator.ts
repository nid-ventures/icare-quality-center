import { faker } from '@faker-js/faker';

export interface ToothData {
    toothNumber: string;
    diagnostic: string;
    treatment: string;
    surfaces: string[];
    observations: string;
}

export interface ConsultationDentaireData {
    specialty: string;           // 'dentiste'
    consultationType: string;    // 'CONSULTATION dentaire'
    caregiver: string;           // Nom du dentiste (liste réelle)
    weight: string;
    height: string;
    temperature: string;
    tension: string;
    pulse: string;
    conclusion: string;          // synthèse / conclusion
    acts: string[];
    teeth: ToothData[];          // au moins 1 dent
}

export class ConsultationDentaireDataGenerator {
    private static readonly realCaregivers = [
        'Médecin Saré',
        'Diane Benao',
        'Medecin TEST',
        'SANOU AROUNA'
    ];

    private static readonly diagnostics = [
        'Dentinite',
        'Pulpite aiguë réversible',
        'DCI',
        'Fracture',
        'Gingivite',
        'Péricoronarite'
    ];

    private static readonly treatments = [
        'Coiffage indirect',
        'Composite',
        'Traitement endodontique',
        'PAP'
    ];

    private static readonly surfaces = [
        'OOcclusale',
        'MMésiale',
        'DDistale',
        'Vestibulaire',
        'Mésiale',
        'Distale'
    ];

    // Numéros de dents courants (notation FDI)
    private static readonly toothNumbers = [
        '11', '12', '13', '14', '15', '16', '17', '18',
        '21', '22', '23', '24', '25', '26', '27', '28',
        '31', '32', '33', '34', '35', '36', '37', '38',
        '41', '42', '43', '44', '45', '46', '47', '48'
    ];

    static generate(): ConsultationDentaireData {
        const numberOfTeeth = faker.number.int({ min: 1, max: 3 });
        const teeth: ToothData[] = [];

        for (let i = 0; i < numberOfTeeth; i++) {
            teeth.push({
                toothNumber: faker.helpers.arrayElement(this.toothNumbers),
                diagnostic: faker.helpers.arrayElement(this.diagnostics),
                treatment: faker.helpers.arrayElement(this.treatments),
                surfaces: faker.helpers.arrayElements(this.surfaces, { min: 1, max: 2 }),
                observations: faker.lorem.sentence(5)
            });
        }

        return {

            specialty: faker.helpers.arrayElement([
                // 'anesthésie-réanimation',
                //   'cardiologie',
                //   'dermatologie',
                //    'gynécologie',
                'dentiste'
            ]),
            consultationType: faker.helpers.arrayElement([
                //'CONSULTATION anesthésique',
                //     'CONSULTATION cardiologique',
                //     'CONSULTATION dermatologique',
                //     'CONSULTATION gynécologique',
                'CONSULTATION dentaire'
            ]),
            caregiver: faker.helpers.arrayElement(this.realCaregivers),
            weight: faker.number.int({ min: 40, max: 120 }).toString(),
            height: faker.number.int({ min: 140, max: 200 }).toString(),
            temperature: faker.number.float({ min: 36, max: 39, fractionDigits: 1 }).toString(),
            tension: faker.number.int({ min: 9, max: 16 }).toString(),
            pulse: faker.number.int({ min: 60, max: 100 }).toString(),
            conclusion: faker.lorem.sentence(8),
            acts: faker.helpers.arrayElements([
                "SALLE D'ACCOUCHEMENT",
                'CHAMBRE CATÉGORIE 1',
                'ACCOUCHEMENT - HONORAIRES GYN',
                'CHAMBRE CATÉGORIE 2',
                'PHARMACIE'
            ], { min: 1, max: 2 }),
            teeth
        };
    }

    static generateUpdatedData(): Partial<ConsultationDentaireData> {
        return {
            conclusion: faker.lorem.sentence(10) + ' (modifié)',
            acts: faker.helpers.arrayElements(['ECG'], { min: 1, max: 2 })
        };
    }
}