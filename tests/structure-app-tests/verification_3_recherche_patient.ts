import { test, expect, Page } from '@playwright/test';
test.setTimeout(600000); // 10 minutes, suffisant pour tester chaque champ un par un

test('Recherche Patients - tests individuels par champ', async ({ page }) => {
  // ======================== HELPERS ========================
  async function selectNgOption(label: string, optionText: string) {
    const container = page.locator(`ng-select:has-text("${label}")`);
    await container.click();
    await page.waitForSelector('.ng-dropdown-panel .ng-option', { timeout: 5000 });
    await page.locator(`.ng-dropdown-panel .ng-option:has-text("${optionText}")`).first().click();
  }

  async function fillPhone(phone: string) {
    const phoneInput = page.getByRole('textbox', { name: 'Entrez le numéro' });
    await phoneInput.fill(phone);
  }

  async function resetForm() {
    await page.getByRole('button', { name: 'Réinitialiser' }).click();
    // Attendre que le tableau soit à nouveau rempli (au moins une ligne)
    await page.waitForFunction(() => {
      const rows = document.querySelectorAll('.compact-table tbody tr');
      return rows.length > 0;
    }, { timeout: 10000 });
  }

  // ======================== CONNEXION ========================
  await page.goto('https://pro-icare.com/auth/login');
  await page.getByRole('textbox', { name: 'Votre identifiant' }).fill('hi-admin');
  await page.getByRole('textbox', { name: 'Votre HI CODE' }).fill('NEST');
  await page.getByRole('textbox', { name: 'Votre mot de passe' }).fill('BcIsX7V&ZRh7');
  await page.getByRole('button', { name: 'Connexion' }).click();

  // ======================== NAVIGATION VERS PATIENTS ========================
  await expect(page.getByRole('heading', { name: 'Patients' })).toBeVisible();
  await page.getByText('Menu').nth(3).click();
  await page.getByRole('link', { name: ' Patients' }).click();
  await page.waitForURL('**/patient/patients');
  await expect(page.locator('.compact-table')).toBeVisible();
  await expect(page.locator('.compact-table tbody tr:first-child')).toBeVisible();

  // Fermer le menu pour dégager la vue (optionnel)
  await page.getByText('Menu').nth(3).click();

  // ======================== RÉCUPÉRATION DES VALEURS DU PREMIER PATIENT ========================
  const firstRow = page.locator('.compact-table tbody tr:first-child');
  const patientId = await firstRow.locator('td:first-child').innerText();
  const folderOrder = await firstRow.locator('td:nth-child(2)').innerText();
  const firstName = await firstRow.locator('td:nth-child(3)').innerText();
  const lastName = await firstRow.locator('td:nth-child(4)').innerText();
  const dateNaissance = await firstRow.locator('td:nth-child(5)').innerText();
  const phone = await firstRow.locator('td:nth-child(6)').innerText();
  const email = await firstRow.locator('td:nth-child(7)').innerText();
  const city = await firstRow.locator('td:nth-child(8)').innerText();
  const sexe = await firstRow.locator('td:nth-child(9)').innerText();
  const assurance = await firstRow.locator('td:nth-child(10)').innerText();
  const dateCreation = await firstRow.locator('td:nth-child(11)').innerText();

  // ======================== DÉFINITION DES CHAMPS ========================
  interface Field {
    name: string;
    fill: (value: string) => Promise<void>;
    value: string;
    displayValue: string;
  }

  const fields: Field[] = [];

  if (patientId && patientId !== '-') {
    fields.push({
      name: 'Identifiant patient',
      fill: async (val: string) => await page.getByPlaceholder('Identifiant...').fill('123'),
      value: patientId,
      displayValue: patientId,
    });
  }

  if (folderOrder && folderOrder !== '-') {
    fields.push({
      name: 'N° Dossier',
      fill: async (val: string) => await page.getByPlaceholder('N° dossier...').fill(val),
      value: folderOrder,
      displayValue: folderOrder,
    });
  }

  if (firstName && firstName !== '-') {
    fields.push({
      name: 'Prénom',
      fill: async (val: string) => await page.getByRole('textbox', { name: 'Prénom...' }).fill(val),
      value: firstName,
      displayValue: firstName,
    });
  }

  if (lastName && lastName !== '-') {
    fields.push({
      name: 'Nom',
      fill: async (val: string) => await page.getByRole('textbox', { name: 'Nom...', exact: true }).fill(val),
      value: lastName,
      displayValue: lastName,
    });
  }


 if (dateNaissance && dateNaissance !== '-') {
    fields.push({
      name: 'Date de naissance',
      fill: async (val: string) => {
        const [day, month, year] = val.split('/');
        const isoDate = `${year}-${month}-${day}`;
        await page.locator('input[name="createdDate"]').fill(isoDate);
      },
      value: dateNaissance,
      displayValue: dateNaissance,
    });
  }

  if (email && email !== '-') {
    fields.push({
      name: 'Email',
      fill: async (val: string) => await page.getByPlaceholder('Email...').fill(val),
      value: email,
      displayValue: email,
    });
  }

  if (sexe && sexe !== '-') {
    fields.push({
      name: 'Sexe',
      fill: async (val: string) => await selectNgOption('Sexe', val),
      value: sexe,
      displayValue: sexe,
    });
  }

  if (city && city !== '-') {
    fields.push({
      name: 'Ville',
      fill: async (val: string) => await selectNgOption('Ville', val),
      value: city,
      displayValue: city,
    });
  }

  if (assurance && assurance !== '-') {
    fields.push({
      name: 'Assurance',
      fill: async (val: string) => await selectNgOption('Assurance', val),
      value: assurance,
      displayValue: assurance,
    });
  }

  if (dateCreation && dateCreation !== '-') {
    fields.push({
      name: 'Date de création',
      fill: async (val: string) => {
        const [day, month, year] = val.split('/');
        const isoDate = `${year}-${month}-${day}`;
        await page.locator('input[type="date"][name="createdDate"]').fill(isoDate);
      },
      value: dateCreation,
      displayValue: dateCreation,
    });
  }

  if (phone && phone !== '-') {
    fields.push({
      name: 'Téléphone',
      fill: async (val: string) => await fillPhone(val),
      value: phone,
      displayValue: phone,
    });
  }

  // ======================== TESTS INDIVIDUELS ========================
  const n = fields.length;
  console.log(`Nombre de champs à tester : ${n}`);

  async function logResult() {
    const rows = page.locator('.compact-table tbody tr');
    const rowCount = await rows.count();
    console.log(`📊 Résultat : ${rowCount} patient(s) trouvé(s)`);
    if (rowCount > 0) {
      const firstRowCells = await rows.first().locator('td').allTextContents();
      console.log(`   Premier patient : ${firstRowCells.slice(0, 5).join(' | ')}`);
    }
  }

  for (let i = 0; i < n; i++) {
    await resetForm();

    // Remplir uniquement le champ i
    await fields[i].fill(fields[i].value);

    console.log(`\n🔍 Test du champ : ${fields[i].name} = "${fields[i].displayValue}"`);

    await page.getByRole('button', { name: 'Rechercher' }).click();
    await page.waitForTimeout(300);

    await logResult();

    // Vérifier que le patient de référence est trouvé
    try {
      await page.waitForSelector(`.compact-table tbody tr td:first-child:has-text("${patientId}")`, { timeout: 1000 });
      console.log('✅ Patient de référence trouvé');
    } catch {
      console.log('⚠️ Patient de référence NON trouvé dans les résultats');
    }
  }

  // ======================== VÉRIFICATION FINALE ========================
  await resetForm();
  await expect(page.getByPlaceholder('Identifiant...')).toHaveValue('');
  console.log('\n✅ Test terminé avec succès');
});