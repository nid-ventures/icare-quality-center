// pages/structure/generator/account-data-generator.ts
import { faker } from '@faker-js/faker';

export interface AccountData {
    login: string;
    firstName: string;
    lastName: string;
    password: string;
}

/**
 * Génère un login (email) unique à chaque exécution afin d'éviter le message
 * "Ce login est déjà utilisé" en cas de ré-exécution des tests.
 */
function generateUniqueLogin(): string {
    const uniquePart = faker.string.alphanumeric({ length: 10 }).toLowerCase();
    return `e2e.account.${uniquePart}@icare-e2e-test.com`;
}

export class AccountDataGenerator {
    static generate(): AccountData {
        const password = `Aa1!${faker.string.alphanumeric({ length: 8 })}`;
        return {
            login: generateUniqueLogin(),
            firstName: faker.person.firstName(),
            lastName: faker.person.lastName(),
            password,
        };
    }
}
