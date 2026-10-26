import webpush from "web-push";
import { prisma } from "@/lib/db";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || "mailto:admin@presence-bureau.local";

let isConfigured = false;
if (publicKey && privateKey) {
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    isConfigured = true;
  } catch (error) {
    console.error("[Push] Erreur d'initialisation VAPID:", error);
  }
} else {
  console.warn("[Push] VAPID keys not configured. Web Push notifications will be disabled.");
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Envoie une notification à une souscription spécifique.
 * Supprime automatiquement la souscription si elle a expiré (410 / 404).
 */
export async function sendNotificationToSubscription(
  sub: { id: string; endpoint: string; p256dh: string; auth: string },
  payload: PushPayload
): Promise<boolean> {
  if (!isConfigured) return false;

  const pushSubscription = {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.p256dh,
      auth: sub.auth,
    },
  };

  try {
    await webpush.sendNotification(
      pushSubscription,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url || "/",
        tag: payload.tag || "presence-update",
      })
    );
    return true;
  } catch (err: unknown) {
    const error = err as { statusCode?: number; message?: string };
    // 410 Gone ou 404 Not Found : la souscription n'est plus valide sur le serveur du navigateur
    if (error.statusCode === 410 || error.statusCode === 404) {
      console.log(`[Push] Souscription expirée (${sub.id}), suppression...`);
      try {
        await prisma.pushSubscription.delete({ where: { id: sub.id } });
      } catch {
        // Ignorer si déjà supprimée
      }
    } else {
      console.error(`[Push] Échec d'envoi pour la souscription ${sub.id}:`, error.message || error);
    }
    return false;
  }
}

/**
 * Envoie une notification à tous les appareils enregistrés pour un utilisateur donné.
 */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) return { sent: 0, total: 0 };

  const results = await Promise.all(
    subscriptions.map((sub) => sendNotificationToSubscription(sub, payload))
  );

  return {
    sent: results.filter(Boolean).length,
    total: subscriptions.length,
  };
}

/**
 * Envoie une notification aux membres d'une équipe donnée ayant activé les notifications.
 * @param teamId ID de l'équipe
 * @param payload Contenu de la notification
 * @param excludeUserId Optionnel: ID de l'utilisateur à ne pas notifier (ex: l'auteur)
 */
export async function sendPushToTeam(teamId: string, payload: PushPayload, excludeUserId?: string) {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      user: {
        teamId,
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
    },
  });

  if (subscriptions.length === 0) return { sent: 0, total: 0 };

  const results = await Promise.all(
    subscriptions.map((sub) => sendNotificationToSubscription(sub, payload))
  );

  return {
    sent: results.filter(Boolean).length,
    total: subscriptions.length,
  };
}

/**
 * Envoie une notification à tous les utilisateurs enregistrés dans le système.
 */
export async function sendPushToAllUsers(payload: PushPayload) {
  const subscriptions = await prisma.pushSubscription.findMany();

  if (subscriptions.length === 0) return { sent: 0, total: 0 };

  const results = await Promise.all(
    subscriptions.map((sub) => sendNotificationToSubscription(sub, payload))
  );

  return {
    sent: results.filter(Boolean).length,
    total: subscriptions.length,
  };
}
