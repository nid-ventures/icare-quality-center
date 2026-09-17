// pages/structure/generator/imaging-data-generator.ts
import { faker } from '@faker-js/faker';

export interface EchographieData {
    resume: string;
    compteRendu: string;
}

export interface ScannerData {
    // Réservé pour de futures données spécifiques au scanner (dates générées à part, voir todayIso()).
}

export class ImagingDataGenerator {
    static generateEchographie(): EchographieData {
        return {
            resume: faker.lorem.sentence(6),
            compteRendu: faker.lorem.sentence(12)
        };
    }

    static generateEchographieUpdate(): EchographieData {
        return {
            resume: faker.lorem.sentence(6) + ' (modifié)',
            compteRendu: faker.lorem.sentence(10) + ' (modifié)'
        };
    }

    // Date du jour au format yyyy-MM-dd, exploitable directement par un input[type=date].
    static todayIso(): string {
        return new Date().toISOString().split('T')[0];
    }
}
