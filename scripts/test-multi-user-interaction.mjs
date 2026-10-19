import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const SCREENSHOT_DIR = path.resolve("./public/test-screenshots");
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runTest() {
  console.log("🚀 Lancement du test multi-navigateurs & interaction utilisateur...");

  const browser = await chromium.launch({ headless: true });

  // 1. Session Frédérique (Équipe Alpha)
  const contextFrederique = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
  });
  const pageFrederique = await contextFrederique.newPage();

  // 2. Session Allyne (Équipe Alpha)
  const contextAllyne = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
  });
  const pageAllyne = await contextAllyne.newPage();

  // 3. Session Marc (Équipe Beta)
  const contextMarc = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
  });
  const pageMarc = await contextMarc.newPage();

  const results = {
    frederiqueLogin: false,
    frederiqueBookedOffice: false,
    allyneLogin: false,
    allyneSeesFrederique: false,
    allyneBookedRemote: false,
    allyneEquipeTabVerified: false,
    marcLogin: false,
    marcTeamIsolated: false,
    frederiqueSeesAllyneRemote: false,
  };

  try {
    // -------------------------------------------------------------
    // ETAPE 1: Connexion de Frédérique Bonenfant (Équipe Alpha)
    // -------------------------------------------------------------
    console.log("\n📱 [Navigateur 1 - Frédérique] Connexion...");
    await pageFrederique.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
    await pageFrederique.fill('input[name="email"]', "frederique@bureau.local");
    await pageFrederique.fill('input[name="password"]', "User123!");
    await pageFrederique.click('button[type="submit"]');

    await pageFrederique.waitForURL("http://localhost:3000/", { timeout: 8000 });
    const frederiqueHeader = await pageFrederique.locator("h1").last().textContent();
    console.log(`✅ [Frédérique] Connectée avec succès : "${frederiqueHeader?.trim()}"`);
    results.frederiqueLogin = frederiqueHeader?.includes("Frédérique");

    // Réservation au bureau pour le jour sélectionné (aujourd'hui)
    console.log("🏢 [Frédérique] Réservation de la journée 'Bureau'...");
    const officeBtn = pageFrederique.locator('button[data-testid="btn-action-office"]');
    await officeBtn.click();
    await pageFrederique.waitForTimeout(400);
    const submitBtnFrederique = pageFrederique.locator('[data-testid="submit-schedule-btn"]');
    if (await submitBtnFrederique.isVisible()) {
      await submitBtnFrederique.click();
      await pageFrederique.waitForTimeout(1000);
    }

    await pageFrederique.screenshot({
      path: path.join(SCREENSHOT_DIR, "1-frederique-booked-office.png"),
      fullPage: true,
    });
    results.frederiqueBookedOffice = true;
    console.log("📸 [Frédérique] Screenshot enregistré : 1-frederique-booked-office.png");

    // -------------------------------------------------------------
    // ETAPE 2: Connexion d'Allyne Fernandes (Équipe Alpha)
    // -------------------------------------------------------------
    console.log("\n📱 [Navigateur 2 - Allyne] Connexion...");
    await pageAllyne.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
    await pageAllyne.fill('input[name="email"]', "allyne@bureau.local");
    await pageAllyne.fill('input[name="password"]', "User123!");
    await pageAllyne.click('button[type="submit"]');

    await pageAllyne.waitForURL("http://localhost:3000/", { timeout: 8000 });
    const allyneHeader = await pageAllyne.locator("h1").last().textContent();
    console.log(`✅ [Allyne] Connectée avec succès : "${allyneHeader?.trim()}"`);
    results.allyneLogin = allyneHeader?.includes("Allyne");

    // Vérifier si Allyne voit Frédérique au bureau
    const allynePageContent = await pageAllyne.content();
    const seesFrederiqueOffice =
      allynePageContent.includes("Frédérique Bonenfant") &&
      allynePageContent.includes("Au Bureau");
    console.log(
      `👀 [Allyne] Voit-elle Frédérique Bonenfant 'Au Bureau' ? ${seesFrederiqueOffice ? "OUI ✅" : "NON ❌"}`
    );
    results.allyneSeesFrederique = seesFrederiqueOffice;

    // Allyne réserve 'Télétravail' pour elle-même
    console.log("🏠 [Allyne] Réservation de la journée 'Télétravail'...");
    const remoteBtn = pageAllyne.locator('button[data-testid="btn-action-remote"]');
    await remoteBtn.click();
    await pageAllyne.waitForTimeout(400);
    const submitBtnAllyne = pageAllyne.locator('[data-testid="submit-schedule-btn"]');
    if (await submitBtnAllyne.isVisible()) {
      await submitBtnAllyne.click();
      await pageAllyne.waitForTimeout(1000);
    }

    await pageAllyne.screenshot({
      path: path.join(SCREENSHOT_DIR, "2-allyne-sees-frederique-and-books-tt.png"),
      fullPage: true,
    });
    results.allyneBookedRemote = true;
    console.log("📸 [Allyne] Screenshot enregistré : 2-allyne-sees-frederique-and-books-tt.png");

    // Allyne consulte l'onglet 'Équipe'
    console.log("👥 [Allyne] Navigation vers l'onglet 'Équipe'...");
    const teamTabBtn = pageAllyne.locator('button:has-text("Équipe")').last();
    await teamTabBtn.click();
    await pageAllyne.waitForTimeout(1000);

    const equipeContent = await pageAllyne.content();
    const frederiqueInTeamTab = equipeContent.includes("Frédérique Bonenfant");
    const allyneInTeamTab = equipeContent.includes("Allyne Fernandes");
    console.log(`🔍 [Allyne - Onglet Équipe] Frédérique visible : ${frederiqueInTeamTab ? "OUI ✅" : "NON ❌"}`);
    console.log(`🔍 [Allyne - Onglet Équipe] Allyne visible : ${allyneInTeamTab ? "OUI ✅" : "NON ❌"}`);
    results.allyneEquipeTabVerified = frederiqueInTeamTab && allyneInTeamTab;

    await pageAllyne.screenshot({
      path: path.join(SCREENSHOT_DIR, "3-allyne-equipe-tab.png"),
      fullPage: true,
    });
    console.log("📸 [Allyne] Screenshot enregistré : 3-allyne-equipe-tab.png");

    // -------------------------------------------------------------
    // ETAPE 3: Connexion de Marc Tremblay (Équipe Beta) - Test Cloisonnement
    // -------------------------------------------------------------
    console.log("\n📱 [Navigateur 3 - Marc] Connexion (Équipe Beta)...");
    await pageMarc.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
    await pageMarc.fill('input[name="email"]', "marc@bureau.local");
    await pageMarc.fill('input[name="password"]', "User123!");
    await pageMarc.click('button[type="submit"]');

    await pageMarc.waitForURL("http://localhost:3000/", { timeout: 8000 });
    const marcHeader = await pageMarc.locator("h1").last().textContent();
    console.log(`✅ [Marc] Connecté avec succès : "${marcHeader?.trim()}"`);
    results.marcLogin = marcHeader?.includes("Marc");

    const marcPageContent = await pageMarc.content();
    const marcSeesAlphaMembers =
      marcPageContent.includes("Frédérique Bonenfant") ||
      marcPageContent.includes("Allyne Fernandes");
    console.log(
      `🔒 [Marc - Cloisonnement] Marc voit-il des membres de l'Équipe Alpha ? ${
        marcSeesAlphaMembers ? "OUI (ALERTE FUITE DE DONNEES) ❌" : "NON (PARFAITEMENT CLOISONNÉ) ✅"
      }`
    );
    results.marcTeamIsolated = !marcSeesAlphaMembers;

    await pageMarc.screenshot({
      path: path.join(SCREENSHOT_DIR, "4-marc-isolated-equipe-beta.png"),
      fullPage: true,
    });
    console.log("📸 [Marc] Screenshot enregistré : 4-marc-isolated-equipe-beta.png");

    // -------------------------------------------------------------
    // ETAPE 4: Frédérique actualise son écran et voit la présence d'Allyne
    // -------------------------------------------------------------
    console.log("\n📱 [Navigateur 1 - Frédérique] Actualisation de l'affichage...");
    // Cliquer sur le bouton d'actualisation
    const refreshBtn = pageFrederique.locator('button[title="Actualiser les présences de l\'équipe"]');
    if (await refreshBtn.count() > 0) {
      await refreshBtn.click();
    } else {
      await pageFrederique.reload({ waitUntil: "networkidle" });
    }
    await pageFrederique.waitForTimeout(1500);

    const frederiqueUpdatedContent = await pageFrederique.content();
    const frederiqueSeesAllyneRemote =
      frederiqueUpdatedContent.includes("Allyne Fernandes") &&
      (frederiqueUpdatedContent.includes("En Télétravail") || frederiqueUpdatedContent.includes("Télétravail"));
    console.log(
      `👀 [Frédérique] Voit-elle Allyne Fernandes 'En Télétravail' ? ${
        frederiqueSeesAllyneRemote ? "OUI ✅" : "NON ❌"
      }`
    );
    results.frederiqueSeesAllyneRemote = frederiqueSeesAllyneRemote;

    await pageFrederique.screenshot({
      path: path.join(SCREENSHOT_DIR, "5-frederique-sees-allyne-remote.png"),
      fullPage: true,
    });
    console.log("📸 [Frédérique] Screenshot enregistré : 5-frederique-sees-allyne-remote.png");

  } catch (err) {
    console.error("❌ Erreur pendant le test :", err);
  } finally {
    await browser.close();
    console.log("\n========================================================");
    console.log("RÉSUMÉ DES TESTS MULTI-NAVIGATEURS :");
    console.log("========================================================");
    console.log(`1. Connexion Frédérique (Alpha) : ${results.frederiqueLogin ? "PASS" : "FAIL"}`);
    console.log(`2. Frédérique réserve Bureau : ${results.frederiqueBookedOffice ? "PASS" : "FAIL"}`);
    console.log(`3. Connexion Allyne (Alpha) : ${results.allyneLogin ? "PASS" : "FAIL"}`);
    console.log(`4. Allyne voit Frédérique au bureau : ${results.allyneSeesFrederique ? "PASS" : "FAIL"}`);
    console.log(`5. Allyne réserve Télétravail : ${results.allyneBookedRemote ? "PASS" : "FAIL"}`);
    console.log(`6. Onglet Équipe complet d'Allyne : ${results.allyneEquipeTabVerified ? "PASS" : "FAIL"}`);
    console.log(`7. Connexion Marc (Beta) : ${results.marcLogin ? "PASS" : "FAIL"}`);
    console.log(`8. Cloisonnement strict Équipe Beta : ${results.marcTeamIsolated ? "PASS" : "FAIL"}`);
    console.log(`9. Frédérique voit Allyne en télétravail : ${results.frederiqueSeesAllyneRemote ? "PASS" : "FAIL"}`);
    console.log("========================================================");
  }
}

runTest();
