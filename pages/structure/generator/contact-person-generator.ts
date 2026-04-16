import { faker } from '@faker-js/faker';
import { ContactPersonData } from '../patient/detail_administratif.page';

export class ContactPersonGenerator {
    static generate(): ContactPersonData {
        const validPrefixes = ['70', '71', '75', '76', '77', '78'];
        const prefix = faker.helpers.arrayElement(validPrefixes);
        const phonePrimary = `+221${prefix}${faker.string.numeric(7)}`;
        const phoneSecondary = `+221${faker.helpers.arrayElement(validPrefixes)}${faker.string.numeric(7)}`;

        return {
            firstName: faker.person.firstName(),
            lastName: faker.person.lastName(),
            phonePrimary,
            phoneSecondary,
            linkType: '17',     // À ajuster selon vos besoins
            sex: faker.helpers.arrayElement(['1', '2']),
            dob: faker.date.birthdate({ min: 18, max: 80, mode: 'age' }).toISOString().split('T')[0],
            relation: faker.helpers.arrayElement(['Frère', 'Sœur', 'Père', 'Mère', 'Conjoint', 'Fils', 'Fille']),
            address: faker.location.streetAddress(),
            city: '71',         // Code Dakar (exemple)
            region: '52',       // Code région (exemple)
            country: '109',     // Code Sénégal (exemple)
            nationality: '35',  // Code Sénégalais (exemple)
        };
    }
}