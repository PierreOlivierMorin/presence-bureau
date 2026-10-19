/**
 * Service d'envoi de courriels (Simulation locale + intégration Resend / SMTP).
 * En environnement de développement ou si aucun fournisseur n'est configuré,
 * les liens et codes de sécurité sont affichés dans la console du serveur
 * et stockés temporairement pour faciliter les tests.
 */

import { getAppBaseUrl } from "@/lib/url";

interface SendEmailResult {
  success: boolean;
  simulated: boolean;
  messageId?: string;
  error?: string;
  previewUrl?: string;
  code?: string;
}

// Mémoire tampon pour faciliter les tests et l'assistance en mode développement
const devEmailInbox = new Map<
  string,
  { type: string; code?: string; link?: string; timestamp: number }
>();

export function getLatestSimulatedEmail(email: string) {
  return devEmailInbox.get(email.toLowerCase().trim());
}

/**
 * Envoi d'un courriel via Resend avec gestion détaillée des erreurs et support HTML
 */
async function sendViaResend({
  to,
  subject,
  textContent,
  htmlContent,
}: {
  to: string;
  subject: string;
  textContent: string;
  htmlContent?: string;
}): Promise<SendEmailResult | null> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[Service Courriel] ATTENTION : Variable RESEND_API_KEY absente. Le courriel ne sera pas expédié en production (simulation active)."
      );
    }
    return null;
  }

  try {
    const fromEmail = process.env.EMAIL_FROM || "notifications@presence-bureau.fyi";
    const sender = fromEmail.includes("<")
      ? fromEmail
      : `Présence Bureau <${fromEmail}>`;

    const payload = JSON.stringify({
      from: sender,
      to: [to],
      subject,
      text: textContent,
      ...(htmlContent ? { html: htmlContent } : {}),
    });

    let resStatus: number;
    let resOk: boolean;
    let resBodyText: string;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "PresenceBureau/1.0",
        },
        body: payload,
      });
      resStatus = res.status;
      resOk = res.ok;
      resBodyText = await res.text();
    } catch {
      // Repli via node:https en cas de timeout IPv6 ou souci undici
      const https = await import("node:https");
      const fallbackRes = await new Promise<{ ok: boolean; status: number; text: string }>((resolve, reject) => {
        const req = https.request("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
            "User-Agent": "PresenceBureau/1.0",
          },
        }, (response) => {
          let data = "";
          response.on("data", chunk => data += chunk);
          response.on("end", () => {
            resolve({
              ok: (response.statusCode || 500) >= 200 && (response.statusCode || 500) < 300,
              status: response.statusCode || 500,
              text: data,
            });
          });
        });
        req.on("error", reject);
        req.write(payload);
        req.end();
      });
      resStatus = fallbackRes.status;
      resOk = fallbackRes.ok;
      resBodyText = fallbackRes.text;
    }

    if (resOk) {
      let data: { id?: string } = {};
      try {
        data = JSON.parse(resBodyText);
      } catch {}
      return { success: true, simulated: false, messageId: data.id };
    }

    const errorDetails = resBodyText;
    let parsedMessage = errorDetails;
    try {
      const parsed = JSON.parse(errorDetails);
      if (parsed.message) {
        parsedMessage = parsed.message;
      }
    } catch {
      // conserver errorDetails
    }

    console.error(
      `[Email Resend Error] Échec d'envoi vers "${to}" (HTTP ${resStatus}) :`,
      parsedMessage
    );

    let friendlyError = `Échec d'envoi Resend (HTTP ${resStatus})`;
    try {
      const parsed = JSON.parse(errorDetails);
      if (parsed.message) {
        if (parsed.message.includes("You can only send testing emails to your own email address")) {
          friendlyError = "Mode test Resend actif : 'onboarding@resend.dev' ne permet d'expédier qu'à l'adresse propriétaire du compte Resend. Pour inviter d'autres personnes, vous devez configurer un domaine vérifié sur resend.com/domains.";
        } else {
          friendlyError = parsed.message;
        }
      }
    } catch {
      if (errorDetails) friendlyError += ` : ${errorDetails}`;
    }

    if (resStatus === 403 && (fromEmail.includes("resend.dev") || !process.env.EMAIL_FROM)) {
      console.warn(
        `[Email Resend Astuce] Vous utilisez l'adresse par défaut (${fromEmail}). Resend autorise uniquement l'envoi vers l'adresse propriétaire de votre compte. Pour envoyer à tous vos collègues, ajoutez et validez votre domaine sur https://resend.com/domains et configurez EMAIL_FROM.`
      );
    }

    return {
      success: false,
      simulated: false,
      error: friendlyError,
    };
  } catch (e) {
    console.error("[Email Resend Network Error]", e);
    return {
      success: false,
      simulated: false,
      error: e instanceof Error ? e.message : "Erreur de connexion au service de courriel.",
    };
  }
}

/**
 * Envoi d'un courriel de vérification d'adresse
 */
export async function sendVerificationEmail({
  to,
  code,
  token,
  firstName,
}: {
  to: string;
  code: string;
  token: string;
  firstName?: string;
}): Promise<SendEmailResult> {
  const normalizedEmail = to.toLowerCase().trim();
  const baseUrl = await getAppBaseUrl();
  const verifyLink = `${baseUrl}/verify-email?token=${token}&email=${encodeURIComponent(
    normalizedEmail
  )}`;

  devEmailInbox.set(normalizedEmail, {
    type: "VERIFICATION",
    code,
    link: verifyLink,
    timestamp: Date.now(),
  });

  const subject = "Vérifiez votre adresse courriel - Présence Bureau";
  const nameGreeting = firstName ? `Bonjour ${firstName}` : "Bonjour";

  const textContent = `${nameGreeting},\n\n` +
    `Votre code de vérification pour Présence Bureau est : ${code}\n\n` +
    `Ou cliquez directement sur ce lien pour valider votre compte :\n${verifyLink}\n\n` +
    `Ce lien et ce code expirent dans 24 heures.`;

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #2563eb; font-size: 24px; margin: 0;">📅 Présence Bureau</h1>
        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Vérification de sécurité</p>
      </div>
      <p style="font-size: 15px; line-height: 1.5; color: #334155;">${nameGreeting},</p>
      <p style="font-size: 15px; line-height: 1.5; color: #334155;">
        Pour activer votre compte et accéder à votre calendrier d'équipe, saisissez ce code à 6 chiffres :
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 6px; padding: 12px 28px; background-color: #f1f5f9; border-radius: 8px; border: 1px solid #cbd5e1; color: #0f172a; font-family: monospace;">
          ${code}
        </span>
      </div>
      <p style="font-size: 15px; line-height: 1.5; color: #334155;">
        Ou validez votre adresse en un clic :
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${verifyLink}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 8px; font-size: 15px;">
          Valider mon compte
        </a>
      </div>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 12px; color: #94a3b8; line-height: 1.4;">
        Ce code et ce lien sont valides pendant 24 heures.<br />
        Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce courriel en toute sécurité.
      </p>
    </div>
  `;

  const resendResult = await sendViaResend({
    to: normalizedEmail,
    subject,
    textContent,
    htmlContent,
  });

  if (resendResult) {
    return {
      ...resendResult,
      code,
      previewUrl: verifyLink,
    };
  }

  // Simulation locale si aucune clé Resend n'est fournie
  console.log("\n==================== [SIMULATION COURRIEL] ====================");
  console.log(`✉️  DESTINATAIRE : ${normalizedEmail}`);
  console.log(`📌 SUJET        : ${subject}`);
  console.log(`🔑 CODE OTP     : ${code}`);
  console.log(`🔗 LIEN DIRECT  : ${verifyLink}`);
  console.log("===============================================================\n");

  return {
    success: true,
    simulated: true,
    code,
    previewUrl: verifyLink,
  };
}

/**
 * Envoi d'une invitation à une équipe
 */
export async function sendInvitationEmail({
  to,
  inviterName,
  teamName,
  token,
  role,
}: {
  to: string;
  inviterName: string;
  teamName: string;
  token: string;
  role: string;
}): Promise<SendEmailResult> {
  const normalizedEmail = to.toLowerCase().trim();
  const baseUrl = await getAppBaseUrl();
  const inviteLink = `${baseUrl}/register?invite=${token}`;

  devEmailInbox.set(normalizedEmail, {
    type: "INVITATION",
    link: inviteLink,
    timestamp: Date.now(),
  });

  const roleLabel = role === "ADMIN" ? "Administrateur" : "Membre d'équipe";
  const subject = `Invitation à rejoindre l'équipe "${teamName}" - Présence Bureau`;
  const textContent = `Bonjour,\n\n` +
    `${inviterName} vous invite à rejoindre l'équipe "${teamName}" sur Présence Bureau avec le rôle de ${roleLabel}.\n\n` +
    `Pour finaliser la création de votre compte sécurisé, cliquez sur ce lien :\n${inviteLink}\n\n` +
    `Cette invitation est valable pendant 7 jours.`;

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #2563eb; font-size: 24px; margin: 0;">📅 Présence Bureau</h1>
        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Invitation à collaborer</p>
      </div>
      <p style="font-size: 15px; line-height: 1.5; color: #334155;">Bonjour,</p>
      <p style="font-size: 15px; line-height: 1.5; color: #334155;">
        <strong>${inviterName}</strong> vous invite à rejoindre l'équipe <strong>« ${teamName} »</strong> sur Présence Bureau en tant que <strong>${roleLabel}</strong>.
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${inviteLink}" style="display: inline-block; padding: 12px 28px; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 8px; font-size: 15px;">
          Accepter l'invitation et créer mon compte
        </a>
      </div>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 12px; color: #94a3b8; line-height: 1.4;">
        Cette invitation est valable pendant 7 jours.<br />
        Si vous n'attendiez pas cette invitation, vous pouvez ignorer ce message.
      </p>
    </div>
  `;

  const resendResult = await sendViaResend({
    to: normalizedEmail,
    subject,
    textContent,
    htmlContent,
  });

  if (resendResult) {
    return {
      ...resendResult,
      previewUrl: inviteLink,
    };
  }

  // Simulation locale
  console.log("\n==================== [SIMULATION INVITATION] ===================");
  console.log(`✉️  DESTINATAIRE : ${normalizedEmail}`);
  console.log(`📌 ÉQUIPE       : ${teamName}`);
  console.log(`👤 INVITÉ PAR   : ${inviterName}`);
  console.log(`🛡️ RÔLE         : ${roleLabel}`);
  console.log(`🔗 LIEN UNIQUE  : ${inviteLink}`);
  console.log("===============================================================\n");

  return {
    success: true,
    simulated: true,
    previewUrl: inviteLink,
  };
}

/**
 * Envoi d'un courriel de réinitialisation de mot de passe
 */
export async function sendPasswordResetEmail({
  to,
  code,
  token,
  firstName,
}: {
  to: string;
  code: string;
  token: string;
  firstName?: string;
}): Promise<SendEmailResult> {
  const normalizedEmail = to.toLowerCase().trim();
  const baseUrl = await getAppBaseUrl();
  const resetLink = `${baseUrl}/reset-password?token=${token}&email=${encodeURIComponent(
    normalizedEmail
  )}`;

  devEmailInbox.set(normalizedEmail, {
    type: "RESET_PASSWORD",
    code,
    link: resetLink,
    timestamp: Date.now(),
  });

  const nameGreeting = firstName ? `Bonjour ${firstName}` : "Bonjour";
  const subject = "Réinitialisation de votre mot de passe - Présence Bureau";
  const textContent = `${nameGreeting},\n\n` +
    `Une demande de réinitialisation de mot de passe a été initiée pour votre compte.\n\n` +
    `Votre code de réinitialisation est : ${code}\n\n` +
    `Ou cliquez sur le lien suivant pour choisir un nouveau mot de passe :\n${resetLink}\n\n` +
    `Ce lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce message en toute sécurité.`;

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #2563eb; font-size: 24px; margin: 0;">📅 Présence Bureau</h1>
        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Réinitialisation de mot de passe</p>
      </div>
      <p style="font-size: 15px; line-height: 1.5; color: #334155;">${nameGreeting},</p>
      <p style="font-size: 15px; line-height: 1.5; color: #334155;">
        Une demande de réinitialisation de mot de passe a été initiée pour votre compte. Saisissez ce code de vérification :
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 6px; padding: 12px 28px; background-color: #f1f5f9; border-radius: 8px; border: 1px solid #cbd5e1; color: #0f172a; font-family: monospace;">
          ${code}
        </span>
      </div>
      <p style="font-size: 15px; line-height: 1.5; color: #334155;">
        Ou définissez un nouveau mot de passe directement via ce bouton :
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 8px; font-size: 15px;">
          Changer mon mot de passe
        </a>
      </div>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 12px; color: #94a3b8; line-height: 1.4;">
        Ce code et ce lien sont valables pendant 1 heure.<br />
        Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce courriel en toute sécurité.
      </p>
    </div>
  `;

  const resendResult = await sendViaResend({
    to: normalizedEmail,
    subject,
    textContent,
    htmlContent,
  });

  if (resendResult) {
    return {
      ...resendResult,
      code,
      previewUrl: resetLink,
    };
  }

  // Simulation locale
  console.log("\n============= [SIMULATION RÉINITIALISATION MDP] =============");
  console.log(`✉️  DESTINATAIRE : ${normalizedEmail}`);
  console.log(`🔑 CODE OTP     : ${code}`);
  console.log(`🔗 LIEN DIRECT  : ${resetLink}`);
  console.log("===============================================================\n");

  return {
    success: true,
    simulated: true,
    code,
    previewUrl: resetLink,
  };
}
