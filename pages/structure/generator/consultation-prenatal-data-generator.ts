// tests/pages/structure/generator/consultation-prenatal-data-generator.ts
import { faker } from '@faker-js/faker';

export interface ExamenCliniqueItem {
    code: string;
    label: string;
    resultat: string;
}

export interface BandeletteTestItem {
    code: string;
    label: string;
    resultat: string;
}

export interface ConsultationPrenatalData {
    specialty: string;
    consultationType: string;
    consultant: string;
    firstConsultation: 'oui' | 'non';
    previousConsultationsCount?: string;
    dateDerniereRegle: string;
    emergency: 'oui' | 'non';
    height: string;
    weight: string;
    weightGain?: string;
    temperature: string;
    bloodPressure: string;
    heartRate: string;
    pb?: string;
    symptomes: string[];
    autresSymptomes?: string;
    maf: string;
    signeParticulier?: string;
    appearance?: string;
    examensCliniques: ExamenCliniqueItem[];
    bandeletteTests: BandeletteTestItem[];
    echoDate1?: string;
    echoDate2?: string;
    echoDate3?: string;
    echoDateLast?: string;
    echoPoidsBebe?: string;
    echoBip?: string;
    echoPerimetreCranien?: string;
    echoRythmeCardiaque?: string;
    echoAutresMesures?: string;
    echoPositionBebe?: 'tete' | 'siege' | 'autre';
    echoAnomalies?: 'oui' | 'non';
    echoPrecisionAnomalies?: string;
    traitementsConseils: string[];
    dateNextRdvConsultation?: string;
    dateNextRdvEcho?: string;
    termRDV?: string;
    monitoringEndPregnancy?: string;
    childbirthValidatedWay?: 'oui' | 'non';
    consultationAnesthesia?: 'oui' | 'non';
    acts: string[];
}

export class ConsultationPrenatalDataGenerator {
    private static readonly realConsultants = [
        'Médecin Saré', 'Diane Benao', 'Medecin TEST', 'SANOU AROUNA'
    ];

    // Valeurs exactes du test brut
    private static readonly symptomesList = [
        'Œdème aux membres inférieurs',
        'Troubles urinaires',
        'Autres'
    ];

    private static readonly mafList = [
        '+/-'
    ];

    private static readonly examensCliniquesList = [
        { code: 'muqueuses', label: 'Muqueuses' },
        { code: 'apparance', label: 'Apparance' }
    ];

    private static readonly bandeletteTestsList = [
        { code: 'sucre', label: 'Sucre' },
        { code: 'proteines', label: 'Protéines' },
        { code: 'nitrites', label: 'Nitrites/Leucocytes' }
    ];

    private static readonly traitementsConseilsList = [
        'PTME',
        'Activité physique adaptée'
    ];

    private static readonly billingActs = [
        "SALLE D'ACCOUCHEMENT"
    ];

    static generate(): ConsultationPrenatalData {
        const firstConsultation = faker.helpers.arrayElement(['oui', 'non']);
        const ddr = '2026-06-08'; // valeur fixe pour reproductibilité, ou faker
        // const ddr = faker.date.past({ years: 1 }).toISOString().split('T')[0];

        // Sélectionne 2 symptômes parmi la liste, dont parfois "Autres"
        let symptomes = faker.helpers.arrayElements(this.symptomesList, { min: 1, max: 2 });
        let autresSymptomes: string | undefined = undefined;
        if (symptomes.includes('Autres')) {
            autresSymptomes = 'oui';
        }

        const examensCliniques = this.examensCliniquesList.map(ex => ({
            ...ex,
            resultat: ex.code === 'muqueuses' ? '1A' : 'quelque chose'
        }));

        const bandeletteTests = this.bandeletteTestsList.map(bt => ({
            ...bt,
            resultat: bt.code === 'sucre' ? '1' : bt.code === 'nitrites' ? '2' : '3'
        }));

        return {
            specialty: 'gynécologie-obstétrique',
            consultationType: 'CONSULTATION prénatale',
            consultant: faker.helpers.arrayElement(this.realConsultants),
            firstConsultation,
            previousConsultationsCount: firstConsultation === 'non' ? '1' : undefined,
            dateDerniereRegle: ddr,
            emergency: 'non',
            height: '1',
            weight: '2',
            weightGain: '4',
            temperature: '5',
            bloodPressure: '6',
            heartRate: '7',
            pb: '8',
            symptomes,
            autresSymptomes,
            maf: faker.helpers.arrayElement(this.mafList),
            signeParticulier: 'non non',
            appearance: 'perte oui',
            examensCliniques,
            bandeletteTests,
            echoDate1: '2026-06-06',
            echoDate2: '2026-06-21',
            echoDate3: '2026-06-05',
            echoDateLast: '2026-06-20',
            echoPoidsBebe: '12',
            echoBip: '11',
            echoPerimetreCranien: '13',
            echoRythmeCardiaque: '14',
            echoAutresMesures: 'le mseyeeee',
            echoPositionBebe: 'tete',
            echoAnomalies: 'oui',
            echoPrecisionAnomalies: 'precisions',
            traitementsConseils: this.traitementsConseilsList,
            dateNextRdvConsultation: '2026-06-12',
            dateNextRdvEcho: '2026-06-21',
            termRDV: '2026-06-19',
            monitoringEndPregnancy: 'surveillance',
            childbirthValidatedWay: 'non',
            consultationAnesthesia: 'non',
            acts: this.billingActs
        };
    }

    static generateUpdatedData(): Partial<ConsultationPrenatalData> {
        return {
            weightGain: '4.5',
            temperature: '36.5',
            bloodPressure: '110/70',
            signeParticulier: 'modifié',
            monitoringEndPregnancy: 'surveillance modifiée',
            acts: ["SALLE D'ACCOUCHEMENT"]
        };
    }
}