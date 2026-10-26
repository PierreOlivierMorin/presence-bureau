"use client";

import { useState, useEffect } from "react";
import { Bell, BellRing, X, CheckCircle2, AlertCircle, Share2, Smartphone, Send } from "lucide-react";
import {
  isPushNotificationSupported,
  getExistingSubscription,
  subscribeToPushNotifications,
  triggerTestPushNotification,
} from "@/lib/push-client";

export default function DailyPushReminder() {
  const [isVisible, setIsVisible] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isIosBrowser, setIsIosBrowser] = useState(false);
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    // Vérification côté client
    if (typeof window === "undefined") return;

    const todayStr = new Date().toISOString().split("T")[0];
    const lastDismissedDate = localStorage.getItem("pb_daily_push_prompt_date");

    // Détecter si on est sur iOS et hors mode standalone (Safari standard)
    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isIos && !isStandalone) {
      setIsIosBrowser(true);
      // Si première visite de la journée sur iPhone hors PWA, proposer le rappel PWA / notifications
      if (lastDismissedDate !== todayStr) {
        setIsVisible(true);
      }
      return;
    }

    if (!isPushNotificationSupported()) return;

    // Vérifier si déjà abonné ou si la permission a déjà été refusée
    if (Notification.permission === "denied") {
      return; // Ne pas importuner si expressément refusé
    }

    getExistingSubscription().then((sub) => {
      if (sub) {
        setIsSubscribed(true);
      } else {
        // Pas encore abonné : afficher le rappel si c'est la première visite du jour
        if (lastDismissedDate !== todayStr) {
          setIsVisible(true);
        }
      }
    });
  }, []);

  const handleDismissToday = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    localStorage.setItem("pb_daily_push_prompt_date", todayStr);
    setIsVisible(false);
  };

  const handleEnable = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const result = await subscribeToPushNotifications();

    setIsLoading(false);
    setIsVisible(false);

    if (result.success) {
      setIsSubscribed(true);
      const todayStr = new Date().toISOString().split("T")[0];
      localStorage.setItem("pb_daily_push_prompt_date", todayStr);
    } else {
      alert(result.error || "Impossible d'activer les notifications.");
    }
  };

  const handleSendTest = async () => {
    setTestSent(true);
    const result = await triggerTestPushNotification();
    if (result.success) {
      setStatusMessage("Notification envoyée ! Regardez sur votre écran.");
    } else {
      setErrorMessage(result.error || "Erreur lors de l'envoi du test.");
    }
    setTimeout(() => setTestSent(false), 3000);
  };

  if (!isVisible) return null;

  return (
    <aside
      aria-label="Rappel des notifications quotidiennes"
      className="mb-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-blue-400/30 transition-all animate-in fade-in slide-in-from-top-3 duration-300 relative overflow-hidden"
    >
      {/* Motif décoratif d'arrière-plan */}
      <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none" />

      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/30 text-white">
            {isSubscribed ? (
              <BellRing className="w-5 h-5 text-amber-300 animate-pulse" />
            ) : (
              <Bell className="w-5 h-5" />
            )}
          </div>

          <div className="space-y-1">
            <h2 className="text-sm sm:text-base font-bold leading-tight flex items-center gap-2">
              <span>Restez informé des présences au bureau</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white">
                Nouveau
              </span>
            </h2>

            {isIosBrowser ? (
              <div className="text-xs sm:text-sm text-blue-100 space-y-1 max-w-2xl">
                <p>
                  Pour recevoir les notifications le matin sur votre iPhone :
                </p>
                <div className="flex items-center gap-2 text-xs bg-white/15 px-3 py-1.5 rounded-lg border border-white/20 mt-1">
                  <Share2 className="w-4 h-4 shrink-0 text-white" />
                  <span>
                    Appuyez sur <strong>Partager</strong> en bas de Safari, puis sur{" "}
                    <strong>« Sur l&apos;écran d&apos;accueil »</strong>.
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs sm:text-sm text-blue-100 max-w-2xl">
                Activez les notifications pour savoir chaque matin qui est au bureau (envoyé
                uniquement s&apos;il y a des collègues présents) et recevoir votre rappel de
                planning le lundi.
              </p>
            )}

            {statusMessage && (
              <div className="flex items-center gap-2 text-xs text-emerald-200 bg-emerald-950/40 px-3 py-1.5 rounded-lg mt-2 border border-emerald-400/30">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="flex items-center gap-2 text-xs text-rose-200 bg-rose-950/40 px-3 py-1.5 rounded-lg mt-2 border border-rose-400/30">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleDismissToday}
          className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition shrink-0"
          title="Fermer pour aujourd'hui"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="mt-4 pt-3 border-t border-white/15 flex flex-wrap items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-2 text-[11px] text-blue-200">
          <Smartphone className="w-3.5 h-3.5" />
          <span>Fonctionne sur téléphone intelligent et ordinateur</span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleDismissToday}
            className="text-xs text-white/90 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition"
          >
            Plus tard
          </button>

          {isSubscribed ? (
            <button
              onClick={handleSendTest}
              disabled={testSent}
              className="flex items-center gap-1.5 text-xs font-semibold bg-white text-blue-700 hover:bg-blue-50 px-3.5 py-1.5 rounded-lg shadow-sm transition active:scale-95 disabled:opacity-75"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{testSent ? "Envoi..." : "Tester la notification"}</span>
            </button>
          ) : !isIosBrowser ? (
            <button
              onClick={handleEnable}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-xs font-semibold bg-white text-blue-700 hover:bg-blue-50 px-4 py-1.5 rounded-lg shadow-sm transition active:scale-95 disabled:opacity-75"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>{isLoading ? "Activation..." : "Activer les notifications"}</span>
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
