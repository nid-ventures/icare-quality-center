import { type Page, type Locator, expect } from '@playwright/test';

export class AntecedentPage {
  private readonly antecedantHeading: Locator;
  private readonly asthmeHeading: Locator;
  private readonly diabeteHeading: Locator;
  private readonly avrHeading: Locator;
  private readonly cardiopathieHeading: Locator;
  private readonly tuberculoseHeading: Locator;
  private readonly voirPlusHeading: Locator;
  private readonly retourHeading: Locator;
  private readonly patientHeading: Locator;
  private readonly familiauxHeading: Locator;
  private readonly conjointeHeading: Locator;
  // ANTECEDANTS GENERAUX 
  private readonly generauxHeading: Locator;
  private readonly buttonActiver: Locator;
  private readonly medicalGenerauxHeading: Locator;
  private readonly pathologiesHeading: Locator;
  private readonly autrePathologiesHeading: Locator;
  private readonly allergiesConnuesHeading: Locator;
  private readonly medicamenteuseConnuesHeading: Locator;
  private readonly respiratoiresHeading: Locator;
  private readonly alimentairesConnuesHeading: Locator;
  private readonly autresAllergiesPreHeading: Locator;
  private readonly tabacHeading: Locator;
  private readonly toxiCondConnuesHeading: Locator;
  private readonly footerHeading: Locator;
  private readonly pathologiesTextBox: Locator;
  private readonly drepanocytoseOption: Locator;
  private readonly cardiopathieOption: Locator;
  private readonly bodyPatho: Locator;
  private readonly autresPathologiesTextBox: Locator;
  private readonly allergiesTexbox: Locator;
  private readonly cephalosporinesOption: Locator;
  private readonly pathologiesSelect: Locator;
  private readonly aspirineOption: Locator;
  private readonly retourDiv: Locator;
  private readonly allergiesSelect: Locator;
  private readonly allergiesRespiSelect: Locator;
  private readonly acariensOption: Locator;
  private readonly allergiesAlimSelect: Locator;
  private readonly laitOption: Locator;
  private readonly autresAlergieTextBox: Locator;
  private readonly selectTabac: Locator;
  private readonly fumeurRegulierOption: Locator;
  private readonly toxiConduitTextBox: Locator;
  private readonly buttonEnregister: Locator;
  private readonly confirmerLabel: Locator;
  private readonly buttonFermer: Locator;
  private readonly buttonConfirmer: Locator;




  constructor(private readonly page: Page) {
    this.antecedantHeading = page.getByRole('heading', { name: 'Antécédents' });
    this.asthmeHeading = page.getByRole('heading', { name: 'Asthme' });
    this.diabeteHeading = page.getByRole('heading', { name: 'Diabète' });
    this.avrHeading = page.getByRole('heading', { name: 'ARV' });
    this.cardiopathieHeading =page.getByRole('heading', { name: 'Cardiopathie' });
    this.tuberculoseHeading = page.getByRole('heading', { name: 'Tuberculose' });
    this.voirPlusHeading = page.getByRole('link', { name: 'Voir +' }).nth(1);
    this.retourHeading = page.locator('div').filter({ hasText: /^RetourAntécédents médicaux$/ }).first();
    this.patientHeading = page.getByRole('tab', { name: ' Patient' });
    this.familiauxHeading = page.getByRole('tab', { name: ' Familiaux' });
    this.conjointeHeading = page.getByRole('tab', { name: ' Conjoint(e)' }); 
      // ANTECEDANTS GENERAUX
    this.generauxHeading = page.getByRole('tab', { name: 'Généraux' }); 
    this.buttonActiver = page.getByRole('button', { name: 'Activer le formulaire' }); 
    this.medicalGenerauxHeading = page.getByRole('heading', { name: 'Antécédents Médicaux Généraux' }); 
    this.pathologiesHeading = page.getByText('Pathologies', { exact: true }); 
    this.autrePathologiesHeading = page.getByText('Autres pathologies (pré'); 
    this.allergiesConnuesHeading = page.getByText('Allergies connues'); 
    this.medicamenteuseConnuesHeading = page.getByText('💊 Médicamenteuses'); 
    this.respiratoiresHeading = page.getByText('🌬️ Respiratoires'); 
    this.alimentairesConnuesHeading = page.getByText('🍽️ Alimentaires'); 
    this.autresAllergiesPreHeading = page.getByText('📝 Autres allergies (pré'); 
    this.tabacHeading = page.getByText('Tabac'); 
    this.toxiCondConnuesHeading = page.getByText('Toxicomanie / Conduites à'); 
    this.footerHeading = page.locator('.col-sm-12 > form > .modal-content > .modal-footer').first(); 
    this.pathologiesTextBox = page.locator('ng-select').filter({ hasText: 'Sélectionnez les pathologies' }).getByRole('textbox'); 
    this.drepanocytoseOption = page.getByRole('option', { name: 'Drépanocytose' }); 
    this.cardiopathieOption = page.getByRole('option', { name: 'Cardiopathie' }); 
    this.bodyPatho = page.locator('.ng-untouched.ng-valid > .modal-content > .modal-body'); 
    this.autresPathologiesTextBox = page.getByRole('textbox', { name: 'Autres pathologies (pré' }); 
    this.allergiesTexbox = page.locator('ng-select').filter({ hasText: 'Sélectionnez les allergies mé' }).getByRole('textbox'); 
    this.cephalosporinesOption =  page.getByRole('option', { name: 'Céphalosporines' }); 
    this.pathologiesSelect =page.getByRole('option', { name: 'Cardiopathie' }) ; 
    this.aspirineOption = page.getByRole('option', { name: 'Aspirine' }); 
    this.retourDiv = page.locator('div').filter({ hasText: 'RetourAntécédents médicaux' }).nth(4); 
    this.allergiesSelect = page.locator('.ng-select-multiple.ng-select-searchable.ng-select-clearable.ng-select.ng-untouched > .ng-select-container > .ng-arrow-wrapper').first(); 
    this.allergiesRespiSelect = page.locator('ng-select').filter({ hasText: 'Sélectionnez les allergies respiratoires...' }).getByRole('textbox'); 
    this.acariensOption = page.getByRole('option', { name: 'Acariens' }); 
    this.allergiesAlimSelect = page.locator('ng-select').filter({ hasText: 'Sélectionnez les allergies alimentaires...' }).getByRole('textbox'); 
    this.laitOption = page.getByRole('option', { name: 'Lait' }); 
    this.autresAlergieTextBox = page.getByRole('textbox', { name: 'Ajoutez d\'autres allergies' }); 
    this.selectTabac = page.locator('.ng-select-searchable.ng-select-clearable.ng-select.ng-select-single > .ng-select-container > .ng-value-container > .ng-input > input').first(); 
    this.fumeurRegulierOption = page.getByRole('option', { name: 'Fumeur régulier' });
    this.toxiConduitTextBox = page.getByRole('textbox', { name: 'Toxicomanie / Conduites à' }); 
    this.buttonEnregister = page.getByRole('button', { name: 'Enregistrer' }); 
    this.confirmerLabel = page.getByText('Voulez-vous modifier cet anté'); 
    this.buttonFermer = page.getByRole('button', { name: 'Fermer' }); 
    this.buttonConfirmer = page.getByRole('button', { name: 'Confirmer' }); 

    


  }
  
  async checkAntecedentInfos() {  
  await expect(this.antecedantHeading).toBeVisible();
  await expect(this.asthmeHeading).toBeVisible();
  await expect(this.diabeteHeading).toBeVisible();
  await expect(this.avrHeading).toBeVisible();
  await expect(this.cardiopathieHeading).toBeVisible();
  await expect(this.tuberculoseHeading).toBeVisible();
  await expect(this.voirPlusHeading).toBeVisible();
  await this.voirPlusHeading.click();
  await expect(this.retourHeading).toBeVisible();
  await expect(this.patientHeading).toBeVisible();
  await expect(this.familiauxHeading).toBeVisible();
  await expect(this.conjointeHeading).toBeVisible();

  }


  async checkAntecedentFormulaire(){   
  await expect(this.voirPlusHeading).toBeVisible();
  await this.voirPlusHeading.click();
  await expect(this.patientHeading).toBeVisible();
  await expect(this.generauxHeading).toBeVisible();
  await expect(this.buttonActiver).toBeVisible();
  await expect(this.medicalGenerauxHeading).toBeVisible();
  await expect(this.pathologiesHeading).toBeVisible();
  await expect(this.autrePathologiesHeading).toBeVisible();
  await expect(this.allergiesConnuesHeading).toBeVisible();
  await expect(this.medicamenteuseConnuesHeading).toBeVisible();
  await expect(this.respiratoiresHeading).toBeVisible();
  await expect(this.alimentairesConnuesHeading).toBeVisible();
  await expect(this.autresAllergiesPreHeading).toBeVisible();
  await expect(this.tabacHeading).toBeVisible();
  await expect(this.toxiCondConnuesHeading).toBeVisible();
  await expect(this.footerHeading).toBeVisible();
  
  }


  async updateAntecedantGeneraux(){   

  await this.buttonActiver.click();
  await this.pathologiesTextBox.click();
  await this.drepanocytoseOption.click();
  await this.cardiopathieOption.click();
  await this.bodyPatho.click();
  await this.autresPathologiesTextBox.click();
  await this.autresPathologiesTextBox.fill('rhume');
  await this.allergiesTexbox.click();
  await this.cephalosporinesOption.click();

  await this.autresAlergieTextBox.click();
  await this.autresAlergieTextBox.fill('tete');
  await this.selectTabac.click();
  await this.fumeurRegulierOption.click();
  await this.toxiConduitTextBox.click();
  await this.toxiConduitTextBox.fill('reduire le sucre');
  await this.buttonEnregister.click();
  await expect(this.confirmerLabel).toBeVisible();
  await expect(this.buttonFermer).toBeVisible();
  await expect(this.buttonConfirmer).toBeVisible();
  await this.buttonConfirmer.click();  
  }

}


