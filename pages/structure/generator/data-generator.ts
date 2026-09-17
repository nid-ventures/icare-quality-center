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

const VALID_PHONE_PREFIXES = ['70', '71', '75', '76', '77', '78'];
const CITIES = ['DAKAR', 'SAINT-LOUIS', 'THIÈS', 'ZIGUINCHOR', 'KAOLACK'];
const STATES = ['DAKAR', 'THIÈS', 'SAINT-LOUIS', 'KOLDA', 'ZIGUINCHOR'];
const NATIONALITIES = ['SENEGALAIS(E)', 'BENINOIS(E)', 'IVOIRIEN(E)', 'MALIEN(NE)', 'FRANCAIS(E)'];
const HI_CONFIG_OPTIONS = ['Activé', 'Désactivé'];

function generateSenegalesePhoneNumber(): string {
    const prefix = faker.helpers.arrayElement(VALID_PHONE_PREFIXES);
    return `+221${prefix}${faker.string.numeric(7)}`;
}

/**
 * S'assure que la date est au format YYYY-MM-DD (au cas où le format d'origine serait différent, ex: DD/MM/YYYY)
 */
function normalizeDob(dob: string): string {
    if (dob && dob.includes('/')) {
        const [day, month, year] = dob.split('/');
        return `${year}-${month}-${day}`;
    }
    return dob;
}

export class PatientDataGenerator {
    static generate(): PatientData {
        return {
            folderOrder: faker.string.alphanumeric(8).toUpperCase(),
            sex: faker.helpers.arrayElement(['1', '2']),
            lastName: faker.person.lastName(),
            firstName: faker.person.firstName(),
            dob: faker.date.birthdate({ min: 18, max: 90, mode: 'age' }).toISOString().split('T')[0],
            email: faker.internet.email(),
            phonePrimary: generateSenegalesePhoneNumber(),
            phoneSecondary: generateSenegalesePhoneNumber(),
            address: faker.location.streetAddress(),
            street: faker.location.street(),
            city: faker.helpers.arrayElement(CITIES),
            state: faker.helpers.arrayElement(STATES),
            country: 'SENEGAL',
            nationality: faker.helpers.arrayElement(NATIONALITIES),
            hiConfig: faker.helpers.arrayElement(HI_CONFIG_OPTIONS),
        };
    }

    /**
     * Crée un doublon à partir d'un patient existant (même dob et même phonePrimary)
     */
    static generateDuplicateFrom(original: PatientData): PatientData {
        return {
            folderOrder: faker.string.alphanumeric(8).toUpperCase(),
            sex: faker.helpers.arrayElement(['1', '2']),
            lastName: faker.person.lastName(),
            firstName: faker.person.firstName(),
            dob: normalizeDob(original.dob),
            email: faker.internet.email(),
            phonePrimary: original.phonePrimary,
            phoneSecondary: generateSenegalesePhoneNumber(),
            address: faker.location.streetAddress(),
            street: faker.location.street(),
            city: faker.helpers.arrayElement(CITIES),
            state: faker.helpers.arrayElement(STATES),
            country: 'SENEGAL',
            nationality: faker.helpers.arrayElement(NATIONALITIES),
            hiConfig: faker.helpers.arrayElement(HI_CONFIG_OPTIONS),
        };
    }
}
