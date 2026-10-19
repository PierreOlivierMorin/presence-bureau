"use client";

import { useState, useEffect, useCallback, useTransition, useMemo, useRef } from "react";
import { SessionUser } from "@/lib/auth";
import { getMonthPresencesAction, batchSetPresencesAction } from "@/lib/actions/presence";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Users, Smartphone, Check, CheckCircle2, RotateCw } from "lucide-react";
import MobileReservationView from "./MobileReservationView";

export type StatusType = "NONE" | "OFFICE" | "REMOTE" | "ABSENT";

export interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
}

export interface PresenceRecord {
  date: string;
  userId: string;
  amStatus: string;
  dinerStatus?: string;
  pmStatus: string;
}

interface CalendarViewProps {
  currentUser: SessionUser;
  initialYear: number;
  initialMonth: number; // 1-12
  initialMembers: TeamMember[];
  initialPresences: PresenceRecord[];
  allTeams?: { id: string; name: string }[];
  activeTeamId?: string | null;
}

const STATUS_DETAILS: Record<StatusType, { label: string; className: string }> = {
  NONE: { label: "—", className: "" },
  OFFICE: { label: "Bureau", className: "status-office" },
  REMOTE: { label: "Télétravail", className: "status-remote" },
  ABSENT: { label: "Absent", className: "status-absent" },
};

const STATUS_CYCLE: StatusType[] = ["NONE", "OFFICE", "REMOTE", "ABSENT"];

export default function CalendarView({
  currentUser,
  initialYear,
  initialMonth,
  initialMembers,
  initialPresences,
  allTeams,
  activeTeamId: initialActiveTeamId,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(
    new Date(initialYear, initialMonth - 1, 1)
  );
  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>(
    initialActiveTeamId || currentUser.teamId || undefined
  );
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(initialMembers);
  const [presencesMap, setPresencesMap] = useState<
    Record<string, Record<string, { am: StatusType; diner: StatusType; pm: StatusType }>>
  >(() => {
    const map: Record<string, Record<string, { am: StatusType; diner: StatusType; pm: StatusType }>> = {};
    for (const p of initialPresences) {
      if (!map[p.date]) map[p.date] = {};
      map[p.date][p.userId] = {
        am: (p.amStatus as StatusType) || "NONE",
        diner: (p.dinerStatus as StatusType) || "NONE",
        pm: (p.pmStatus as StatusType) || "NONE",
      };
    }
    return map;
  });

  const [savedPresences, setSavedPresences] = useState<
    Record<string, { am: StatusType; diner: StatusType; pm: StatusType }>
  >(() => {
    const map: Record<string, { am: StatusType; diner: StatusType; pm: StatusType }> = {};
    for (const p of initialPresences) {
      if (p.userId === currentUser.id) {
        map[p.date] = {
          am: (p.amStatus as StatusType) || "NONE",
          diner: (p.dinerStatus as StatusType) || "NONE",
          pm: (p.pmStatus as StatusType) || "NONE",
        };
      }
    }
    return map;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [viewMode, setViewMode] = useState<"auto" | "mobile" | "desktop">("auto");
  const [isMobileScreen, setIsMobileScreen] = useState(false);

  // Dates modifiées localement n'ayant pas encore été soumises au serveur
  const pendingDates = useMemo(() => {
    const dates = new Set<string>();
    for (const dateKey of Object.keys(presencesMap)) {
      const current = presencesMap[dateKey]?.[currentUser.id] || { am: "NONE", diner: "NONE", pm: "NONE" };
      const saved = savedPresences[dateKey] || { am: "NONE", diner: "NONE", pm: "NONE" };
      if (current.am !== saved.am || current.diner !== saved.diner || current.pm !== saved.pm) {
        dates.add(dateKey);
      }
    }
    for (const dateKey of Object.keys(savedPresences)) {
      const current = presencesMap[dateKey]?.[currentUser.id] || { am: "NONE", diner: "NONE", pm: "NONE" };
      const saved = savedPresences[dateKey];
      if (current.am !== saved.am || current.diner !== saved.diner || current.pm !== saved.pm) {
        dates.add(dateKey);
      }
    }
    return Array.from(dates);
  }, [presencesMap, savedPresences, currentUser.id]);

  const pendingDatesRef = useRef<string[]>([]);
  useEffect(() => {
    pendingDatesRef.current = pendingDates;
  }, [pendingDates]);

  // Alerte si l'utilisateur quitte la page avec des modifications non soumises
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingDates.length > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [pendingDates.length]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const isMobile = viewMode === "mobile" || (viewMode === "auto" && isMobileScreen);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-11
  const today = new Date();
  const isThisMonth = today.getFullYear() === year && today.getMonth() === month;

  // Calcul du format français (ex: "septembre 2026")
  const monthName = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(currentDate);

  // Changement de mois ou d'équipe
  const loadMonthData = useCallback((targetDate: Date, targetTeamId?: string) => {
    setCurrentDate(targetDate);
    startTransition(async () => {
      const res = await getMonthPresencesAction(
        targetDate.getFullYear(),
        targetDate.getMonth() + 1,
        targetTeamId || selectedTeamId
      );

      setTeamMembers(res.teamMembers);
      const newMap: Record<string, Record<string, { am: StatusType; diner: StatusType; pm: StatusType }>> = {};
      const newSaved: Record<string, { am: StatusType; diner: StatusType; pm: StatusType }> = {};

      for (const p of res.presences) {
        if (!newMap[p.date]) newMap[p.date] = {};
        const statusObj = {
          am: (p.amStatus as StatusType) || "NONE",
          diner: (p.dinerStatus as StatusType) || "NONE",
          pm: (p.pmStatus as StatusType) || "NONE",
        };
        newMap[p.date][p.userId] = statusObj;
        if (p.userId === currentUser.id) {
          newSaved[p.date] = statusObj;
        }
      }

      setSavedPresences((prev) => ({ ...prev, ...newSaved }));
      setPresencesMap((prev) => {
        const merged = { ...newMap };
        // Préserver les modifications locales non soumises de l'utilisateur
        for (const d of pendingDatesRef.current) {
          if (prev[d]?.[currentUser.id]) {
            if (!merged[d]) merged[d] = {};
            merged[d][currentUser.id] = prev[d][currentUser.id];
          }
        }
        return merged;
      });
    });
  }, [selectedTeamId, currentUser.id]);

  // Auto-refresh pour récupérer les présences et inscriptions en temps réel
  useEffect(() => {
    const refresh = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      loadMonthData(currentDate, selectedTeamId);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const interval = setInterval(refresh, 5000);

    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(interval);
    };
  }, [currentDate, selectedTeamId, loadMonthData]);

  const handlePrevMonth = () => {
    const d = new Date(year, month - 1, 1);
    loadMonthData(d);
  };

  const handleNextMonth = () => {
    const d = new Date(year, month + 1, 1);
    loadMonthData(d);
  };

  const handleToday = () => {
    const d = new Date(today.getFullYear(), today.getMonth(), 1);
    loadMonthData(d);
  };

  const handleTeamChange = (newTeamId: string) => {
    setSelectedTeamId(newTeamId);
    loadMonthData(currentDate, newTeamId);
  };

  // Bascule locale de statut AM/Dîner/PM (sans requête immédiate)
  const handleToggleSlot = (dateKey: string, period: "am" | "diner" | "pm") => {
    const userPresence = presencesMap[dateKey]?.[currentUser.id] || {
      am: "NONE",
      diner: "NONE",
      pm: "NONE",
    };
    const currentStatus = userPresence[period] || "NONE";
    const nextIndex = (STATUS_CYCLE.indexOf(currentStatus) + 1) % STATUS_CYCLE.length;
    const nextStatus = STATUS_CYCLE[nextIndex];

    setPresencesMap((prev) => {
      const copy = { ...prev };
      const existingDay = copy[dateKey]?.[currentUser.id] || {
        am: "NONE" as StatusType,
        diner: "NONE" as StatusType,
        pm: "NONE" as StatusType,
      };
      if (!copy[dateKey]) copy[dateKey] = {};
      copy[dateKey] = {
        ...copy[dateKey],
        [currentUser.id]: {
          ...existingDay,
          [period]: nextStatus,
        },
      };
      return copy;
    });
  };

  // Soumission groupée de l'horaire complet en une seule requête
  const handleSubmitSchedule = async () => {
    if (pendingDates.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    const entries = pendingDates.map((dateKey) => {
      const u = presencesMap[dateKey]?.[currentUser.id] || {
        am: "NONE" as StatusType,
        diner: "NONE" as StatusType,
        pm: "NONE" as StatusType,
      };
      return {
        date: dateKey,
        amStatus: u.am,
        dinerStatus: u.diner,
        pmStatus: u.pm,
      };
    });

    try {
      await batchSetPresencesAction(entries);
      setSavedPresences((prev) => {
        const copy = { ...prev };
        for (const entry of entries) {
          copy[entry.date] = {
            am: entry.amStatus,
            diner: entry.dinerStatus ?? entry.amStatus,
            pm: entry.pmStatus,
          };
        }
        return copy;
      });
    } catch {
      alert("Erreur lors de la soumission de l'horaire.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Annuler les modifications non soumises
  const handleCancelChanges = () => {
    setPresencesMap((prev) => {
      const copy = { ...prev };
      for (const d of pendingDates) {
        if (!copy[d]) copy[d] = {};
        copy[d] = {
          ...copy[d],
          [currentUser.id]: savedPresences[d] || { am: "NONE", diner: "NONE", pm: "NONE" },
        };
      }
      return copy;
    });
  };

  // Calcul des cases calendaires (Lun -> Dim)
  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
  const totalDays = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((firstDayIndex + totalDays) / 7) * 7;
  const weekDays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  return (
    <div className="w-full">
      {viewMode !== "desktop" && (
        <div className={viewMode === "mobile" ? "block" : "block md:hidden"}>
          <MobileReservationView
            currentUser={currentUser}
            initialYear={initialYear}
            initialMonth={initialMonth}
            initialMembers={teamMembers}
            initialPresences={initialPresences}
            allTeams={allTeams}
            activeTeamId={selectedTeamId}
            onSwitchToDesktop={() => setViewMode("desktop")}
          />
        </div>
      )}

      {viewMode !== "mobile" && (
        <div className={viewMode === "desktop" ? "block w-full max-w-[1240px] mx-auto" : "hidden md:block w-full max-w-[1240px] mx-auto"}>
          {/* Barre de contrôle Admin pour basculer d'équipe */}
      {currentUser.role === "ADMIN" && allTeams && allTeams.length > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 text-amber-900 font-medium">
            <Users className="w-4 h-4 text-amber-700" />
            <span>Vue Administrateur - Changer d&apos;équipe :</span>
          </div>
          <select
            value={selectedTeamId || ""}
            onChange={(e) => handleTeamChange(e.target.value)}
            className="px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-sm text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
          >
            {allTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Légende */}
      <div className="flex flex-wrap items-center gap-4 sm:gap-6 mb-4 text-xs sm:text-sm text-[var(--text)]">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-[var(--office-border)]" />
          <span>Bureau</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-[var(--remote-border)]" />
          <span>Télétravail</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-[var(--absent-border)]" />
          <span>Absent</span>
        </div>
        <div className="text-[var(--muted)] italic text-xs">
          💡 Cliquez sur AM, Dîner ou PM sur votre ligne pour basculer votre présence
        </div>
      </div>

      {/* Bannière de soumission de l'horaire */}
      {pendingDates.length > 0 && (
        <div
          data-testid="desktop-pending-schedule-banner"
          className="mb-4 bg-emerald-50 border border-emerald-300 rounded-2xl p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm animate-in fade-in"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-950">
                Horaire sélectionné : {pendingDates.length} jour{pendingDates.length > 1 ? "s" : ""} à soumettre
              </h3>
              <p className="text-xs text-emerald-700">
                Vos choix sont prêts. Soumettez l&apos;horaire complet en une seule fois pour enregistrer.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancelChanges}
              disabled={isSubmitting}
              data-testid="desktop-cancel-schedule-btn"
              className="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 active-press transition"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSubmitSchedule}
              disabled={isSubmitting}
              data-testid="desktop-submit-schedule-btn"
              className="px-4 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm flex items-center gap-2 active-press transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <RotateCw className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>Soumettre mon horaire</span>
            </button>
          </div>
        </div>
      )}

      {/* Barre de navigation par mois */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold capitalize text-[var(--text)] flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-[var(--primary)]" />
          {monthName}
          <span
            className="flex items-center gap-1 text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 normal-case"
            title="Mises à jour automatiques en direct actives"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Direct</span>
          </span>
          {isPending && (
            <span className="text-xs font-normal text-[var(--muted)] animate-pulse">
              (chargement...)
            </span>
          )}
        </h2>

        <div className="flex items-center gap-2">
          {pendingDates.length > 0 && (
            <button
              type="button"
              onClick={handleSubmitSchedule}
              disabled={isSubmitting}
              data-testid="month-bar-submit-btn"
              className="px-3 py-1.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm flex items-center gap-1.5 active-press transition disabled:opacity-50"
              title="Soumettre l'horaire sélectionné"
            >
              {isSubmitting ? (
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>Soumettre ({pendingDates.length})</span>
            </button>
          )}
          <button
            onClick={() => setViewMode("mobile")}
            className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition shadow-sm flex items-center gap-1.5"
            title="Basculer vers la vue mobile optimisée pour les réservations rapides"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Vue Mobile (Rapide)</span>
            <span className="sm:hidden">Mobile</span>
          </button>
          <button
            onClick={handlePrevMonth}
            className="px-3 py-1.5 text-sm font-medium bg-[var(--card-bg)] border border-[var(--border)] rounded-lg hover:bg-gray-100 transition shadow-sm flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Précédent</span>
          </button>
          <button
            onClick={handleToday}
            className="px-3 py-1.5 text-sm font-medium bg-[var(--card-bg)] border border-[var(--border)] rounded-lg hover:bg-gray-100 transition shadow-sm"
          >
            Aujourd&apos;hui
          </button>
          <button
            onClick={handleNextMonth}
            className="px-3 py-1.5 text-sm font-medium bg-[var(--card-bg)] border border-[var(--border)] rounded-lg hover:bg-gray-100 transition shadow-sm flex items-center gap-1"
          >
            <span>Suivant</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grille du Calendrier */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((d) => (
          <div
            key={d}
            className="text-center font-semibold text-[var(--muted)] text-xs sm:text-sm pb-1"
          >
            {d}
          </div>
        ))}

        {Array.from({ length: totalCells }).map((_, i) => {
          const dayNum = i - firstDayIndex + 1;
          const isCurrentMonthDay = dayNum >= 1 && dayNum <= totalDays;

          if (!isCurrentMonthDay) {
            return (
              <div
                key={`empty-${i}`}
                className="bg-gray-50/60 opacity-40 rounded-xl min-h-[145px] p-2 border border-[var(--border)]"
              />
            );
          }

          const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
          const isToday = isThisMonth && today.getDate() === dayNum;
          const isPendingDay = pendingDates.includes(dateKey);

          // Statuts de l'utilisateur connecté
          const userDay = presencesMap[dateKey]?.[currentUser.id] || {
            am: "NONE",
            diner: "NONE",
            pm: "NONE",
          };
          const amInfo = STATUS_DETAILS[userDay.am || "NONE"];
          const dinerInfo = STATUS_DETAILS[userDay.diner || "NONE"];
          const pmInfo = STATUS_DETAILS[userDay.pm || "NONE"];

          return (
            <div
              key={dateKey}
              className={`bg-[var(--card-bg)] rounded-xl min-h-[145px] p-2 border flex flex-col gap-1.5 shadow-sm transition ${
                isPendingDay
                  ? "border-amber-400 ring-2 ring-amber-300/50 bg-amber-50/20"
                  : isToday
                  ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/20"
                  : "border-[var(--border)] hover:border-gray-300"
              }`}
            >
              {/* En-tête de la cellule */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-xs sm:text-sm font-bold ${
                      isToday ? "text-[var(--primary)]" : "text-[var(--text)]"
                    }`}
                  >
                    {dayNum}
                  </span>
                  {isPendingDay && (
                    <span className="text-[9px] uppercase font-bold text-amber-800 bg-amber-100 border border-amber-200 px-1 py-0.2 rounded leading-tight">
                      Modifié
                    </span>
                  )}
                </div>
                {isToday && (
                  <span className="text-[10px] uppercase font-bold text-[var(--primary)] bg-blue-50 px-1 rounded">
                    Auj.
                  </span>
                )}
              </div>

              {/* Boutons AM / Dîner / PM de l'utilisateur connecté */}
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => handleToggleSlot(dateKey, "am")}
                  title="Avant-midi : cliquer pour changer"
                  className={`py-1 px-0.5 rounded text-center text-[10px] font-semibold border border-[var(--border)] leading-tight transition ${amInfo.className}`}
                >
                  AM
                  <span className="block text-[9px] font-normal truncate">
                    {amInfo.label}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleSlot(dateKey, "diner")}
                  title="Dîner : cliquer pour changer"
                  className={`py-1 px-0.5 rounded text-center text-[10px] font-semibold border border-[var(--border)] leading-tight transition ${dinerInfo.className}`}
                >
                  Dîner
                  <span className="block text-[9px] font-normal truncate">
                    {dinerInfo.label}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleSlot(dateKey, "pm")}
                  title="Après-midi : cliquer pour changer"
                  className={`py-1 px-0.5 rounded text-center text-[10px] font-semibold border border-[var(--border)] leading-tight transition ${pmInfo.className}`}
                >
                  PM
                  <span className="block text-[9px] font-normal truncate">
                    {pmInfo.label}
                  </span>
                </button>
              </div>

              {/* Section Collègues de l'équipe */}
              <div className="flex flex-col gap-1 mt-1 pt-1.5 border-t border-dashed border-[var(--border)] flex-1">
                {(["am", "diner", "pm"] as const).map((period) => {
                  const periodLabels: Record<"am" | "diner" | "pm", string> = {
                    am: "AM",
                    diner: "DÎNER",
                    pm: "PM",
                  };
                  const periodEntries = teamMembers.filter((m) => {
                    if (m.id === currentUser.id) return false;
                    const st = presencesMap[dateKey]?.[m.id]?.[period];
                    return st && st !== "NONE";
                  });

                  return (
                    <div key={period} className="flex flex-col gap-0.5">
                      <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider">
                        {periodLabels[period]}
                      </span>
                      <div className="flex flex-col gap-1">
                        {periodEntries.length > 0 ? (
                          periodEntries.map((m) => {
                            const st = presencesMap[dateKey]?.[m.id]?.[period] as StatusType;
                            const d = STATUS_DETAILS[st];
                            return (
                              <span
                                key={m.id}
                                className={`text-[10px] px-1.5 py-0.5 rounded leading-tight flex items-center justify-between truncate ${d.className}`}
                                title={`${m.firstName} ${m.lastName} : ${d.label}`}
                              >
                                <span className="truncate">{m.firstName}</span>
                                <span className="text-[9px] opacity-85 ml-1">{d.label}</span>
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-[10px] text-[var(--muted)] px-1 leading-tight">
                            —
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  )}
</div>
  );
}