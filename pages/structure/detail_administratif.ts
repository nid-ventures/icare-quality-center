import { type Page, type Locator, expect } from '@playwright/test';

export class DetailPatientPage {
  private readonly buttonVOirDetails: Locator;
  private readonly detailTab: Locator;
  private readonly PersonContactTab: Locator;
  private readonly PriseEnChargeTab: Locator;
  private readonly buttonActiveTab: Locator;
  private readonly dateNaissanceInput: Locator;
  private readonly optionFirst: Locator;
  private readonly optionCity: Locator;
  private readonly optionState: Locator;
  private readonly optionStateValue: Locator;
  private readonly buttonEnregistrer: Locator;
  private readonly buttonConfirmer: Locator;

  // ⭐ Nouveaux sélecteurs pour l’onglet Personne à contacter
  private readonly personContactTabLink: Locator;
  private readonly addPersonButton: Locator;
  private readonly modalTitle: Locator;
  private readonly firstNameInput: Locator;      // ctfirstName
  private readonly lastNameInput: Locator;       // ctlastName
  private readonly phonePrimaryInput: Locator;   // premier champ téléphone
  private readonly phoneSecondaryInput: Locator; // second champ téléphone
  private readonly linkTypeSelect: Locator;      // ctlinkType
  private readonly sexSelect: Locator;           // ctsexe
  private readonly dobInput: Locator;            // ctdoB
  private readonly relationInput: Locator;       // ctrue (relation / lien)
  private readonly addressInput: Locator;        // ctaddress
  private readonly citySelect: Locator;          // ctville
  private readonly regionSelect: Locator;        // ctregion
  private readonly countrySelect: Locator;       // ctpays
  private readonly nationalitySelect: Locator;   // ctnationalite
  private readonly saveContactButton: Locator;   // Enregistrer dans le modal
  private readonly actionButtonAfterSave: Locator; // bouton Action après ajout
  // Sélecteurs pour la modification d'une personne à contacter
  private readonly actionButtonFirst: Locator;
  private readonly modifyLink: Locator;
  private readonly modifyModalHeading: Locator;
  private readonly modifyRegionSelect: Locator;    // #sctregion
  private readonly modifyNationalitySelect: Locator; // #sctnationalite
  private readonly modifySaveButton: Locator;
  private readonly actionButtonDeleteFirst: Locator;
  private readonly deleteLink: Locator;
  private readonly confirmDeleteButton: Locator;


  constructor(private readonly page: Page) {
    this.buttonVOirDetails = page.locator('#button_details');
    this.detailTab = page.getByRole('tab', { name: ' Détails' });
    this.PersonContactTab = page.getByRole('tab', { name: ' Personne à contacter' });
    this.PriseEnChargeTab = page.getByRole('tab', { name: 'Prise en charge' });
    this.buttonActiveTab = page.getByRole('button', { name: 'Activer le formulaire' });
    this.dateNaissanceInput = page.locator('input[name="doB"]');
    this.optionFirst = page.locator('ng-select').first();
    this.optionCity = page.getByRole('option', { name: 'SAINT-LOUIS' });
    this.optionState = page.locator('#state');
    this.optionStateValue = page.getByRole('option', { name: 'KÉDOUGOU' });
    this.buttonEnregistrer = page.getByRole('button', { name: 'Enregistrer' });
    this.buttonConfirmer = page.getByRole('button', { name: 'Confirmer' });
    // Initialisations pour Personne à contacter
    this.personContactTabLink = page.getByRole('tab', { name: ' Personne à contacter' });
    this.addPersonButton = page.getByRole('link', { name: 'Ajouter une personne à' });
    this.modalTitle = page.getByText('Ajouter personne à contacter×');
    this.firstNameInput = page.locator('#ctfirstName');
    this.lastNameInput = page.locator('#ctlastName');
    this.phonePrimaryInput = page.getByRole('textbox', { name: 'Entrez le numéro' }).first();
    this.phoneSecondaryInput = page.getByRole('textbox', { name: 'Entrez le numéro' }).nth(1);
    this.linkTypeSelect = page.locator('#ctlinkType');
    this.sexSelect = page.locator('#ctsexe');
    this.dobInput = page.locator('#ctdoB');
    this.relationInput = page.locator('#ctrue'); // champ "lien de parenté"
    this.addressInput = page.locator('#ctaddress');
    this.citySelect = page.locator('#ctville');
    this.regionSelect = page.locator('#ctregion');
    this.countrySelect = page.locator('#ctpays');
    this.nationalitySelect = page.locator('#ctnationalite');
    this.saveContactButton = page.getByRole('button', { name: 'Enregistrer' });
    this.actionButtonAfterSave = page.getByRole('button', { name: 'Action' });
    this.actionButtonFirst = page.getByRole('button', { name: 'Action' }).first();
    this.modifyLink = page.getByRole('link', { name: 'Modifier' });
    this.modifyModalHeading = page.getByRole('heading', { name: 'Détails une personne à' });
    this.modifyRegionSelect = page.locator('#sctregion');
    this.modifyNationalitySelect = page.locator('#sctnationalite');
    this.modifySaveButton = page.getByRole('button', { name: 'Enregistrer' });
    this.actionButtonDeleteFirst = page.getByRole('button', { name: 'Action' }).first();
    this.deleteLink = page.getByRole('link', { name: 'Supprimer' });
    this.confirmDeleteButton = page.getByRole('button', { name: 'Supprimer' });

  }
  async gotoDetailsPatient() {
    // Cliquer sur le lien "Voir Détails Administratifs"
    await expect(this.buttonVOirDetails).toBeVisible();
    await this.buttonVOirDetails.click();
  }
  async checkIfPageLoad() {
    await expect(this.detailTab).toBeVisible();
    await expect(this.PersonContactTab).toBeVisible();
    await expect(this.PriseEnChargeTab).toBeVisible();
    await expect(this.buttonActiveTab).toBeVisible();
  }

  async updateData() {

    // Activer le formulaire
    await this.buttonActiveTab.click();
    // Attendre que les champs deviennent éditables (par exemple, le champ date de naissance)
    await expect(this.dateNaissanceInput).toBeEditable();
    // Modifier la date de naissance
    await this.dateNaissanceInput.fill('2026-04-05');
    // Modifier la ville (premier ng-select) – adapter selon le besoin
    // Ici on suppose que le premier ng-select correspond à la ville
    const citySelect = this.optionFirst;
    await citySelect.click();
    await this.optionCity.click();
    // Modifier la région/état (second ng-select) – adapter
    const stateSelect = this.optionState;
    await stateSelect.click();
    await this.optionStateValue.click();
    // Enregistrer
    await this.buttonEnregistrer.click();
    // Confirmer la modification dans la modale
    await expect(this.buttonConfirmer).toBeVisible();
    await this.buttonConfirmer.click();




  }
  /**
   * Ouvre l'onglet "Personne à contacter"
   */
  async goToPersonContactTab() {
    await this.personContactTabLink.click();
    await expect(this.addPersonButton).toBeVisible();
  }

  /**
   * Ouvre le modal d'ajout d'une personne à contacter
   */
  async openAddPersonModal() {
    await this.addPersonButton.click();
    await expect(this.modalTitle).toBeVisible();
  }

  /**
   * Remplit le formulaire de personne à contacter avec des données dynamiques
   * @param data - Données de la personne à contacter
   */
  async fillPersonContactForm(data: ContactPersonData) {
    await this.firstNameInput.fill(data.firstName);
    await this.lastNameInput.fill(data.lastName);
    await this.fillPhoneInput(this.phonePrimaryInput, data.phonePrimary);
    if (data.phoneSecondary) {
      await this.fillPhoneInput(this.phoneSecondaryInput, data.phoneSecondary);
    }
    await this.linkTypeSelect.selectOption(data.linkType);
    await this.sexSelect.selectOption(data.sex);
    await this.dobInput.fill(data.dob);
    await this.relationInput.fill(data.relation);
    await this.addressInput.fill(data.address);
    await this.citySelect.selectOption(data.city);
    await this.regionSelect.selectOption(data.region);
    await this.countrySelect.selectOption(data.country);
    await this.nationalitySelect.selectOption(data.nationality);
  }

  /**
   * Méthode utilitaire pour remplir un champ téléphone (identique à celle utilisée pour PatientPage)
   */
  private async fillPhoneInput(locator: Locator, phoneNumber: string) {
    let formatted = phoneNumber;
    if (!formatted.startsWith('+')) {
      formatted = `+221${formatted.replace(/^221/, '')}`;
    }
    await locator.fill(formatted);
    await locator.dispatchEvent('input');
    await locator.blur();
    await this.page.waitForTimeout(100);
  }

  /**
   * Sauvegarde la personne à contacter et attend la fermeture du modal
   */
  async savePersonContact() {
    await this.saveContactButton.click();
    // Attendre que le modal disparaisse (ou que le bouton Action apparaisse)
    await expect(this.actionButtonAfterSave).toBeVisible({ timeout: 10000 });
  }

  /**
   * Modifie la première personne à contacter en changeant région et nationalité
   * @param regionCode - Code de la région (ex: '50')
   * @param nationalityCode - Code de la nationalité (ex: '32')
   */
  async modifyFirstContactPerson(regionCode: string, nationalityCode: string) {
    // Cliquer sur le bouton Action de la première ligne
    await this.actionButtonFirst.click();
    // Cliquer sur Modifier
    await this.modifyLink.click();
    // Vérifier que le modal de modification est visible
    await expect(this.modifyModalHeading).toBeVisible();
    // Modifier la région
    await this.modifyRegionSelect.selectOption(regionCode);
    // Modifier la nationalité
    await this.modifyNationalitySelect.selectOption(nationalityCode);
    // Enregistrer
    await this.modifySaveButton.click();
    // Attendre la fermeture du modal (optionnel, par exemple disparition du heading)
    await expect(this.modifyModalHeading).not.toBeVisible({ timeout: 5000 });
  }
  /**
 * Supprime la première personne à contacter de la liste
 */
  async deleteFirstContactPerson() {
    // Cliquer sur le bouton Action de la première ligne
    await this.actionButtonDeleteFirst.click();
    // Cliquer sur Supprimer
    await this.deleteLink.click();
    // Confirmer la suppression dans la modale
    await this.confirmDeleteButton.click();

  }
}

/**
 * Interface pour les données d'une personne à contacter
 */
export interface ContactPersonData {
  firstName: string;
  lastName: string;
  phonePrimary: string;
  phoneSecondary?: string;
  linkType: string;    // ex: '17' (valeur à adapter)
  sex: string;         // '1' ou '2'
  dob: string;         // YYYY-MM-DD
  relation: string;    // lien de parenté (ex: 'Frère')
  address: string;
  city: string;        // code de la ville (ex: '71')
  region: string;      // code région (ex: '52')
  country: string;     // code pays (ex: '109')
  nationality: string; // code nationalité (ex: '35')

}


