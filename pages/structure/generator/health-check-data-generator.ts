// pages/structure/generator/health-check-data-generator.ts
import { faker } from '@faker-js/faker';

export class HealthCheckDataGenerator {
    /**
     * Génère un texte de diagnostic aléatoire pour le formulaire "Ajouter Bilan".
     */
    static generateDiagnostic(): string {
        return faker.lorem.sentence(8);
    }
}
