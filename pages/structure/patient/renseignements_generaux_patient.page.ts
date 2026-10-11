import { type Page, type Locator, expect } from '@playwright/test';

export class RenseignementsGenerauxPage {
  private readonly renseignementsGenerauxHeading: Locator;
  private readonly poidsHeading: Locator;
  private readonly tailleHeading: Locator;
  private readonly imcHeading: Locator;
  private readonly groupsanguinHeading: Locator;
  private readonly rhHeading: Locator;
  private readonly voirPlusHeading: Locator;
  private readonly retourHeading: Locator;
  private readonly buttonRetour: Locator;
  private readonly infoGeneralHeading: Locator;
  private readonly conjointeHeading: Locator;
  private readonly parentHeading: Locator;
  private readonly buttonHeading: Locator;
  private readonly contentHeading: Locator;
 // update fiels to fill
  private readonly buttonActiverForms: Locator;
  private readonly poidsFieldForm: Locator;
  private readonly tailleFieldForm: Locator;
  private readonly professionFieldForm: Locator;
  private readonly situationMatrimonialLabelFieldForm: Locator;
  private readonly groupeSanguinLabelFieldForm: Locator;
  private readonly rhLabelFieldForm: Locator;
  private readonly geTextBoxFieldForm: Locator;
  private readonly profConjointFieldForm: Locator;
  private readonly nbreEpouseLabelFieldForm: Locator;
  private readonly nationaliteConjoint: Locator;
  private readonly nationaliteConjointOption: Locator;
  private readonly pereLabelFieldForm: Locator;
  private readonly mereLabelFieldForm: Locator;
  private readonly buttonEnreg: Locator;
  private readonly buttonConfirmer: Locator;
  private readonly buttonFermer: Locator;
  private readonly buttonConfirmerLabel: Locator;

  


  constructor(private readonly page: Page) {
    this.renseignementsGenerauxHeading = page.locator('.sub-card-title').filter({ hasText: 'Renseignements généraux' });
    this.poidsHeading = page.locator('.vital .label').filter({ hasText: 'Poids' });
    this.tailleHeading = page.locator('.vital .label').filter({ hasText: 'Taille' });
    this.imcHeading = page.locator('.vital .label').filter({ hasText: 'I.M.C' });
    this.groupsanguinHeading = page.locator('.vital .label').filter({ hasText: 'G.Sanguin' });
    this.rhHeading = page.locator('.vital .label').filter({ hasText: 'Rhésus' });
    this.voirPlusHeading = page.getByRole('link', { name: 'Voir +' }).first();
    // Bloc de titre/fil d'Ariane sans rôle ARIA dédié -> ciblage CSS par contenu textuel du conteneur.
    this.retourHeading = page.locator('.header-left').filter({ hasText: 'Retour' }).filter({ hasText: 'Renseignements généraux' }).first();
    this.buttonRetour = page.getByRole('button', { name: /^\W*Retour/ });
    this.infoGeneralHeading = page.getByRole('heading', { name: 'Informations Personnelles' });
    this.conjointeHeading = page.getByRole('heading', { name: /^\W*Conjoint\/Conjointe/ });
    this.parentHeading = page.getByRole('heading', { name: /^\W*Parents/ });
    this.buttonHeading = page.getByRole('button', { name: 'Activer le formulaire' });
    // Conteneur de mise en page (boutons d'action) sans rôle accessible propre -> ciblage CSS.
    this.contentHeading = page.locator('.d-flex.justify-content-end.mt-4');
    this.buttonActiverForms = page.getByRole('button', { name: 'Activer le formulaire' });
    this.poidsFieldForm = page.getByRole('spinbutton', { name: 'Poids (kg)' });
    this.tailleFieldForm = page.getByRole('spinbutton', { name: 'Taille (cm)' });
    this.professionFieldForm = page.getByPlaceholder('Entrez la profession');
    this.situationMatrimonialLabelFieldForm = page.getByLabel('Situation matrimoniale');
    this.groupeSanguinLabelFieldForm = page.getByLabel('Groupe sanguin *');
    this.rhLabelFieldForm = page.getByLabel('Rhésus *');
    // Champ "Âge (ans)" toujours en lecture seule (calculé automatiquement) -> non renseigné en test.
    this.geTextBoxFieldForm = page.locator('#dob');
    this.profConjointFieldForm = page.getByPlaceholder('Profession du conjoint');
    this.nbreEpouseLabelFieldForm = page.getByRole('textbox', { name: 'Nombre d\'épouse(s)' });
    // Angular ng-select identifié par id (pas de label exploitable pour ce champ) -> ciblage CSS.
    this.nationaliteConjoint = page.locator('#nationaliteConjoint').getByRole('textbox');
    this.nationaliteConjointOption = page.getByRole('option', { name: 'NIGERIEN(NE)' });
    this.pereLabelFieldForm = page.getByRole('textbox', { name: 'Père' });
    this.mereLabelFieldForm = page.getByRole('textbox', { name: 'Mère' });
    this.buttonEnreg = page.getByRole('button', { name: 'Enregistrer' });
    this.buttonConfirmer = page.getByRole('button', { name: 'Confirmer' });
    this.buttonFermer = page.getByRole('button', { name: 'Fermer' });
    this.buttonConfirmerLabel = page.getByText('Voulez-vous enregister ces');

    
    


  }
  
  async checkRenseignementInfos() {  
    await expect(this.renseignementsGenerauxHeading).toBeVisible();
    await expect(this.poidsHeading).toBeVisible();
    await expect(this.tailleHeading).toBeVisible();
    await expect(this.imcHeading).toBeVisible();
    await expect(this.groupsanguinHeading).toBeVisible();
    await expect(this.rhHeading).toBeVisible();
    await expect(this.voirPlusHeading).toBeVisible();
    await this.voirPlusHeading.first().click();
    await expect(this.retourHeading).toBeVisible();
    await expect(this.buttonRetour).toBeVisible();
    await expect(this.infoGeneralHeading).toBeVisible();
    // Le rendu de cette section (après le clic "Voir +") peut prendre plus de 10s sous charge.
    await expect(this.conjointeHeading).toBeVisible({ timeout: 20000 });
    await expect(this.parentHeading).toBeVisible();
    await expect(this.contentHeading).toBeVisible();
    await expect(this.buttonHeading).toBeVisible();
  }
 
  async updateRenseignementGenerauxForms(){
    await this.voirPlusHeading.first().click();;
    await this.buttonActiverForms.click();
    await this.poidsFieldForm.click();
    await this.poidsFieldForm.fill('89');
    await this.tailleFieldForm.click();
    await this.tailleFieldForm.fill('179');
    await this.professionFieldForm.click();
    await this.professionFieldForm.fill('informaticien');
    await this.situationMatrimonialLabelFieldForm.selectOption('Célibataire');
    await this.groupeSanguinLabelFieldForm.selectOption('AB');
    await this.rhLabelFieldForm.selectOption('NEGATIF');
    await this.profConjointFieldForm.click();
    await this.profConjointFieldForm.fill('menagere');
    await this.nbreEpouseLabelFieldForm.click();
    await this.nbreEpouseLabelFieldForm.fill('01');
    await this.nationaliteConjoint.click();
    await this.nationaliteConjointOption.click();
    await this.pereLabelFieldForm.click();
    await this.pereLabelFieldForm.fill('moussa');
    await this.mereLabelFieldForm.click();
    await this.mereLabelFieldForm.fill('mariam');
    await this.buttonEnreg.click();
    await expect(this.buttonConfirmer).toBeVisible();
    await expect(this.buttonFermer).toBeVisible();
    await expect(this.buttonConfirmerLabel).toBeVisible();
    await this.buttonConfirmer.click();
  }


  
  

}


