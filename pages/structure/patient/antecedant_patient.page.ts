import { type Page, type Locator, expect } from '@playwright/test';

export class AntecedentPage {
  private readonly antecedantHeading: Locator;
  private readonly asthmeHeading: Locator;
  private readonly aucunAntecedentText: Locator;
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
    this.antecedantHeading = page.locator('.sub-card-title').filter({ hasText: 'Antécédents' });
    // "Asthme" n'est présent que si ce patient a un antécédent renseigné : cet état dépend des
    // données du patient (donc de l'environnement/jeu de données), d'où le repli sur l'état vide.
    this.asthmeHeading = page.locator('.tag').filter({ hasText: 'Asthme' });
    this.aucunAntecedentText = page.getByText('Aucun antécédent');
    this.diabeteHeading = page.locator('.tag').filter({ hasText: 'Diabète' });
    this.avrHeading = page.locator('.tag').filter({ hasText: 'ARV' });
    this.cardiopathieHeading = page.locator('.tag').filter({ hasText: 'Cardiopathie' });
    this.tuberculoseHeading = page.locator('.tag').filter({ hasText: 'Tuberculose' });
    this.voirPlusHeading = page.getByRole('link', { name: 'Voir +' }).nth(1);
    // Bloc de titre/fil d'Ariane sans rôle ARIA dédié -> ciblage CSS par contenu textuel du conteneur.
    this.retourHeading = page.locator('.header-left').filter({ hasText: 'Retour' }).filter({ hasText: 'Antécédents médicaux' }).first();
    this.patientHeading = page.getByRole('tab', { name: ' Patient' });
    this.familiauxHeading = page.getByRole('tab', { name: ' Familiaux' });
    this.conjointeHeading = page.getByRole('tab', { name: ' Conjoint(e)' }); 
      // ANTECEDANTS GENERAUX
    this.generauxHeading = page.getByRole('tab', { name: 'Généraux' }); 
    this.buttonActiver = page.getByRole('button', { name: 'Activer le formulaire' }); 
    this.medicalGenerauxHeading = page.locator('.instructions-text').filter({ hasText: 'Antécédents médicaux généraux' });
    this.pathologiesHeading = page.getByText('Pathologies', { exact: true }); 
    this.autrePathologiesHeading = page.getByText('Autres pathologies (pré'); 
    this.allergiesConnuesHeading = page.getByText('Allergies connues'); 
    this.medicamenteuseConnuesHeading = page.locator('.allergy-category-title').filter({ hasText: 'Médicamenteuses' });
    this.respiratoiresHeading = page.locator('.allergy-category-title').filter({ hasText: 'Respiratoires' });
    this.alimentairesConnuesHeading = page.locator('.allergy-category-title').filter({ hasText: 'Alimentaires' });
    this.autresAllergiesPreHeading = page.locator('.allergy-category-title').filter({ hasText: 'Autres (pré' });
    this.tabacHeading = page.getByText('Tabac'); 
    this.toxiCondConnuesHeading = page.getByText('Toxicomanie / Conduites à'); 
    // Pied de formulaire sans rôle accessible propre -> ciblage CSS structurel.
    this.footerHeading = page.locator('#pills-mere-fill .d-flex.justify-content-end.mt-3').first();
    // Angular ng-select : ciblage CSS + hasText, plusieurs ng-select coexistent sans nom accessible distinct.
    this.pathologiesTextBox = page.locator('ng-select').filter({ hasText: 'Sélectionnez les pathologies' }).getByRole('textbox');
    this.drepanocytoseOption = page.getByRole('option', { name: 'Drépanocytose' }); 
    this.cardiopathieOption = page.getByRole('option', { name: 'Cardiopathie' }); 
    // Corps de la modale, ciblage CSS structurel (pas de rôle accessible dédié).
    this.bodyPatho = page.locator('#pills-mere-fill .pathologies .section-header');
    this.autresPathologiesTextBox = page.getByRole('textbox', { name: 'Autres pathologies (pré' }); 
    this.allergiesTexbox = page.locator('ng-select').filter({ hasText: 'Sélectionnez les allergies mé' }).getByRole('textbox'); 
    this.cephalosporinesOption =  page.getByRole('option', { name: 'Céphalosporines' }); 
    this.pathologiesSelect =page.getByRole('option', { name: 'Cardiopathie' }) ; 
    this.aspirineOption = page.getByRole('option', { name: 'Aspirine' }); 
    // Bloc de titre/fil d'Ariane sans rôle ARIA dédié -> ciblage CSS par contenu textuel du conteneur.
    this.retourDiv = page.locator('.header-left').filter({ hasText: 'Retour' }).filter({ hasText: 'Antécédents médicaux' }).first();
    // Angular ng-select : la flèche du multi-select n'a pas de rôle accessible -> ciblage CSS structurel.
    this.allergiesSelect = page.locator('.ng-select-multiple.ng-select-searchable.ng-select-clearable.ng-select.ng-untouched > .ng-select-container > .ng-arrow-wrapper').first();
    this.allergiesRespiSelect = page.locator('ng-select').filter({ hasText: 'Sélectionnez les allergies respiratoires...' }).getByRole('textbox'); 
    this.acariensOption = page.getByRole('option', { name: 'Acariens' }); 
    this.allergiesAlimSelect = page.locator('ng-select').filter({ hasText: 'Sélectionnez les allergies alimentaires...' }).getByRole('textbox'); 
    this.laitOption = page.getByRole('option', { name: 'Lait' }); 
    this.autresAlergieTextBox = page.getByRole('textbox', { name: 'Ajoutez d\'autres allergies' }); 
    // Angular ng-select : input interne sans nom accessible distinct -> ciblage CSS structurel.
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
  // Le contenu de la section dépend des antécédents réels du patient (donc de l'environnement/
  // jeu de données) : soit un tag "Asthme" est présent, soit l'état vide "Aucun antécédent".
  await expect(this.asthmeHeading.or(this.aucunAntecedentText)).toBeVisible();
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
  // Ferme le panneau ng-dropdown resté ouvert (ses options interceptent les clics suivants).
  // Échap peut aussi réinitialiser la sélection multiple (et désactiver "Autres pathologies"
  // qui en dépend) : on clique ailleurs dans le formulaire plutôt que de presser Échap.
  // Un clic .evaluate() (synthétique, non "trusted") ne suffit pas à faire réagir la détection
  // de clic extérieur de ng-select ; un vrai clic Playwright (forcé, le panneau pouvant encore
  // superposer la zone) est nécessaire pour refermer effectivement le panneau.
  await this.medicalGenerauxHeading.click({ force: true });
  await this.autresPathologiesTextBox.click();
  await this.autresPathologiesTextBox.fill('rhume');
  await this.allergiesTexbox.click();
  await this.cephalosporinesOption.click();
  // Même contournement que pour "Pathologies" : referme le panneau ng-dropdown resté ouvert.
  await this.medicalGenerauxHeading.click({ force: true });

  await this.autresAlergieTextBox.click();
  await this.autresAlergieTextBox.fill('tete');
  await this.selectTabac.click();
  await this.fumeurRegulierOption.click();
  await this.medicalGenerauxHeading.click({ force: true });
  await this.toxiConduitTextBox.click();
  await this.toxiConduitTextBox.fill('reduire le sucre');
  await this.buttonEnregister.click();
  await expect(this.confirmerLabel).toBeVisible();
  await expect(this.buttonFermer).toBeVisible();
  await expect(this.buttonConfirmer).toBeVisible();
  await this.buttonConfirmer.click();  
  }

}


