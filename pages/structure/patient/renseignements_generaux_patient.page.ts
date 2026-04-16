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
    this.renseignementsGenerauxHeading = page.getByRole('heading', { name: 'Renseignements généraux' });
    this.poidsHeading = page.getByRole('heading', { name: 'Poids' });
    this.tailleHeading = page.getByRole('heading', { name: 'Taille' });
    this.imcHeading = page.getByRole('heading', { name: 'I.M.C' });
    this.groupsanguinHeading =page.getByRole('heading', { name: 'G.Sanguin' });
    this.rhHeading = page.getByRole('heading', { name: 'Rhésus' });
    this.voirPlusHeading = page.getByRole('link', { name: 'Voir +' }).first();
    this.retourHeading = page.locator('div').filter({ hasText: /^RetourRenseignements généraux$/ }).first();
    this.buttonRetour = page.getByRole('button', { name: ' Retour' });
    this.infoGeneralHeading = page.getByRole('heading', { name: 'Informations générales' });
    this.conjointeHeading = page.getByRole('heading', { name: 'Conjoint/Conjointe' });
    this.parentHeading = page.getByRole('heading', { name: 'Parents' });
    this.buttonHeading = page.getByRole('button', { name: 'Activer le formulaire' });
    this.contentHeading = page.locator('.d-flex.justify-content-end.mt-4');
    this.buttonActiverForms = page.getByRole('button', { name: 'Activer le formulaire' });
    this.poidsFieldForm = page.getByRole('spinbutton', { name: 'Poids (kg)' });
    this.tailleFieldForm = page.getByRole('spinbutton', { name: 'Taille (cm)' });
    this.professionFieldForm = page.getByPlaceholder('Entrez la profession');
    this.situationMatrimonialLabelFieldForm = page.getByLabel('Situation matrimoniale');
    this.groupeSanguinLabelFieldForm = page.getByLabel('Groupe sanguin *');
    this.rhLabelFieldForm = page.getByLabel('Rhésus *');
    this.geTextBoxFieldForm = page.getByRole('textbox', { name: 'ge' });
    this.profConjointFieldForm = page.getByPlaceholder('Profession du conjoint');
    this.nbreEpouseLabelFieldForm = page.getByRole('textbox', { name: 'Nombre d\'épouse(s)' });
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
    await expect(this.conjointeHeading).toBeVisible();
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
    await this.geTextBoxFieldForm.click();
    await this.geTextBoxFieldForm.fill('18');
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


