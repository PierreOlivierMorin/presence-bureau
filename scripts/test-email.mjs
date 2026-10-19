#!/usr/bin/env node

import https from "node:https";

/**
 * Script de diagnostic et test d'envoi d'email via Resend
 * Usage : node --env-file=.env scripts/test-email.mjs <destinataire>
 */

const targetEmail = process.argv[2];

console.log("==================================================");
console.log("🔍 Diagnostic de configuration Resend - Présence Bureau");
console.log("==================================================\n");

const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.EMAIL_FROM || "notifications@presence-bureau.fyi";

console.log(`1. Clé API (RESEND_API_KEY) : ${apiKey ? "✅ Définie (" + apiKey.slice(0, 6) + "...)" : "❌ Absente"}`);
console.log(`2. Expéditeur (EMAIL_FROM)   : ${process.env.EMAIL_FROM ? "✅ " + process.env.EMAIL_FROM : "⚠️ Non défini (valeur par défaut : notifications@presence-bureau.fyi)"}`);

if (!apiKey) {
  console.error("\n❌ Erreur : RESEND_API_KEY n'est pas configurée dans votre fichier .env.");
  console.error("Veuillez ajouter votre clé Resend dans le fichier .env :");
  console.error('RESEND_API_KEY="re_..."');
  process.exit(1);
}

if (!targetEmail) {
  console.log("\n⚠️ Aucun destinataire spécifié pour le test.");
  console.log("Usage : node --env-file=.env scripts/test-email.mjs <destinataire@exemple.com>");
  console.log("ou : npm run email:test <destinataire@exemple.com>\n");
  process.exit(0);
}

const sender = fromEmail.includes("<") ? fromEmail : `Présence Bureau <${fromEmail}>`;

console.log(`\n📧 Tentative d'envoi d'un courriel test :`);
console.log(`   De : ${sender}`);
console.log(`   À  : ${targetEmail}`);

async function sendTest() {
  try {
    const payload = JSON.stringify({
      from: sender,
      to: [targetEmail],
      subject: "Test de configuration courriel - Présence Bureau",
      text: "Félicitations ! Votre configuration Resend pour Présence Bureau fonctionne parfaitement.",
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #2563eb;">✅ Configuration Resend Opérationnelle</h2>
          <p>Ce message confirme que votre application <strong>Présence Bureau</strong> peut désormais envoyer des courriels à <strong>${targetEmail}</strong>.</p>
          <p style="color: #64748b; font-size: 13px;">Envoyé depuis : ${sender}</p>
        </div>
      `,
    });

    const res = await new Promise((resolve, reject) => {
      const req = https.request("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          "User-Agent": "PresenceBureau/1.0",
        },
      }, (response) => {
        let data = "";
        response.on("data", chunk => data += chunk);
        response.on("end", () => {
          resolve({ status: response.statusCode, text: data });
        });
      });
      req.on("error", reject);
      req.write(payload);
      req.end();
    });

    let bodyJson = null;
    try {
      bodyJson = JSON.parse(res.text);
    } catch {}

    if (res.status >= 200 && res.status < 300) {
      console.log("\n🎉 SUCCÈS ! Le courriel a été accepté par Resend.");
      console.log(`   ID du message : ${bodyJson?.id || res.text}`);
      console.log(`   Vérifiez la boîte de réception de ${targetEmail} (et les courriers indésirables/spams).\n`);
    } else {
      console.error(`\n❌ ÉCHEC d'envoi (HTTP ${res.status}) :`);
      const errorMsg = bodyJson?.message || bodyText;
      console.error(`   Message de Resend : "${errorMsg}"`);

      if (res.status === 403 && (errorMsg.includes("testing emails to your own email address") || fromEmail.includes("resend.dev"))) {
        console.log("\n💡 POURQUOI VOUS AVEZ CETTE ERREUR :");
        console.log("   Vous utilisez le domaine de test gratuit 'onboarding@resend.dev'.");
        console.log("   Resend interdit STRICTEMENT d'envoyer à d'autres personnes tant que vous n'avez pas validé un domaine personnalisé.");
        console.log("   C'est pour cette raison exacte que vous ne recevez des emails que sur votre propre adresse !\n");
        console.log("👉 COMMENT RÉSOUDRE CE PROBLÈME :");
        console.log("   1. Allez sur https://resend.com/domains");
        console.log("   2. Cliquez sur 'Add Domain' (ex: votredomaine.com ou mail.votredomaine.com)");
        console.log("   3. Ajoutez les enregistrements DNS (DKIM, SPF, MX) chez votre registraire");
        console.log("   4. Attendez la validation dans Resend (statut Verified)");
        console.log("   5. Mettez à jour EMAIL_FROM dans votre .env (ex: notifications@votredomaine.com)\n");
      }
    }
  } catch (err) {
    console.error("\n❌ Erreur réseau ou imprévue :", err.message, err.cause || "");
  }
}

sendTest();
