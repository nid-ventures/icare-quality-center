// tests/pages/data-generator.ts
import { faker } from '@faker-js/faker';

export interface PatientData {
    folderOrder: string;
    sex: string;         // '1' = Masculin, '2' = Féminin
    lastName: string;
    firstName: string;
    dob: string;         // format YYYY-MM-DD
    email: string;
    phonePrimary: string;
    phoneSecondary: string;
    address: string;
    street: string;
    city: string;
    state: string;
    country: string;
    nationality: string;
    hiConfig: string;
}

export class PatientDataGenerator {
    static generate(): PatientData {
        const sex = faker.helpers.arrayElement(['1', '2']);
        const validPrefixes = ['70', '71', '75', '76', '77', '78'];
        const primaryPrefix = faker.helpers.arrayElement(validPrefixes);
        const secondaryPrefix = faker.helpers.arrayElement(validPrefixes);
        const phonePrimary = `+221${primaryPrefix}${faker.string.numeric(7)}`;
        const phoneSecondary = `+221${secondaryPrefix}${faker.string.numeric(7)}`;

        return {
            folderOrder: faker.string.alphanumeric(8).toUpperCase(),
            sex,
            lastName: faker.person.lastName(),
            firstName: faker.person.firstName(),
            dob: faker.date.birthdate({ min: 18, max: 90, mode: 'age' }).toISOString().split('T')[0],
            email: faker.internet.email(),
            phonePrimary,
            phoneSecondary,
            address: faker.location.streetAddress(),
            street: faker.location.street(),
            city: faker.helpers.arrayElement(['DAKAR', 'SAINT-LOUIS', 'THIÈS', 'ZIGUINCHOR', 'KAOLACK']),
            state: faker.helpers.arrayElement(['DAKAR', 'THIÈS', 'SAINT-LOUIS', 'KOLDA', 'ZIGUINCHOR']),
            country: 'SENEGAL',
            nationality: faker.helpers.arrayElement([
                'SENEGALAIS(E)', 'BENINOIS(E)', 'IVOIRIEN(E)', 'MALIEN(NE)', 'FRANCAIS(E)'
            ]),
            hiConfig: faker.helpers.arrayElement(['Activé', 'Désactivé']),
        };
    }

    /**
     * Crée un doublon à partir d'un patient existant (même dob et même phonePrimary)
     */
    static generateDuplicateFrom(original: PatientData): PatientData {
        const sex = faker.helpers.arrayElement(['1', '2']);
        const validPrefixes = ['70', '71', '75', '76', '77', '78'];
        const secondaryPrefix = faker.helpers.arrayElement(validPrefixes);
        const phoneSecondary = `+221${secondaryPrefix}${faker.string.numeric(7)}`;

        return {
            folderOrder: faker.string.alphanumeric(8).toUpperCase(),
            sex,
            lastName: faker.person.lastName(),
            firstName: faker.person.firstName(),
            dob: original.dob,
            email: faker.internet.email(),
            phonePrimary: original.phonePrimary,
            phoneSecondary,
            address: faker.location.streetAddress(),
            street: faker.location.street(),
            city: faker.helpers.arrayElement(['DAKAR', 'SAINT-LOUIS', 'THIÈS', 'ZIGUINCHOR', 'KAOLACK']),
            state: faker.helpers.arrayElement(['DAKAR', 'THIÈS', 'SAINT-LOUIS', 'KOLDA', 'ZIGUINCHOR']),
            country: 'SENEGAL',
            nationality: faker.helpers.arrayElement([
                'SENEGALAIS(E)', 'BENINOIS(E)', 'IVOIRIEN(E)', 'MALIEN(NE)', 'FRANCAIS(E)'
            ]),
            hiConfig: faker.helpers.arrayElement(['Activé', 'Désactivé']),
        };
    }
}