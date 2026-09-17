// pages/structure/generator/honoraire-data-generator.ts
import { faker } from '@faker-js/faker';

export interface HonorairePeriod {
    dateDebut: string; // format YYYY-MM-DD (attendu par <input type="date">)
    dateFin: string;   // format YYYY-MM-DD
}

export class HonoraireDataGenerator {
    private static formatDate(date: Date): string {
        return date.toISOString().split('T')[0];
    }

    /**
     * Génère une période large se terminant aujourd'hui, pour maximiser les chances
     * de trouver des actes médicaux déjà facturés (éligibles aux honoraires).
     * Par défaut : les 12 derniers mois. Le nombre de mois est légèrement randomisé
     * pour limiter les collisions entre plusieurs relevés créés lors de tests successifs.
     */
    static generateLargePeriod(minMonthsBack: number = 10, maxMonthsBack: number = 14): HonorairePeriod {
        const monthsBack = faker.number.int({ min: minMonthsBack, max: maxMonthsBack });
        const dateFin = new Date();
        const dateDebut = new Date();
        dateDebut.setMonth(dateDebut.getMonth() - monthsBack);

        return {
            dateDebut: this.formatDate(dateDebut),
            dateFin: this.formatDate(dateFin)
        };
    }

    /** Date du jour, au format attendu par un input[type=date] (date de paiement par défaut). */
    static generatePaymentDate(): string {
        return this.formatDate(new Date());
    }
}
