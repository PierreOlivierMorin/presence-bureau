import { chromium } from "playwright";

async function runAutoRefreshTest() {
  console.log("🚀 Lancement du test de validation de l'Auto-Refresh en temps réel...");

  const browser = await chromium.launch({ headless: true });

  // Contexte 1 : Allyne (Observatrice sur mobile)
  const contextAllyne = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
  });
  const pageAllyne = await contextAllyne.newPage();

  // Contexte 2 : Frédérique (Inscriptrice)
  const contextFrederique = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
  });
  const pageFrederique = await contextFrederique.newPage();

  try {
    // 1. Connexion de Frédérique en premier pour effacer sa présence sur Jeudi
    console.log("📱 [Préparation - Frédérique] Connexion...");
    await pageFrederique.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
    await pageFrederique.fill('input[name="email"]', "frederique@bureau.local");
    await pageFrederique.fill('input[name="password"]', "User123!");
    await pageFrederique.click('button[type="submit"]');
    await pageFrederique.waitForURL("http://localhost:3000/", { timeout: 8000 });

    // Frédérique sélectionne le Jeudi (JEU) et efface sa présence
    const jeuChip = pageFrederique.locator('button:has-text("JEU")').first();
    await jeuChip.click();
    await pageFrederique.waitForTimeout(500);

    const clearBtn = pageFrederique.locator('button:has-text("Effacer")').first();
    if (await clearBtn.count() > 0) {
      await clearBtn.click();
      await pageFrederique.waitForTimeout(400);
      const submitBtn = pageFrederique.locator('[data-testid="submit-schedule-btn"]');
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await pageFrederique.waitForTimeout(800);
      }
    }

    // 2. Connexion d'Allyne (Observatrice)
    console.log("\n📱 [Client 1 - Allyne] Connexion...");
    await pageAllyne.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
    await pageAllyne.fill('input[name="email"]', "allyne@bureau.local");
    await pageAllyne.fill('input[name="password"]', "User123!");
    await pageAllyne.click('button[type="submit"]');
    await pageAllyne.waitForURL("http://localhost:3000/", { timeout: 8000 });

    // Basculer en vue semaine
    const weekBtn = pageAllyne.locator('button:has-text("Vue Semaine")').first();
    await weekBtn.click();
    await pageAllyne.waitForTimeout(500);

    // Déplier le Jeudi dans la vue semaine
    const jeuRow = pageAllyne.locator('[data-testid^="week-day-row-"]').nth(3); // Jeudi is 4th day (index 3)
    await jeuRow.locator(".text-left").click();
    await pageAllyne.waitForTimeout(500);

    // Vérifier l'indicateur "Direct"
    const liveIndicator = pageAllyne.locator('[data-testid="live-indicator"]');
    const isLiveVisible = await liveIndicator.isVisible();
    console.log(`📡 [Client 1 - Allyne] Indicateur 'Direct' visible : ${isLiveVisible ? "OUI ✅" : "NON ❌"}`);

    const allyneContentBefore = await pageAllyne.content();
    const frederiqueOfficeBefore = allyneContentBefore.includes("Frédérique Bonenfant") && allyneContentBefore.includes("Jeu.");
    console.log(`👀 [Client 1 - Allyne] Frédérique déjà au bureau Jeudi ? ${frederiqueOfficeBefore ? "OUI" : "NON"}`);

    // 3. Frédérique s'inscrit au Bureau pour Jeudi !
    console.log("\n🏢 [Client 2 - Frédérique] S'inscrit au Bureau pour Jeudi...");
    const officeBtn = pageFrederique.locator('button:has-text("Bureau")').first();
    await officeBtn.click();
    await pageFrederique.waitForTimeout(400);
    const submitBtn = pageFrederique.locator('[data-testid="submit-schedule-btn"]');
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await pageFrederique.waitForTimeout(800);
    }
    console.log("✅ [Client 2 - Frédérique] Inscription 'Bureau' soumise pour Jeudi !");

    // 4. Client 1 (Allyne) attend SANS RIEN TOUCHER que l'auto-refresh se produise
    console.log("\n⏳ [Client 1 - Allyne] En attente de l'auto-refresh automatique (max 7 secondes)...");
    let autoRefreshed = false;
    for (let i = 0; i < 8; i++) {
      await pageAllyne.waitForTimeout(1000);
      const content = await pageAllyne.content();
      if (content.includes("Frédérique Bonenfant")) {
        // Frédérique apparaît dans la liste d'Allyne
        autoRefreshed = true;
        console.log(`⚡ [Client 1 - Allyne] Frédérique Bonenfant est apparue automatiquement après ${i + 1} seconde(s) ! 🎉`);
        break;
      }
    }

    console.log(`\n========================================================`);
    console.log(`RÉSULTAT DU TEST AUTO-REFRESH EN TEMPS RÉEL :`);
    console.log(`========================================================`);
    console.log(`Auto-refresh temps réel sans rechargement : ${autoRefreshed ? "RÉUSSI ✅" : "ÉCHEC ❌"}`);
    console.log(`========================================================`);

    if (!autoRefreshed) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error("❌ Erreur pendant le test :", err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

runAutoRefreshTest();
