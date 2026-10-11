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
  // PATIENTS LISTE ELEMENTS
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
  // Champs de recherche
  private readonly identifiantInput: Locator;
  private readonly numbDossierInput: Locator;
  private readonly prenomInput: Locator;
  private readonly nomInput: Locator;
  private readonly emailInput: Locator;
  private readonly dateCreationInput: Locator;
  private readonly dateNaissanceInput: Locator;
  private readonly buttonRechercherHelper: Locator;
  // Propriétés pour le modal de création
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
    // .compact-table est une table HTML classique sans rôles ARIA dédiés par ligne/cellule,
    // d'où l'usage de sélecteurs CSS pour cibler les lignes du tableau des patients.
    this.firstChildRowTablePatient = page.locator('.compact-table tbody tr:first-child');
    // Entrée du menu latéral du module courant ("Patients" en Base patients, "Dossiers patients"
    // en Dossier médical) ; l'icône précédant le libellé fait partie du nom accessible.
    this.patientLink = page.locator('nav.iq-sidebar-menu').getByRole('link', { name: /patients$/i });
    this.identifiantLabel = page.getByText('Identifiant patient');
    this.identifiantInput = page.getByPlaceholder('Identifiant...');
    this.numbDossierLabel = page.locator('label').filter({ hasText: 'N° Dossier' });
    this.numbDossierInput = page.getByPlaceholder('N° dossier...');
    this.prenomLabel = page.locator('label').filter({ hasText: /^Prénom$/ });
    this.prenomInput = page.getByRole('textbox', { name: 'Prénom...' });
    this.nomLabel = page.locator('label').filter({ hasText: /^Nom$/ });
    this.nomInput = page.getByRole('textbox', { name: 'Nom...', exact: true });
    this.dateNaissanceLabel = page.locator('label').filter({ hasText: /^Date de naissance$/ });
    // Champ date natif sans label associé exploitable par getByLabel/getByRole -> ciblage CSS par name.
    this.dateNaissanceInput = page.locator('form.search-form input[name="doB"]');
    this.emailLabel = page.locator('form.search-form label').filter({ hasText: /^Email$/ });
    this.emailInput = page.getByPlaceholder('Email...');
    this.sexeLabel = page.locator('label').filter({ hasText: /^Sexe$/ });
    this.villeLabel = page.locator('label').filter({ hasText: /^Ville$/ });
    this.assuranceLabel = page.locator('label').filter({ hasText: /^Assurance$/ });
    this.dateCreationLabel = page.locator('label').filter({ hasText: 'Date de création' });
    // Champ date natif sans label associé exploitable par getByLabel/getByRole -> ciblage CSS par name.
    this.dateCreationInput = page.locator('input[type="date"][name="createdDate"]');
    this.telephoneLabel = page.locator('label').filter({ hasText: /^Téléphone$/ });
    this.listeHeading = page.getByRole('heading', { name: 'Liste des patients' });
    this.buttonInit = page.getByRole('button', { name: /^\W*Réinitialiser/ });
    this.buttonRechercher = page.getByRole('button', { name: /^\W*Rechercher/ });
    // ng-select (Angular) : ciblage CSS + hasText car plusieurs ng-select existent sur la page sans nom accessible distinct.
    this.comboboxTaille = page.locator('ng-select.compact-select');
    // Bouton présent dans les deux écrans de liste (Base patients et Dossier médical), précédé d'une icône.
    this.buttonNouveau = page.getByRole('button', { name: /Nouveau patient$/ }).first();
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
    this.buttonRechercherHelper = page.getByRole('button', { name: 'Rechercher' });

    // Modal de création : sélecteurs CSS par id/name, les champs du formulaire n'exposent pas
    // tous un rôle ARIA ou un label exploitable via getByRole/getByLabel.
    this.modalCreate = page.locator('#bd-example-modal-lg');
    this.folderOrderInput = this.modalCreate.getByRole('textbox', { name: 'Numéro Dossier' });
    this.sexSelect = this.modalCreate.locator('select[name="sex"]');
    this.lastNameInput = this.modalCreate.locator('#lastName');
    this.firstNameInput = this.modalCreate.locator('#firstName');
    this.dobCreateInput = this.modalCreate.locator('#collapseOne_create input[name="doB"]');
    // Icône précédant le libellé -> nom accessible réel " Email" (avec espace) : pas de correspondance exacte.
    this.emailCreateInput = this.modalCreate.getByRole('textbox', { name: 'Email' });
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
    this.buttonWiewDuplicat = page.locator('.duplicate-alert-header');
    this.buttonIgnoreAndCreate = page.getByRole('button', { name: 'Ignorer et créer le patient' });
    // Carte de doublon (label.duplicate-card), sans nom accessible -> ciblage CSS.
    this.radioOptionDuplicat = page.locator('.duplicate-card').first().locator('input[type="radio"]');
    this.buttonValiderChoix = page.getByRole('button', { name: 'Valider le choix' });
    this.buttonConfirmValiderChoix = page.getByRole('button', { name: 'Confirmer' });
    // Bouton d'action dans une cellule de .compact-table, sans nom accessible -> ciblage CSS.
    this.buttonSupprimerPatient = page.locator('.compact-table tbody tr:first-child .btn-danger-modern').first();

    // Dashboard patient
    this.infosAdminHeading = page.getByRole('heading', { name: 'Informations Administratives' });
    this.identiteMedHeading = page.getByRole('heading', { name: 'Identité Médicale' });
    // Titre de la sous-carte "Antécédents" du dashboard : div .sub-card-title, pas un heading ARIA.
    this.AntecedentHeading = page.locator('.sub-card-title').filter({ hasText: 'Antécédents' });
    this.prestationMediHeading = page.getByRole('heading', { name: 'Prestation Médicale' });
    this.parcoursSoinsHeading = page.getByRole('heading', { name: 'Parcours de soins' });

    this.infoUtileHeading = page.getByRole('heading', { name: 'Informations Utiles' });
    // Lien renommé "Voir / modifier les détails administratifs" : ciblé par son id stable.
    this.voirDetailAdminHeading = page.locator('#button_details');
    this.derniereActiviteHeading = page.getByRole('heading', { name: 'Dernières activités' });
  }

  // ======================== MÉTHODES DE RÉCUPÉRATION DES DONNÉES DU PREMIER PATIENT ========================
  async getFirstPatientId(): Promise<string> {
    const row = this.page.locator('.compact-table tbody tr:first-child');
    return (await row.locator('td:first-child').innerText()).trim();
  }

  async getFirstPatientFolderOrder(): Promise<string> {
    const row = this.page.locator('.compact-table tbody tr:first-child');
    return (await row.locator('td:nth-child(2)').innerText()).trim();
  }

  async getFirstPatientFirstName(): Promise<string> {
    const row = this.page.locator('.compact-table tbody tr:first-child');
    return (await row.locator('td:nth-child(3)').innerText()).trim();
  }

  async getFirstPatientLastName(): Promise<string> {
    const row = this.page.locator('.compact-table tbody tr:first-child');
    return (await row.locator('td:nth-child(4)').innerText()).trim();
  }



  async getFirstPatientPhone(): Promise<string> {
    const row = this.page.locator('.compact-table tbody tr:first-child');
    let phone = (await row.locator('td:nth-child(6)').innerText()).trim();
    phone = phone.split('/')[0].replace(/\s/g, '');
    if (!phone.startsWith('+')) {
      phone = `+221${phone.replace(/^221/, '')}`;
    }
    return phone;
  }

  async getFirstPatientEmail(): Promise<string> {
    const row = this.page.locator('.compact-table tbody tr:first-child');
    return (await row.locator('td:nth-child(7)').innerText()).trim();
  }

  async getFirstPatientCity(): Promise<string> {
    const row = this.page.locator('.compact-table tbody tr:first-child');
    return (await row.locator('td:nth-child(8)').innerText()).trim();
  }

  async getFirstPatientSexe(): Promise<string> {
    const row = this.page.locator('.compact-table tbody tr:first-child');
    return (await row.locator('td:nth-child(9)').innerText()).trim();
  }

  async getFirstPatientAssurance(): Promise<string> {
    const row = this.page.locator('.compact-table tbody tr:first-child');
    const text = (await row.locator('td:nth-child(10)').innerText()).trim()
    const firstAssurance = text.split("/")[0]
    return firstAssurance;
  }

  async getFirstPatientDateCreation(): Promise<string> {
    const row = this.page.locator('.compact-table tbody tr:first-child');
    return (await row.locator('td:nth-child(11)').innerText()).trim();
  }
  async getFirstPatientDob(): Promise<string> {
    const row = this.page.locator('.compact-table tbody tr:first-child');
    return (await row.locator('td:nth-child(5)').innerText()).trim();
  }

  // ======================== MÉTHODES PUBLIQUES ========================
  async checkPatientsList() {
    await this.patientLink.click();
    await this.page.waitForURL('**/patient/patients');

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

    await expect(this.precedentLabel).toBeVisible();
    await expect(this.suivantLabel).toBeVisible();
  }

  async chooseFirstPatient() {
    await this.patientLink.click();
    await this.page.waitForURL('**/patient/patients');
    await expect(this.firstChildRowTablePatient).toBeVisible();
    // Le loader plein écran de la navigation peut encore intercepter le clic juste après.
    await this.page.locator('app-loader .backdrop.full-screen').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    await this.firstChildRowTablePatient.click();
  }

  async gotoPatientsList() {
    await this.patientLink.click();
    await this.page.waitForURL('**/patient/patients');
    // La liste peut encore afficher l'état "Aucun patient disponible" le temps que les données
    // arrivent : sans cette attente, un getFirstPatientXxx() appelé juste après peut lire ce
    // texte de chargement au lieu d'une vraie valeur.
    await expect(this.firstChildRowTablePatient).toBeVisible();
    await expect(this.firstChildRowTablePatient).not.toContainText('Aucun patient disponible', { timeout: 10000 });
  }

  async openCreationModal() {
    await this.buttonNouveau.click();
    await this.modalCreate.waitFor({ state: 'visible' });
  }

  async fillCreationForm(
    hiConfig: string,
    data: {
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
    },
    email?: string
  ) {
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
    // La configuration de consentement disponible dépend de la structure (donc de
    // l'environnement) : si la valeur demandée n'est pas proposée, on prend ce qui est
    // disponible plutôt que d'échouer sur une option qui n'existe simplement pas ici.
    await this.page.locator('#hiConfigId > .ng-select-container > .ng-value-container > .ng-input > input').click();
    const desiredOption = this.page.getByRole('option', { name: hiConfig, exact: true });
    const hasDesiredOption = await desiredOption.isVisible().catch(() => false);
    if (hasDesiredOption) {
      await desiredOption.click();
    } else {
      await this.page.locator('.ng-dropdown-panel .ng-option').first().click();
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

  async deleteFirstPatient() {
    await this.buttonSupprimerPatient.click();
    await expect(this.buttonConfirmValiderChoix).toBeVisible();
    await this.buttonConfirmValiderChoix.click();
  }

  // ======================== RECHERCHE CIBLÉE & ACTIONS PAR PATIENT ========================
  private async waitForLoader() {
    await this.page.locator('app-loader .backdrop.full-screen').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  }

  /**
   * Recherche un patient créé avec fillCreationForm(data) : on reprend la même correspondance
   * que le formulaire de création (champ "Prénom" <- data.lastName, champ "Nom" <- data.firstName).
   * Côté application, le modèle `lastName` porte le prénom et `firstName` le nom de famille.
   */
  async searchByName(firstName: string, lastName: string) {
    await this.waitForLoader();
    await this.prenomInput.fill(lastName);
    await this.nomInput.fill(firstName);
    await this.buttonRechercherHelper.click();
    await this.waitForLoader();
  }

  patientRow(lastName: string): Locator {
    return this.page.locator('.compact-table tbody tr').filter({ hasText: lastName });
  }

  async expectPatientInList(lastName: string) {
    await expect(this.patientRow(lastName).first()).toBeVisible({ timeout: 15000 });
  }

  async expectPatientNotInList(lastName: string) {
    await expect(this.patientRow(lastName)).toHaveCount(0, { timeout: 15000 });
  }

  /** Clic sur la ligne : fiche administrative (Base patients) ou dossier médical (Dossier médical). */
  async openPatient(lastName: string) {
    await this.waitForLoader();
    await this.patientRow(lastName).first().locator('td').first().click();
  }

  async deletePatient(lastName: string) {
    await this.patientRow(lastName).first().locator('button[title="Supprimer le patient"]').click();
    await expect(this.buttonConfirmValiderChoix).toBeVisible();
    await this.buttonConfirmValiderChoix.click();
  }

  /** Raccourci "Facturer ce patient" (Base patients, si le module Facturation est accessible). */
  async billPatient(lastName: string) {
    await this.patientRow(lastName).first().locator('button[title="Facturer ce patient"]').click();
    await this.page.waitForURL('**/billing/billings-create**');
  }

  /** Raccourci "Factures du patient" (Base patients, si le module Facturation est accessible). */
  async openPatientInvoices(lastName: string) {
    await this.patientRow(lastName).first().locator('button[title="Factures du patient"]').click();
    await this.page.waitForURL('**/billing/billings-patients**');
  }

  /**
   * Crée un patient complet (sans consentement par défaut). Après création, l'application
   * redirige vers le dashboard médical du patient (`/patient/patient-dashboard/:id`), ce qui
   * bascule le module courant sur "Dossier médical". Renvoie l'id (UUID) du patient créé.
   */
  async createPatient(data: Parameters<PatientPage['fillCreationForm']>[1], hiConfig = 'Désactivé', email?: string): Promise<string> {
    await this.openCreationModal();
    await this.fillCreationForm(hiConfig, data, email);
    await this.saveAndConfirm();
    // Des données générées peuvent ressembler à un patient existant : l'application affiche alors
    // la détection de doublons au lieu de créer. On choisit "Ignorer et créer le patient".
    const dashboardUrl = /\/patient\/patient-dashboard\//;
    const outcome = await Promise.race([
      this.page.waitForURL(dashboardUrl, { timeout: 45000 }).then(() => 'created' as const, () => 'timeout' as const),
      this.buttonIgnoreAndCreate.waitFor({ state: 'visible', timeout: 45000 }).then(() => 'duplicate' as const, () => 'timeout' as const),
    ]);
    expect(outcome, 'Ni redirection vers le dossier ni détection de doublon après la création').not.toBe('timeout');
    if (outcome === 'duplicate') {
      await this.buttonIgnoreAndCreate.click();
      await this.buttonConfirmValiderChoix.click();
      await this.page.waitForURL(dashboardUrl, { timeout: 45000 });
    }
    return this.page.url().split('/patient/patient-dashboard/')[1].split(/[?#/]/)[0];
  }

  /** Identifiant patient (1re colonne) de la ligne correspondant au nom donné. */
  async getPatientIdentifier(lastName: string): Promise<string> {
    return (await this.patientRow(lastName).first().locator('td').first().innerText()).trim();
  }

  async checkPatientDashboard() {
    const firstRow = this.firstChildRowTablePatient;
    await expect(firstRow).toBeVisible();
    await firstRow.click();
    await this.expectMedicalDashboardSections();
  }

  /** Sections du dashboard médical d'un patient (`/patient/patient-dashboard/:id`). */
  async expectMedicalDashboardSections() {
    await expect(this.infosAdminHeading).toBeVisible();
    await expect(this.identiteMedHeading).toBeVisible();
    await expect(this.AntecedentHeading).toBeVisible();
    await expect(this.prestationMediHeading).toBeVisible();
    //  await expect(this.parcoursSoinsHeading).toBeVisible();
    // "Informations Utiles" n'apparaît que si le patient a des données dans cette section :
    // son affichage dépend donc du patient (et de l'historique des tests précédents qui
    // déterminent quel patient se retrouve "premier" dans la liste).
    // await expect(this.infoUtileHeading).toBeVisible();
    await expect(this.voirDetailAdminHeading).toBeVisible();
    // "Dernières activités" n'existe plus dans le dashboard patient redessiné.
    // await expect(this.derniereActiviteHeading).toBeVisible();
  }

  // ======================== HELPERS ========================
  async selectNgOption(label: string, optionText: string) {
    const labelToIdMap: Record<string, string> = {
      'Sexe': 'sex',
      'Ville': 'city',
      'Assurance': 'insuranceId'
    };
    const id = labelToIdMap[label];
    if (!id) {
      throw new Error(`Aucun mapping trouvé pour le label "${label}". Ajoutez-le dans labelToIdMap.`);
    }

    // ✅ Cibler uniquement le ng-select dans le formulaire de recherche
    const ngSelect = this.page.locator(`form.search-form ng-select#${id}`);
    await ngSelect.scrollIntoViewIfNeeded();
    await ngSelect.click();

    await this.page.waitForSelector('.ng-dropdown-panel .ng-option', { timeout: 5000 });
    const option = this.page.locator(`.ng-dropdown-panel .ng-option:has-text("${optionText}")`).first();
    await option.click();

  }

  async fillPhone(phone: string) {
    await this.numeroPhone.fill(phone);
  }

  async resetForm() {
    // Le loader plein écran d'une recherche précédente peut encore intercepter ce clic.
    await this.page.locator('app-loader .backdrop.full-screen').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    await this.buttonResetForms.click();
    await this.page.waitForFunction(() => {
      const rows = document.querySelectorAll('.compact-table tbody tr');
      return rows.length > 0;
    }, { timeout: 10000 });
  }

  private async selectNgOptionCreate(ngSelectLocator: Locator, optionText: string) {
    await ngSelectLocator.click();
    // Certaines listes (ex: villes) chargent de nombreuses options et peuvent mettre plus de
    // 5s à s'afficher sous charge.
    await this.page.waitForSelector('.ng-dropdown-panel .ng-option', { timeout: 10000 });
    await this.page.locator(`.ng-dropdown-panel .ng-option:has-text("${optionText}")`).first().click();
  }

  async fillPhoneInput(phoneInputLocator: Locator, phoneNumber: string) {
    let formattedNumber = phoneNumber;
    if (!phoneNumber.startsWith('+')) {
      formattedNumber = `+221${phoneNumber.replace(/^221/, '')}`;
    }
    await phoneInputLocator.fill(formattedNumber);
    await phoneInputLocator.dispatchEvent('input');
    await phoneInputLocator.blur();
    await this.page.waitForTimeout(100);
  }

  async definitionChamps(page: Page) {
    await this.patientLink.click();
    await this.page.waitForURL('**/patient/patients');
    // La liste peut encore afficher l'état "Aucun patient disponible" le temps que les données
    // arrivent : on attend la vraie première ligne avant de lire ses champs.
    await expect(this.firstChildRowTablePatient).toBeVisible();
    await expect(this.firstChildRowTablePatient).not.toContainText('Aucun patient disponible', { timeout: 10000 });

    const patientId = await this.getFirstPatientId();
    const folderOrder = await this.getFirstPatientFolderOrder();
    const firstName = await this.getFirstPatientFirstName();
    const lastName = await this.getFirstPatientLastName();
    const dateNaissance = await this.getFirstPatientDob();
    const email = await this.getFirstPatientEmail();
    const sexe = await this.getFirstPatientSexe();
    const city = await this.getFirstPatientCity();
    const assurance = await this.getFirstPatientAssurance();
    const dateCreation = await this.getFirstPatientDateCreation();
    const phone = await this.getFirstPatientPhone();


    const fields: Field[] = [];

    if (patientId && patientId !== '-') {
      fields.push({
        name: 'Identifiant patient',
        fill: async (val: string) => await this.identifiantInput.fill('123'),
        value: patientId,
        displayValue: patientId,
      });
    }

    if (folderOrder && folderOrder !== '-') {
      fields.push({
        name: 'N° Dossier',
        fill: async (val: string) => await this.numbDossierInput.fill(val),
        value: folderOrder,
        displayValue: folderOrder,
      });
    }

    if (firstName && firstName !== '-') {
      fields.push({
        name: 'Prénom',
        fill: async (val: string) => await this.prenomInput.fill(val),
        value: firstName,
        displayValue: firstName,
      });
    }

    if (lastName && lastName !== '-') {
      fields.push({
        name: 'Nom',
        fill: async (val: string) => await this.nomInput.fill(val),
        value: lastName,
        displayValue: lastName,
      });
    }
    if (dateCreation && dateCreation !== '-') {
      fields.push({
        name: 'Date de création',
        fill: async (val: string) => {
          const [day, month, year] = val.split('/');
          const isoDate = `${year}-${month}-${day}`;
          await this.dateCreationInput.fill(isoDate);
        },
        value: dateCreation,
        displayValue: dateCreation,
      });
    }
    if (dateNaissance && dateNaissance !== '-') {
      fields.push({
        name: 'Date de création',
        fill: async (val: string) => {
          const [day, month, year] = val.split('/');
          const isoDate = `${year}-${month}-${day}`;
          await this.dateNaissanceInput.fill(isoDate);
        },
        value: dateNaissance,
        displayValue: dateNaissance,
      });
    }

    if (email && email !== '-') {
      fields.push({
        name: 'Email',
        fill: async (val: string) => await this.emailInput.fill(val),
        value: email,
        displayValue: email,
      });
    }

    if (sexe && sexe !== '-') {
      fields.push({
        name: 'Sexe',
        fill: async (val: string) => await this.selectNgOption('Sexe', val),
        value: sexe,
        displayValue: sexe,
      });
    }

    if (city && city !== '-') {
      fields.push({
        name: 'Ville',
        fill: async (val: string) => await this.selectNgOption('Ville', val),
        value: city,
        displayValue: city,
      });
    }

    if (assurance && assurance !== '-') {

      fields.push({
        name: 'Assurance',
        fill: async (val: string) => await this.selectNgOption('Assurance', val),
        value: assurance,
        displayValue: assurance,
      });
    }



    if (phone && phone !== '-') {
      fields.push({
        name: 'Téléphone',
        fill: async (val: string) => await this.fillPhone(val),
        value: phone,
        displayValue: phone,
      });
    }

    const n = fields.length;

    for (let i = 0; i < n; i++) {
      await this.resetForm();
      await fields[i].fill(fields[i].value);
      await this.buttonRechercherHelper.click();
      await page.waitForTimeout(300);

      // Vérifie que le patient de référence est bien retrouvé pour ce critère de recherche.
      await expect(
        this.page.locator(`.compact-table tbody tr td:first-child:has-text("${patientId}")`)
      ).toBeVisible({ timeout: 1000 });
    }
  }
}