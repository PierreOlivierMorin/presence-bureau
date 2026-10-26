"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff, BellRing, Send, CheckCircle2, AlertCircle, X, ShieldAlert } from "lucide-react";
import {
  isPushNotificationSupported,
  getExistingSubscription,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  triggerTestPushNotification,
} from "@/lib/push-client";

export default function NotificationSettingsButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported = isPushNotificationSupported();
    setIsSupported(supported);

    if (supported) {
      getExistingSubscription().then((sub) => {
        setIsSubscribed(!!sub);
      });
    }
  }, []);

  const handleToggle = async () => {
    setIsLoading(true);
    setFeedback(null);

    if (isSubscribed) {
      const res = await unsubscribeFromPushNotifications();
      setIsLoading(false);
      setIsOpen(false);
      if (res.success) {
        setIsSubscribed(false);
      } else {
        alert(res.error || "Erreur de désactivation des notifications.");
      }
    } else {
      const res = await subscribeToPushNotifications();
      setIsLoading(false);
      setIsOpen(false);
      if (res.success) {
        setIsSubscribed(true);
      } else {
        alert(res.error || "Erreur d'activation des notifications.");
      }
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setFeedback(null);
    const res = await triggerTestPushNotification();
    setIsTesting(false);
    if (res.success) {
      setFeedback({ type: "success", text: "Notification test envoyée avec succès !" });
    } else {
      setFeedback({ type: "error", text: res.error || "Impossible d'envoyer la notification de test." });
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
          isSubscribed
            ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
            : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:bg-gray-50"
        }`}
        title="Paramètres des notifications push"
      >
        {isSubscribed ? (
          <>
            <BellRing className="w-3.5 h-3.5 text-blue-600" />
            <span>Notifs actives</span>
          </>
        ) : (
          <>
            <Bell className="w-3.5 h-3.5" />
            <span>Notifications</span>
          </>
        )}
      </button>

      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--card-bg)] border border-[var(--border)] text-[var(--text)] rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Bell className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-base">Notifications Push</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-[var(--muted)] space-y-2">
              <p>
                Recevez directement sur votre téléphone intelligent ou ordinateur :
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li>
                  <strong>Le matin (8h00)</strong> : La liste des collègues présents au bureau (uniquement s&apos;il y a du monde).
                </li>
                <li>
                  <strong>Le lundi matin</strong> : Un rappel pour entrer vos présences de la semaine.
                </li>
              </ul>
            </div>

            {feedback && (
              <div
                className={`flex items-start gap-2 p-3 rounded-xl text-xs border ${
                  feedback.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-rose-50 text-rose-800 border-rose-200"
                }`}
              >
                {feedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                ) : (
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={handleToggle}
                disabled={isLoading}
                className={`w-full py-2 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-75 ${
                  isSubscribed
                    ? "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                    : "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                }`}
              >
                {isLoading ? (
                  <span>Chargement...</span>
                ) : isSubscribed ? (
                  <>
                    <BellOff className="w-4 h-4" />
                    <span>Désactiver les notifications sur cet appareil</span>
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4" />
                    <span>Activer les notifications sur cet appareil</span>
                  </>
                )}
              </button>

              {isSubscribed && (
                <button
                  onClick={handleTest}
                  disabled={isTesting}
                  className="w-full py-2 px-4 rounded-xl text-xs font-medium border border-[var(--border)] hover:bg-gray-50 flex items-center justify-center gap-2 transition disabled:opacity-75"
                >
                  <Send className="w-3.5 h-3.5 text-blue-600" />
                  <span>{isTesting ? "Envoi du test..." : "Envoyer une notification test"}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
