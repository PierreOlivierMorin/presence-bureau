"use client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushNotificationSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Récupère ou enregistre le Service Worker de façon garantie sans blocage infini
 */
async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    throw new Error("Service Worker non supporté");
  }

  // Vérifier si déjà enregistré
  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    reg = await navigator.serviceWorker.register("/sw.js");
  }

  // Si le worker est déjà actif, retourner immédiatement
  if (reg.active) {
    return reg;
  }

  // Sinon, attendre avec un timeout de sécurité de 3 secondes pour éviter tout gel
  const readyPromise = navigator.serviceWorker.ready;
  const timeoutPromise = new Promise<ServiceWorkerRegistration>((resolve) =>
    setTimeout(() => resolve(reg!), 3000)
  );

  return Promise.race([readyPromise, timeoutPromise]);
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushNotificationSupported()) return null;
  try {
    const registration = await getServiceWorkerRegistration();
    return await registration.pushManager.getSubscription();
  } catch (err) {
    console.error("[Push] Erreur lors de la lecture de la souscription:", err);
    return null;
  }
}

export async function subscribeToPushNotifications(): Promise<{
  success: boolean;
  error?: string;
  isDenied?: boolean;
}> {
  if (!isPushNotificationSupported()) {
    return { success: false, error: "Les notifications ne sont pas supportées par ce navigateur." };
  }

    let vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      try {
        const keyRes = await fetch("/api/push/vapid-public-key");
        if (keyRes.ok) {
          const keyData = await keyRes.json();
          vapidPublicKey = keyData.publicKey;
        }
      } catch (err) {
        console.error("[Push] Erreur récupération clé publique VAPID:", err);
      }
    }

    if (!vapidPublicKey) {
      return { success: false, error: "Clé VAPID publique manquante sur le serveur." };
    }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return {
        success: false,
        isDenied: permission === "denied",
        error:
          permission === "denied"
            ? "L'autorisation des notifications a été refusée dans les paramètres de votre navigateur."
            : "L'autorisation n'a pas été accordée.",
      };
    }

    const registration = await getServiceWorkerRegistration();
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as unknown as BufferSource,
      });
    }

    // Sauvegarder dans la base de données
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return { success: false, error: errorData.error || "Erreur serveur lors de l'enregistrement." };
    }

    return { success: true };
  } catch (err) {
    console.error("[Push] Erreur d'abonnement:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erreur inattendue lors de l'activation.",
    };
  }
}

export async function unsubscribeFromPushNotifications(): Promise<{ success: boolean; error?: string }> {
  if (!isPushNotificationSupported()) {
    return { success: false, error: "Non supporté" };
  }

  try {
    const registration = await getServiceWorkerRegistration();
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
    }

    return { success: true };
  } catch (err) {
    console.error("[Push] Erreur de désabonnement:", err);
    return { success: false, error: "Erreur lors du désabonnement." };
  }
}

export async function triggerTestPushNotification(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch("/api/push/test", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || "Échec de l'envoi du test." };
    }
    return { success: true, message: "Notification de test envoyée !" };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur réseau." };
  }
}
