import { type Page, type Locator, expect } from '@playwright/test';
interface Field {
  name: string;
  fill: (value: string) => Promise<void>;
  value: string;
  displayValue: string;
}
export class PatientPage {
  private readonly firstChildRowTablePatient: Locator;
  private readonly patientLink: Locator;
  private readonly patientHeading: Locator;
  private readonly menuButton: Locator;
  private readonly patientUrl: Promise<void>;
  //PATIENTS LISTE ELEMENTS
  private readonly identifiantLabel: Locator;
  private readonly numbDossierLabel: Locator;
  private readonly prenomLabel: Locator;
  private readonly nomLabel: Locator;
  private readonly dateNaissanceLabel: Locator;
  private readonly emailLabel: Locator;
  private readonly sexeLabel: Locator;
  private readonly villeLabel: Locator;
  private readonly assuranceLabel: Locator;
  private readonly dateCreationLabel: Locator;
  private readonly telephoneLabel: Locator;
  private readonly listeHeading: Locator;
  private readonly buttonInit: Locator;
  private readonly buttonRechercher: Locator;
  private readonly comboboxTaille: Locator;
  private readonly buttonNouveau: Locator;
  private readonly columnheaderIdentifiant: Locator;
  private readonly columnheaderNDossier: Locator;
  private readonly columnheaderPrenom: Locator;
  private readonly columnheaderNom: Locator;
  private readonly columnheaderDateNaissance: Locator;
  private readonly columnheaderTelephone: Locator;
  private readonly columnheaderEmail: Locator;
  private readonly columnheaderVille: Locator;
  private readonly columnheaderSexe: Locator;
  private readonly columnheaderAssurance: Locator;
  private readonly columnheaderDateCréation: Locator;
  private readonly columnheaderAction: Locator;
  private readonly precedentLabel: Locator;
  private readonly suivantLabel: Locator;
  // HELPER FIELDS
  private readonly numeroPhone: Locator;
  private readonly buttonResetForms: Locator;
  // ======================== RÉCUPÉRATION DES VALEURS DU PREMIER PATIENT ========================
  private readonly patientId: Promise<string>;
  private readonly folderOrder: Promise<string>;
  private readonly firstName: Promise<string>;
  private readonly lastName: Promise<string>;
  private readonly dateNaissance: Promise<string>;
  private readonly phone: Promise<string>;
  private readonly email: Promise<string>;
  private readonly city: Promise<string>;
  private readonly sexe: Promise<string>;
  private readonly assurance: Promise<string>;
  private readonly dateCreation: Promise<string>;
  private readonly identifiantInput: Locator;
  private readonly numbDossierInput: Locator;
  private readonly prenomInput: Locator;
  private readonly nomInput: Locator;
  private readonly emailInput: Locator;
  private readonly dateCreationInput: Locator;
  private readonly dateNaissanceInput: Locator;
  private readonly tabbleRow: Locator;
  private readonly buttonRechercherHelper: Locator;
  // Propriétés à ajouter
  private readonly modalCreate: Locator;
  private readonly folderOrderInput: Locator;
  private readonly sexSelect: Locator;
  private readonly lastNameInput: Locator;
  private readonly firstNameInput: Locator;
  private readonly dobCreateInput: Locator;
  private readonly emailCreateInput: Locator;
  private readonly phonePrimaryInput: Locator;
  private readonly phoneSecondaryInput: Locator;
  private readonly addressInput: Locator;
  private readonly streetInput: Locator;
  private readonly citySelect: Locator;
  private readonly stateSelect: Locator;
  private readonly countrySelect: Locator;
  private readonly nationalitySelect: Locator;
  private readonly hiConfigSelect: Locator;
  private readonly saveButton: Locator;
  private readonly confirmButton: Locator;
  private readonly buttonWiewDuplicat: Locator;
  private readonly radioOptionDuplicat: Locator;
  private readonly buttonValiderChoix: Locator;
  private readonly buttonConfirmValiderChoix: Locator;
  private readonly buttonIgnoreAndCreate: Locator;
  private readonly buttonSupprimerPatient: Locator;
  private readonly infosAdminHeading: Locator;
  private readonly identiteMedHeading: Locator;
  private readonly AntecedentHeading: Locator;
  private readonly prestationMediHeading: Locator;
  private readonly parcoursSoinsHeading: Locator;
  private readonly infoUtileHeading: Locator;
  private readonly voirDetailAdminHeading: Locator;
  private readonly derniereActiviteHeading: Locator;

  constructor(private readonly page: Page) {
    this.firstChildRowTablePatient = page.locator('.compact-table tbody tr:first-child');
    this.patientHeading = page.getByRole('heading', { name: 'Patients' });
    this.patientLink = page.getByRole('link', { name: ' Patients' });
    this.menuButton = page.getByText('Menu').nth(1);
    this.patientUrl = page.waitForURL('**/patient/patients');
    this.identifiantLabel = page.getByText('Identifiant patient');
    this.identifiantInput = page.getByPlaceholder('Identifiant...');
    this.numbDossierLabel = page.locator('label').filter({ hasText: 'N° Dossier' });
    this.numbDossierInput = page.getByPlaceholder('N° dossier...');
    this.prenomLabel = page.locator('label').filter({ hasText: /^Prénom$/ });
    this.prenomInput = page.getByRole('textbox', { name: 'Prénom...' });
    this.nomLabel = page.locator('label').filter({ hasText: /^Nom$/ });
    this.nomInput = page.getByRole('textbox', { name: 'Nom...', exact: true });
    this.dateNaissanceLabel = page.locator('label').filter({ hasText: /^Date de naissance$/ });
    this.dateNaissanceInput = page.locator('form.search-form input[name="doB"]');
    this.emailLabel = page.locator('label').filter({ hasText: /^Email$/ });
    this.emailInput = page.getByPlaceholder('Email...');
    this.sexeLabel = page.locator('label').filter({ hasText: /^Sexe$/ });
    this.villeLabel = page.locator('label').filter({ hasText: /^Ville$/ });
    this.assuranceLabel = page.locator('label').filter({ hasText: 'Assurance' });
    this.dateCreationLabel = page.locator('label').filter({ hasText: 'Date de création' });
    this.dateCreationInput = page.locator('input[type="date"][name="createdDate"]')
    this.telephoneLabel = page.locator('label').filter({ hasText: /^Téléphone$/ });
    this.listeHeading = page.getByRole('heading', { name: 'Liste des patients' });
    this.buttonInit = page.getByRole('button', { name: ' Réinitialiser' });
    this.buttonRechercher = page.getByRole('button', { name: ' Rechercher' });
    this.comboboxTaille = page.locator('ng-select').filter({ hasText: '× 20' }).getByRole('combobox');
    this.buttonNouveau = page.getByRole('button', { name: ' Nouveau patient' });
    this.columnheaderIdentifiant = page.getByRole('columnheader', { name: 'Identifiant' });
    this.columnheaderNDossier = page.getByRole('columnheader', { name: 'N° Dossier' });
    this.columnheaderPrenom = page.getByRole('columnheader', { name: 'Prénom' });
    this.columnheaderNom = page.getByRole('columnheader', { name: 'Nom', exact: true });
    this.columnheaderDateNaissance = page.getByRole('columnheader', { name: 'Date de naissance' });
    this.columnheaderTelephone = page.getByRole('columnheader', { name: 'Téléphone' });
    this.columnheaderEmail = page.getByRole('columnheader', { name: 'Email' });
    this.columnheaderVille = page.getByRole('columnheader', { name: 'Ville' });
    this.columnheaderSexe = page.getByRole('columnheader', { name: 'Sexe' });
    this.columnheaderAssurance = page.getByRole('columnheader', { name: 'Assurance' });
    this.columnheaderDateCréation = page.getByRole('columnheader', { name: 'Date de création' });
    this.columnheaderAction = page.getByRole('columnheader', { name: 'Action' });
    this.precedentLabel = page.getByText('Précédent');
    this.suivantLabel = page.getByText('Suivant');
    this.numeroPhone = page.getByRole('textbox', { name: 'Entrez le numéro' });
    this.buttonResetForms = page.getByRole('button', { name: 'Réinitialiser' });

    // ======================== RÉCUPÉRATION DES VALEURS DU PREMIER PATIENT ========================
    this.firstChildRowTablePatient = page.locator('.compact-table tbody tr:first-child');
    this.patientId = this.firstChildRowTablePatient.locator('td:first-child').innerText();
    this.folderOrder = this.firstChildRowTablePatient.locator('td:nth-child(2)').innerText();
    this.firstName = this.firstChildRowTablePatient.locator('td:nth-child(3)').innerText();
    this.lastName = this.firstChildRowTablePatient.locator('td:nth-child(4)').innerText();
    this.dateNaissance = this.firstChildRowTablePatient.locator('td:nth-child(5)').innerText();
    this.phone = this.firstChildRowTablePatient.locator('td:nth-child(6)').innerText();
    this.email = this.firstChildRowTablePatient.locator('td:nth-child(7)').innerText();
    this.city = this.firstChildRowTablePatient.locator('td:nth-child(8)').innerText();
    this.sexe = this.firstChildRowTablePatient.locator('td:nth-child(9)').innerText();
    this.assurance = this.firstChildRowTablePatient.locator('td:nth-child(10)').innerText();
    this.dateCreation = this.firstChildRowTablePatient.locator('td:nth-child(11)').innerText();
    this.tabbleRow = page.locator('.compact-table tbody tr');
    this.buttonRechercherHelper = page.getByRole('button', { name: 'Rechercher' });

    this.modalCreate = page.locator('#bd-example-modal-lg');
    this.folderOrderInput = this.modalCreate.getByRole('textbox', { name: 'Numéro Dossier' });
    this.sexSelect = this.modalCreate.locator('select[name="sex"]');
    this.lastNameInput = this.modalCreate.locator('#lastName');
    this.firstNameInput = this.modalCreate.locator('#firstName');
    this.dobCreateInput = this.modalCreate.locator('#collapseOne_create input[name="doB"]');
    this.emailCreateInput = this.modalCreate.getByRole('textbox', { name: 'Email', exact: true });
    this.phonePrimaryInput = this.modalCreate.locator('app-intl-tel-input').first().locator('input[type="tel"]');
    this.phoneSecondaryInput = this.modalCreate.locator('app-intl-tel-input').nth(1).locator('input[type="tel"]');
    this.addressInput = this.modalCreate.locator('#address');
    this.streetInput = this.modalCreate.locator('#street');
    this.citySelect = this.modalCreate.locator('ng-select#city');
    this.stateSelect = this.modalCreate.locator('ng-select#state');
    this.countrySelect = this.modalCreate.locator('ng-select#country');
    this.nationalitySelect = this.modalCreate.locator('ng-select#nationality');
    this.hiConfigSelect = this.modalCreate.locator('ng-select#hiConfigId');
    this.saveButton = this.modalCreate.getByRole('button', { name: 'Enregistrer' });
    this.confirmButton = page.getByRole('button', { name: 'Confirmer' });
    this.buttonWiewDuplicat = page.getByRole('button', { name: 'Listes des duplicatats' });
    this.buttonIgnoreAndCreate = page.getByRole('button', { name: 'Ignorer et créer le patient' });
    this.radioOptionDuplicat = page.locator('#flexRadioDefault1');
    this.buttonValiderChoix = page.getByRole('button', { name: 'Valider le choix' });
    this.buttonConfirmValiderChoix = page.getByRole('button', { name: 'Confirmer' })
    this.buttonSupprimerPatient = page.locator('.compact-table tbody tr:first-child .btn-danger').first()

    // Vérifier que la page du patient s'affiche
    this.infosAdminHeading = page.getByRole('heading', { name: 'Informations Administratives' });
    this.identiteMedHeading = page.getByRole('heading', { name: 'Identité Médicale' });
    this.AntecedentHeading = page.getByRole('heading', { name: 'Antécédents' });
    this.prestationMediHeading = page.getByRole('heading', { name: 'Prestation Médicale' });
    this.parcoursSoinsHeading = page.getByRole('heading', { name: 'Parcours de soins' });
    this.infoUtileHeading = page.getByRole('heading', { name: 'Informations Utiles' });
    this.voirDetailAdminHeading = page.getByRole('link', { name: 'Voir Détails Administratifs' });
    this.derniereActiviteHeading = page.getByRole('columnheader', { name: 'Dernières activités' });

  }
  async checkPatientsList() {
    // Attendre la page d'accueil et ouvrir le menu
    await expect(this.patientHeading).toBeVisible();
    await this.patientLink.click();
    await this.patientUrl;

    await expect(this.identifiantLabel).toBeVisible();
    await expect(this.numbDossierLabel).toBeVisible();
    await expect(this.prenomLabel).toBeVisible();
    await expect(this.nomLabel).toBeVisible();
    await expect(this.dateNaissanceLabel).toBeVisible();
    await expect(this.emailLabel).toBeVisible();
    await expect(this.sexeLabel).toBeVisible();
    await expect(this.villeLabel).toBeVisible();
    await expect(this.assuranceLabel).toBeVisible();
    await expect(this.dateCreationLabel).toBeVisible();
    await expect(this.telephoneLabel).toBeVisible();

    await expect(this.listeHeading).toBeVisible();
    await expect(this.buttonInit).toBeVisible();
    await expect(this.buttonRechercher).toBeVisible();
    await expect(this.comboboxTaille).toBeVisible();
    await expect(this.buttonNouveau).toBeVisible();

    // En-têtes du tableau
    await expect(this.columnheaderIdentifiant).toBeVisible();
    await expect(this.columnheaderNDossier).toBeVisible();
    await expect(this.columnheaderPrenom).toBeVisible();
    await expect(this.columnheaderNom).toBeVisible();
    await expect(this.columnheaderDateNaissance).toBeVisible();
    await expect(this.columnheaderTelephone).toBeVisible();
    await expect(this.columnheaderEmail).toBeVisible();
    await expect(this.columnheaderVille).toBeVisible();
    await expect(this.columnheaderSexe).toBeVisible();
    await expect(this.columnheaderAssurance).toBeVisible();
    await expect(this.columnheaderDateCréation).toBeVisible();
    await expect(this.columnheaderAction).toBeVisible();

    // Pagination
    await expect(this.precedentLabel).toBeVisible();
    await expect(this.suivantLabel).toBeVisible();

  }
  async chooseFirstPatient() {
    // Attendre la page d'accueil et ouvrir le menu
    await expect(this.patientHeading).toBeVisible();
    await this.patientLink.click();
    await this.patientUrl;
    // Attendre que le tableau soit chargé
    await expect(this.firstChildRowTablePatient).toBeVisible();
    // Cliquer sur la première ligne (dashboard patient)
    await this.firstChildRowTablePatient.click();
    await this.menuButton.click();
  }

  // ======================== HELPERS ========================
  async selectNgOption(label: string, optionText: string) {
    const container = this.page.locator(`ng-select:has-text("${label}")`);
    await container.click();
    await this.page.waitForSelector('.ng-dropdown-panel .ng-option', { timeout: 5000 });
    await this.page.locator(`.ng-dropdown-panel .ng-option:has-text("${optionText}")`).first().click();
  }

  async fillPhone(phone: string) {
    const phoneInput = this.numeroPhone;
    await phoneInput.fill(phone);
  }

  async resetForm() {
    await this.buttonResetForms.click();
    // Attendre que le tableau soit à nouveau rempli (au moins une ligne)
    await this.page.waitForFunction(() => {
      const rows = document.querySelectorAll('.compact-table tbody tr');
      return rows.length > 0;
    }, { timeout: 10000 });
  }
  // ======================== DÉFINITION DES CHAMPS ========================
  async definitionChamps(page: Page) {
    // Attendre la page d'accueil et ouvrir le menu
    await expect(this.patientHeading).toBeVisible();
    await this.patientLink.click();
    await this.patientUrl;
    // Fermer le menu pour dégager la vue (optionnel)
    await page.getByText('Menu').nth(1).click();

    const fields: Field[] = [];

    if (await this.patientId && await this.patientId !== '-') {
      fields.push({
        name: 'Identifiant patient',
        fill: async (val: string) => await this.identifiantInput.fill('123'),
        value: await this.patientId,
        displayValue: await this.patientId,
      });
    }

    if (await this.folderOrder && await this.folderOrder !== '-') {
      fields.push({
        name: 'N° Dossier',
        fill: async (val: string) => await this.numbDossierInput.fill(val),
        value: await this.folderOrder,
        displayValue: await this.folderOrder,
      });
    }

    if (await this.firstName && await this.firstName !== '-') {
      fields.push({
        name: 'Prénom',
        fill: async (val: string) => await this.prenomInput.fill(val),
        value: await this.firstName,
        displayValue: await this.firstName,
      });
    }

    if (await this.lastName && await this.lastName !== '-') {
      fields.push({
        name: 'Nom',
        fill: async (val: string) => await this.nomInput.fill(val),
        value: await this.lastName,
        displayValue: await this.lastName,
      });
    }


    if (await this.dateNaissance && await this.dateNaissance !== '-') {
      fields.push({
        name: 'Date de naissance',
        fill: async (val: string) => {
          const [day, month, year] = val.split('/');
          const isoDate = `${year}-${month}-${day}`;
          await this.dateNaissanceInput.fill(isoDate);
        },
        value: await this.dateNaissance,
        displayValue: await this.dateNaissance,
      });
    }

    if (await this.email && await this.email !== '-') {
      fields.push({
        name: 'Email',
        fill: async (val: string) => await this.emailInput.fill(val),
        value: await this.email,
        displayValue: await this.email,
      });
    }

    if (await this.sexe && await this.sexe !== '-') {
      fields.push({
        name: 'Sexe',
        fill: async (val: string) => await this.selectNgOption('Sexe', val),
        value: await this.sexe,
        displayValue: await this.sexe,
      });
    }

    if (await this.city && await this.city !== '-') {
      fields.push({
        name: 'Ville',
        fill: async (val: string) => await this.selectNgOption('Ville', val),
        value: await this.city,
        displayValue: await this.city,
      });
    }

    if (await this.assurance && await this.assurance !== '-') {
      fields.push({
        name: 'Assurance',
        fill: async (val: string) => await this.selectNgOption('Assurance', val),
        value: await this.assurance,
        displayValue: await this.assurance,
      });
    }

    if (await this.dateCreation && await this.dateCreation !== '-') {
      fields.push({
        name: 'Date de création',
        fill: async (val: string) => {
          const [day, month, year] = val.split('/');
          const isoDate = `${year}-${month}-${day}`;
          await this.dateCreationInput.fill(isoDate);
        },
        value: await this.dateCreation,
        displayValue: await this.dateCreation,
      });
    }

    if (await this.phone && await this.phone !== '-') {
      fields.push({
        name: 'Téléphone',
        fill: async (val: string) => await this.fillPhone(val),
        value: await this.phone,
        displayValue: await this.phone,
      });
    }

    // ======================== TESTS INDIVIDUELS ========================
    const n = fields.length;
    console.log(`Nombre de champs à tester : ${n}`);

    for (let i = 0; i < n; i++) {
      await this.resetForm();

      // Remplir uniquement le champ i
      await fields[i].fill(fields[i].value);

      console.log(`\n🔍 Test du champ : ${fields[i].name} = "${fields[i].displayValue}"`);

      await this.buttonRechercherHelper.click();
      await page.waitForTimeout(300);

      await this.logResult();

      // Vérifier que le patient de référence est trouvé
      try {
        await page.waitForSelector(`.compact-table tbody tr td:first-child:has-text("${await this.patientId}")`, { timeout: 1000 });
        console.log('✅ Patient de référence trouvé');
      } catch {
        console.log('⚠️ Patient de référence NON trouvé dans les résultats');
      }
    }


  }

  async logResult() {
    const rows = this.tabbleRow;
    const rowCount = await rows.count();
    console.log(`📊 Résultat : ${rowCount} patient(s) trouvé(s)`);
    if (rowCount > 0) {
      const firstRowCells = await rows.first().locator('td').allTextContents();
      console.log(`   Premier patient : ${firstRowCells.slice(0, 5).join(' | ')}`);
    }
  }

  async openCreationModal() {
    await this.buttonNouveau.click();
    await this.modalCreate.waitFor({ state: 'visible' });
  }

  private async selectNgOptionCreate(ngSelectLocator: Locator, optionText: string) {

    await ngSelectLocator.click();
    await this.page.waitForSelector('.ng-dropdown-panel .ng-option', { timeout: 5000 });
    await this.page.locator(`.ng-dropdown-panel .ng-option:has-text("${optionText}")`).first().click();
  }

  async fillCreationForm(hiConfig: string, data: {
    folderOrder: string;
    sex: string;
    lastName: string;
    firstName: string;
    dob: string;
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
  }, email?: string) {

    await this.folderOrderInput.fill(data.folderOrder);
    await this.sexSelect.selectOption(data.sex);
    await this.lastNameInput.fill(data.lastName);
    await this.firstNameInput.fill(data.firstName);
    await this.dobCreateInput.fill(data.dob);
    await this.emailCreateInput.fill(email ? email : data.email);
    await this.fillPhoneInput(this.phonePrimaryInput, data.phonePrimary);
    await this.fillPhoneInput(this.phoneSecondaryInput, data.phoneSecondary);
    await this.addressInput.fill(data.address);
    await this.streetInput.fill(data.street);
    await this.selectNgOptionCreate(this.citySelect, data.city);
    await this.selectNgOptionCreate(this.stateSelect, data.state);
    await this.selectNgOptionCreate(this.countrySelect, data.country);
    await this.selectNgOptionCreate(this.nationalitySelect, data.nationality);
    if (hiConfig == "Activé") {
      await this.page.locator('#hiConfigId > .ng-select-container > .ng-value-container > .ng-input > input').click();
      await this.page.getByRole('option', { name: 'Activé', exact: true }).click();
    } else {
      await this.selectNgOptionCreate(this.hiConfigSelect, hiConfig);

    }

  }

  async saveAndConfirm() {
    await this.saveButton.click();
    await this.confirmButton.waitFor({ state: 'visible' });
    await this.confirmButton.click();
  }
  async updateDuplicatAndConfirm() {
    await expect(this.buttonWiewDuplicat).toBeVisible();
    await this.radioOptionDuplicat.check();
    await this.buttonValiderChoix.click();
    await this.buttonConfirmValiderChoix.click();
  }
  async ignoreDuplicatAndConfirm() {
    await expect(this.buttonWiewDuplicat).toBeVisible();
    await this.radioOptionDuplicat.check();
    await this.buttonIgnoreAndCreate.click();
    await this.buttonConfirmValiderChoix.click();
  }
  async gotoPatientsList() {
    await this.patientLink.click();
    await this.page.waitForURL('**/patient/patients');
    // Fermer le menu pour dégager la vue (optionnel)
    await this.page.getByText('Menu').nth(1).click();

  }
  async fillPhoneInput(phoneInputLocator: Locator, phoneNumber: string) {
    // S'assurer que le numéro commence par +221 (indicatif Sénégal)
    let formattedNumber = phoneNumber;
    if (!phoneNumber.startsWith('+')) {
      formattedNumber = `+221${phoneNumber.replace(/^221/, '')}`;
    }
    await phoneInputLocator.fill(formattedNumber);
    // Déclencher l'événement input + blur pour que le composant valide
    await phoneInputLocator.dispatchEvent('input');
    await phoneInputLocator.blur();
    // Attendre un court instant pour la validation asynchrone
    await this.page.waitForTimeout(100);
  }
  async getFirstPatientDob(): Promise<string> {
    const row = this.firstChildRowTablePatient;
    const dateCell = row.locator('td:nth-child(5)'); // colonne Date de naissance
    const dateText = await dateCell.innerText();     // format "17/03/2026"
    const [day, month, year] = dateText.split('/');
    return `${year}-${month}-${day}`;                // format YYYY-MM-DD
  }

  async getFirstPatientPhone(): Promise<string> {
    const row = this.firstChildRowTablePatient;
    const phoneCell = row.locator('td:nth-child(6)'); // colonne Téléphone
    let phone = (await phoneCell.innerText()).split("/")[0];
    // Le téléphone affiché peut être au format "+221 77 123 45 67" ou "771234567"
    // Nettoyage : garder uniquement chiffres et +, puis forcer le format international
    phone = phone.replace(/\s/g, '');
    if (!phone.startsWith('+')) {
      phone = `+221${phone.replace(/^221/, '')}`;
    }
    return phone;
  }

  async deleteFirstPatient() {

    await this.buttonSupprimerPatient.click();
    // Confirmer la suppression dans la modale
    await expect(this.buttonConfirmValiderChoix).toBeVisible();
    await this.buttonConfirmValiderChoix.click();


  }

  async checkPatientDashboard() {
    const firstRow = this.firstChildRowTablePatient
    // Attendre que le tableau soit chargé
    await expect(firstRow).toBeVisible();
    // On peut cliquer sur la première cellule (identifiant) ou sur toute la ligne
    await firstRow.click();
    // Vérifier que la page du patient s'affiche
    await expect(this.infosAdminHeading).toBeVisible();
    await expect(this.identiteMedHeading).toBeVisible();
    await expect(this.AntecedentHeading).toBeVisible();
    await expect(this.prestationMediHeading).toBeVisible();
    await expect(this.parcoursSoinsHeading).toBeVisible();
    await expect(this.infoUtileHeading).toBeVisible();
    await expect(this.voirDetailAdminHeading).toBeVisible();
    await expect(this.derniereActiviteHeading).toBeVisible();

  }

}


