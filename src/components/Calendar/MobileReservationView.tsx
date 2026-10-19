"use client";

import { useState, useTransition, useMemo, useCallback, useEffect, useRef } from "react";
import { SessionUser } from "@/lib/auth";
import {
  batchSetPresencesAction,
  getMonthPresencesAction,
} from "@/lib/actions/presence";
import {
  Calendar as CalendarIcon,
  Building2,
  Home,
  Palmtree,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Download,
  Settings,
  Clock,
  ArrowRightLeft,
  Check,
  X,
  Search,
  CheckCircle2,
  SlidersHorizontal,
  CalendarDays,
  ListFilter,
  RotateCw,
} from "lucide-react";
import InstallPwaPrompt from "@/components/PWA/InstallPwaPrompt";

export type StatusType = "NONE" | "OFFICE" | "REMOTE" | "ABSENT";
const STATUS_CYCLE: StatusType[] = ["NONE", "OFFICE", "REMOTE", "ABSENT"];

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

interface MobileReservationViewProps {
  currentUser: SessionUser;
  initialYear: number;
  initialMonth: number;
  initialMembers: TeamMember[];
  initialPresences: PresenceRecord[];
  allTeams?: { id: string; name: string }[];
  activeTeamId?: string | null;
  onSwitchToDesktop?: () => void;
}

type TabType = "schedule" | "team" | "templates" | "options";

type PeriodDisplay = "all" | "am" | "diner" | "pm" | "am+diner" | "diner+pm" | "am+pm";

function formatPeriodShort(period: PeriodDisplay): string {
  switch (period) {
    case "all":
      return "Journée complète";
    case "am":
      return "AM";
    case "diner":
      return "Dîner";
    case "pm":
      return "PM";
    case "am+diner":
      return "AM + Dîner";
    case "diner+pm":
      return "Dîner + PM";
    case "am+pm":
      return "AM + PM";
  }
}

function formatPeriodLong(period: PeriodDisplay): string {
  switch (period) {
    case "all":
      return "Toute la journée";
    case "am":
      return "Matin (AM)";
    case "diner":
      return "Dîner";
    case "pm":
      return "Après-midi (PM)";
    case "am+diner":
      return "Matin & Dîner";
    case "diner+pm":
      return "Dîner & Après-midi";
    case "am+pm":
      return "Matin & Après-midi";
  }
}

const STATUS_CONFIG: Record<
  StatusType,
  { label: string; shortLabel: string; icon: string; bg: string; text: string; border: string }
> = {
  NONE: {
    label: "Non renseigné",
    shortLabel: "—",
    icon: "⚪",
    bg: "bg-gray-50",
    text: "text-gray-500",
    border: "border-gray-200",
  },
  OFFICE: {
    label: "Bureau",
    shortLabel: "Bureau",
    icon: "🏢",
    bg: "bg-[var(--office)]",
    text: "text-[var(--office-text)]",
    border: "border-[var(--office-border)]",
  },
  REMOTE: {
    label: "Télétravail",
    shortLabel: "TT",
    icon: "🏠",
    bg: "bg-[var(--remote)]",
    text: "text-[var(--remote-text)]",
    border: "border-[var(--remote-border)]",
  },
  ABSENT: {
    label: "Absent",
    shortLabel: "Absent",
    icon: "🌴",
    bg: "bg-[var(--absent)]",
    text: "text-[var(--absent-text)]",
    border: "border-[var(--absent-border)]",
  },
};

// Formattage date YYYY-MM-DD
function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Trouver le lundi de la semaine d'une date donnée
function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

export default function MobileReservationView({
  currentUser,
  initialMembers,
  initialPresences,
  allTeams,
  activeTeamId: initialActiveTeamId,
  onSwitchToDesktop,
}: MobileReservationViewProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<TabType>("schedule");

  // Sub-view in schedule: single day focus ("day") or compact week list ("week")
  const [scheduleViewMode, setScheduleViewMode] = useState<"day" | "week">("day");

  // Selected Team
  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>(
    initialActiveTeamId || currentUser.teamId || undefined
  );
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(initialMembers);

  // Presences map
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

  // Current Date reference
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => formatDateKey(today), [today]);

  // Selected Day Key (default to today)
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);

  // Week start (Monday of the week containing selectedDateKey)
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(today));

  // Quick preset modal / PWA install modal / Toast
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [showPwaInstallModal, setShowPwaInstallModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Search filter for Team tab
  const [teamSearchQuery, setTeamSearchQuery] = useState("");

  const daysScrollRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();

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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(20);
    }
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 2800);
  };

  // Chargement des données pour un mois / équipe
  const loadMonthData = useCallback((targetDate: Date, targetTeamId?: string) => {
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
        const copy = { ...prev };
        const prefix = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-`;
        for (const k of Object.keys(copy)) {
          if (k.startsWith(prefix)) {
            delete copy[k];
          }
        }
        const merged = { ...copy, ...newMap };
        // Conserver les choix non soumis de l'utilisateur
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

  // Actualisation automatique en temps réel (auto-refresh) :
  // - Polling toutes les 5 secondes lorsque la page est visible
  // - Actualisation immédiate au retour sur l'onglet ou l'application (visibilitychange & focus)
  // - Prise en charge des semaines à cheval sur deux mois
  useEffect(() => {
    const refresh = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      const curDate = new Date(selectedDateKey + "T12:00:00");
      loadMonthData(curDate);

      // Si la semaine commence et se termine sur deux mois différents, actualiser les deux mois
      const wEnd = new Date(weekStart);
      wEnd.setDate(wEnd.getDate() + 6);
      if (weekStart.getMonth() !== wEnd.getMonth() || weekStart.getFullYear() !== wEnd.getFullYear()) {
        const otherDate = curDate.getMonth() === weekStart.getMonth() ? wEnd : weekStart;
        loadMonthData(otherDate);
      }
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
  }, [loadMonthData, selectedDateKey, weekStart]);

  // Changement d'onglet avec rafraîchissement des données de l'équipe
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === "team" || tab === "schedule") {
      loadMonthData(new Date(selectedDateKey + "T12:00:00"));
    }
  };

  // Jours de la semaine affichée (Lundi à Dimanche - 7 jours)
  const weekDays = useMemo(() => {
    const days: {
      date: Date;
      dateKey: string;
      dayName: string;
      dayNumber: number;
      isToday: boolean;
      isSelected: boolean;
    }[] = [];
    const base = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const dKey = formatDateKey(d);
      const dayName = new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(d);
      days.push({
        date: d,
        dateKey: dKey,
        dayName: dayName.replace(".", "").toUpperCase(),
        dayNumber: d.getDate(),
        isToday: dKey === todayKey,
        isSelected: dKey === selectedDateKey,
      });
    }
    return days;
  }, [weekStart, todayKey, selectedDateKey]);

  // Scroll active day chip into view smoothly
  useEffect(() => {
    if (daysScrollRef.current) {
      const activeEl = daysScrollRef.current.querySelector('[data-selected="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }
  }, [selectedDateKey]);

  // Format de l'intitulé de la semaine
  const weekLabel = useMemo(() => {
    const start = weekDays[0]?.date;
    const end = weekDays[6]?.date;
    if (!start || !end) return "";
    const startStr = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(start);
    const endStr = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(end);
    return `${startStr} au ${endStr}`;
  }, [weekDays]);

  // Navigation par Semaine
  const handlePrevWeek = () => {
    const nextMon = new Date(weekStart);
    nextMon.setDate(nextMon.getDate() - 7);
    setWeekStart(nextMon);

    // Ajuster le jour sélectionné au même jour de la semaine précédente
    const selD = new Date(selectedDateKey + "T12:00:00");
    selD.setDate(selD.getDate() - 7);
    setSelectedDateKey(formatDateKey(selD));

    loadMonthData(selD);
  };

  const handleNextWeek = () => {
    const nextMon = new Date(weekStart);
    nextMon.setDate(nextMon.getDate() + 7);
    setWeekStart(nextMon);

    // Ajuster le jour sélectionné au même jour de la semaine suivante
    const selD = new Date(selectedDateKey + "T12:00:00");
    selD.setDate(selD.getDate() + 7);
    setSelectedDateKey(formatDateKey(selD));

    loadMonthData(selD);
  };

  // Navigation par Jour
  const handlePrevDay = () => {
    const d = new Date(selectedDateKey + "T12:00:00");
    d.setDate(d.getDate() - 1);
    const newKey = formatDateKey(d);
    setSelectedDateKey(newKey);
    const newMon = getMonday(d);
    if (formatDateKey(newMon) !== formatDateKey(weekStart)) {
      setWeekStart(newMon);
      loadMonthData(d);
    }
  };

  const handleNextDay = () => {
    const d = new Date(selectedDateKey + "T12:00:00");
    d.setDate(d.getDate() + 1);
    const newKey = formatDateKey(d);
    setSelectedDateKey(newKey);
    const newMon = getMonday(d);
    if (formatDateKey(newMon) !== formatDateKey(weekStart)) {
      setWeekStart(newMon);
      loadMonthData(d);
    }
  };

  // Navigation contextuelle pour la barre de semaine :
  // - En vue semaine : saute de semaine en semaine (+/- 7 jours)
  // - En vue jour    : continue de naviguer jour par jour (+/- 1 jour)
  const handleNavPrev = () => {
    if (scheduleViewMode === "week") {
      handlePrevWeek();
    } else {
      handlePrevDay();
    }
  };

  const handleNavNext = () => {
    if (scheduleViewMode === "week") {
      handleNextWeek();
    } else {
      handleNextDay();
    }
  };

  const handleGoToToday = () => {
    setSelectedDateKey(todayKey);
    setWeekStart(getMonday(today));
    loadMonthData(today);
  };

  // État d'expansion des jours en vue semaine
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  const toggleDayExpanded = (dateKey: string) => {
    setExpandedDays((prev) => ({
      ...prev,
      [dateKey]: !prev[dateKey],
    }));
    setSelectedDateKey(dateKey);
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(10);
    }
  };

  const handleSelectDay = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    if (scheduleViewMode === "week") {
      setExpandedDays((prev) => ({
        ...prev,
        [dateKey]: true,
      }));
    }
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(10);
    }
  };

  // 1-Tap set day presence (localement, sans requête immédiate)
  const handleSetDayStatus = (
    dateKey: string,
    status: StatusType,
    period: "all" | "am" | "diner" | "pm" = "all"
  ) => {
    const prevEntry = presencesMap[dateKey]?.[currentUser.id] || {
      am: "NONE",
      diner: "NONE",
      pm: "NONE",
    };

    let newAm = prevEntry.am;
    let newDiner = prevEntry.diner;
    let newPm = prevEntry.pm;

    if (period === "all") {
      if (prevEntry.am === status && prevEntry.diner === status && prevEntry.pm === status) {
        newAm = "NONE";
        newDiner = "NONE";
        newPm = "NONE";
      } else {
        newAm = status;
        newDiner = status;
        newPm = status;
      }
    } else if (period === "am") {
      newAm = prevEntry.am === status ? "NONE" : status;
    } else if (period === "diner") {
      newDiner = prevEntry.diner === status ? "NONE" : status;
    } else if (period === "pm") {
      newPm = prevEntry.pm === status ? "NONE" : status;
    }

    // Mise à jour locale
    setPresencesMap((prev) => ({
      ...prev,
      [dateKey]: {
        ...(prev[dateKey] || {}),
        [currentUser.id]: { am: newAm, diner: newDiner, pm: newPm },
      },
    }));

    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(15);
    }
  };

  // Bascule locale d'un créneau AM / Dîner / PM (sans requête immédiate)
  const handleToggleSlot = (dateKey: string, period: "am" | "diner" | "pm") => {
    const prevEntry = presencesMap[dateKey]?.[currentUser.id] || {
      am: "NONE",
      diner: "NONE",
      pm: "NONE",
    };
    const currentStatus = prevEntry[period] || "NONE";
    const nextIndex = (STATUS_CYCLE.indexOf(currentStatus) + 1) % STATUS_CYCLE.length;
    const nextStatus = STATUS_CYCLE[nextIndex];

    setPresencesMap((prev) => ({
      ...prev,
      [dateKey]: {
        ...(prev[dateKey] || {}),
        [currentUser.id]: {
          ...prevEntry,
          [period]: nextStatus,
        },
      },
    }));

    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(10);
    }
  };

  // Modèles de semaine type (appliqués localement en attente de soumission)
  const handleApplyPreset = (
    presetType: "office_all" | "hybrid_3_2" | "hybrid_2_3" | "remote_all" | "clear_all"
  ) => {
    setShowPresetModal(false);

    const updates: {
      date: string;
      amStatus: StatusType;
      dinerStatus: StatusType;
      pmStatus: StatusType;
    }[] = [];

    // Appliquer sur les 5 jours ouvrés de la semaine
    weekDays.slice(0, 5).forEach((day, index) => {
      let st: StatusType = "NONE";
      if (presetType === "office_all") {
        st = "OFFICE";
      } else if (presetType === "remote_all") {
        st = "REMOTE";
      } else if (presetType === "hybrid_3_2") {
        st = index < 3 ? "OFFICE" : "REMOTE";
      } else if (presetType === "hybrid_2_3") {
        st = index === 1 || index === 3 ? "OFFICE" : "REMOTE";
      } else if (presetType === "clear_all") {
        st = "NONE";
      }

      updates.push({
        date: day.dateKey,
        amStatus: st,
        dinerStatus: st,
        pmStatus: st,
      });
    });

    setPresencesMap((prev) => {
      const copy = { ...prev };
      for (const u of updates) {
        if (!copy[u.date]) copy[u.date] = {};
        copy[u.date][currentUser.id] = {
          am: u.amStatus,
          diner: u.dinerStatus,
          pm: u.pmStatus,
        };
      }
      return copy;
    });

    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(20);
    }

    showToast("Modèle appliqué ! Cliquez sur 'Soumettre' en haut pour enregistrer.");
  };

  // Soumission groupée de l'horaire sélectionné en une seule requête
  const handleSubmitSchedule = async () => {
    if (pendingDates.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    const entries = pendingDates.map((dateKey) => {
      const uDay = presencesMap[dateKey]?.[currentUser.id] || {
        am: "NONE" as StatusType,
        diner: "NONE" as StatusType,
        pm: "NONE" as StatusType,
      };
      return {
        date: dateKey,
        amStatus: uDay.am,
        dinerStatus: uDay.diner,
        pmStatus: uDay.pm,
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

      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([20, 50, 20]);
      }
      showToast(`Horaire soumis avec succès ! (${entries.length} jour${entries.length > 1 ? "s" : ""})`);
    } catch {
      showToast("Erreur lors de la soumission de l'horaire");
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
    showToast("Modifications annulées");
  };

  // Analyse des présences d'un jour pour l'équipe
  const getDayPresenceBreakdown = useCallback(
    (dateKey: string) => {
      const atOffice: { member: TeamMember; period: PeriodDisplay }[] = [];
      const atRemote: { member: TeamMember; period: PeriodDisplay }[] = [];
      const atAbsent: { member: TeamMember; period: PeriodDisplay }[] = [];
      const notSet: TeamMember[] = [];

      const getStatusPeriod = (
        am: StatusType,
        diner: StatusType,
        pm: StatusType,
        target: StatusType
      ): PeriodDisplay | null => {
        const hasAm = am === target;
        const hasDiner = diner === target;
        const hasPm = pm === target;
        if (hasAm && hasDiner && hasPm) return "all";
        if (hasAm && hasDiner && !hasPm) return "am+diner";
        if (!hasAm && hasDiner && hasPm) return "diner+pm";
        if (hasAm && !hasDiner && hasPm) return "am+pm";
        if (hasAm) return "am";
        if (hasDiner) return "diner";
        if (hasPm) return "pm";
        return null;
      };

      for (const m of teamMembers) {
        const entry = presencesMap[dateKey]?.[m.id];
        const am = entry?.am || "NONE";
        const diner = entry?.diner || "NONE";
        const pm = entry?.pm || "NONE";

        if (am === "NONE" && diner === "NONE" && pm === "NONE") {
          notSet.push(m);
          continue;
        }

        const officePeriod = getStatusPeriod(am, diner, pm, "OFFICE");
        if (officePeriod) atOffice.push({ member: m, period: officePeriod });

        const remotePeriod = getStatusPeriod(am, diner, pm, "REMOTE");
        if (remotePeriod) atRemote.push({ member: m, period: remotePeriod });

        const absentPeriod = getStatusPeriod(am, diner, pm, "ABSENT");
        if (absentPeriod) atAbsent.push({ member: m, period: absentPeriod });
      }

      return { atOffice, atRemote, atAbsent, notSet };
    },
    [teamMembers, presencesMap]
  );

  // Données du jour sélectionné
  const selectedDayBreakdown = useMemo(
    () => getDayPresenceBreakdown(selectedDateKey),
    [selectedDateKey, getDayPresenceBreakdown]
  );

  const selectedUserDay = presencesMap[selectedDateKey]?.[currentUser.id] || {
    am: "NONE",
    diner: "NONE",
    pm: "NONE",
  };

  const isFullOffice =
    selectedUserDay.am === "OFFICE" &&
    selectedUserDay.diner === "OFFICE" &&
    selectedUserDay.pm === "OFFICE";
  const isFullRemote =
    selectedUserDay.am === "REMOTE" &&
    selectedUserDay.diner === "REMOTE" &&
    selectedUserDay.pm === "REMOTE";
  const isFullAbsent =
    selectedUserDay.am === "ABSENT" &&
    selectedUserDay.diner === "ABSENT" &&
    selectedUserDay.pm === "ABSENT";
  const isMixed =
    !isFullOffice &&
    !isFullRemote &&
    !isFullAbsent &&
    (selectedUserDay.am !== "NONE" ||
      selectedUserDay.diner !== "NONE" ||
      selectedUserDay.pm !== "NONE");

  // Filtre d'équipe pour l'onglet Équipe
  const filteredTeamBreakdown = useMemo(() => {
    const raw = getDayPresenceBreakdown(selectedDateKey);
    if (!teamSearchQuery.trim()) return raw;

    const q = teamSearchQuery.toLowerCase();
    const filterFn = (item: { member: TeamMember }) =>
      `${item.member.firstName} ${item.member.lastName}`.toLowerCase().includes(q);

    return {
      atOffice: raw.atOffice.filter(filterFn),
      atRemote: raw.atRemote.filter(filterFn),
      atAbsent: raw.atAbsent.filter(filterFn),
      notSet: raw.notSet.filter((m) =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(q)
      ),
    };
  }, [selectedDateKey, teamSearchQuery, getDayPresenceBreakdown]);

  return (
    <div className="w-full max-w-md mx-auto pb-24 text-[var(--text)]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900/95 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-xl backdrop-blur-sm flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top App Bar */}
      <div className="sticky top-0 z-30 bg-[var(--card-bg)]/95 backdrop-blur-md border-b border-[var(--border)] shadow-xs">
        <div className="px-3.5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-xs shrink-0">
              PB
            </div>
            <div className="min-w-0">
              <h1 className="text-xs font-bold truncate leading-tight text-gray-900">
                {currentUser.firstName} {currentUser.lastName}
              </h1>
              <p className="text-[11px] text-[var(--muted)] flex items-center gap-1 truncate">
                <Users className="w-3 h-3 text-blue-600 shrink-0" />
                <span className="truncate">
                  {allTeams?.find((t) => t.id === selectedTeamId)?.name || "Équipe"}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {pendingDates.length > 0 && (
              <button
                type="button"
                onClick={handleSubmitSchedule}
                disabled={isSubmitting}
                data-testid="header-submit-schedule-btn"
                className="px-2.5 py-1 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs flex items-center gap-1 active-press transition disabled:opacity-50"
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

            <span
              data-testid="live-indicator"
              className="flex items-center gap-1 text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0 select-none"
              title="Mises à jour automatiques en direct actives"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden xs:inline">Direct</span>
            </span>

            <button
              onClick={() => {
                loadMonthData(new Date(selectedDateKey + "T12:00:00"));
                showToast("Données actualisées");
              }}
              disabled={isPending}
              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-lg active-press transition disabled:opacity-50"
              title="Actualiser les présences de l'équipe"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin text-blue-600" : ""}`} />
            </button>

            {onSwitchToDesktop && (
              <button
                onClick={onSwitchToDesktop}
                className="px-2.5 py-1 text-xs text-gray-600 hover:text-gray-900 bg-gray-100 rounded-lg flex items-center gap-1 active-press"
                title="Basculer vers la vue grille bureau"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span className="text-[11px] font-medium hidden xs:inline">Grille</span>
              </button>
            )}

            <button
              onClick={() => setShowPwaInstallModal(true)}
              className="px-2.5 py-1 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-1 active-press"
              title="Installer l'application sur votre écran d'accueil"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="text-[11px] font-bold hidden xs:inline">App</span>
            </button>
          </div>
        </div>

        {/* Bouton / Bannière 'Soumettre' en haut de la page après sélection d'horaire */}
        {pendingDates.length > 0 && (
          <div
            data-testid="pending-schedule-banner"
            className="bg-emerald-600 text-white px-3.5 py-2 border-t border-emerald-500/40 flex items-center justify-between shadow-sm animate-in slide-in-from-top-2 duration-150"
          >
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span>
                {pendingDates.length} jour{pendingDates.length > 1 ? "s" : ""} sélectionné{pendingDates.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelChanges}
                disabled={isSubmitting}
                data-testid="cancel-schedule-btn"
                className="px-2.5 py-1 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-emerald-100 rounded-lg active-press transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSubmitSchedule}
                disabled={isSubmitting}
                data-testid="submit-schedule-btn"
                className="px-3.5 py-1 text-xs font-black bg-white text-emerald-700 hover:bg-emerald-50 rounded-lg shadow-xs flex items-center gap-1.5 active-press transition disabled:opacity-50"
              >
                {isSubmitting ? (
                  <RotateCw className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                )}
                <span>Soumettre l&apos;horaire</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* SECTION DU HAUT : CONTRÔLES SEMAINE & JOURS SCROLLABLES       */}
      {/* ============================================================== */}
      <div className="bg-[var(--card-bg)] border-b border-[var(--border)] px-3 py-2.5 shadow-xs sticky top-[53px] z-20">
        {/* LIGNE 1 : CONTRÔLE DE SEMAINE */}
        <div className="flex items-center justify-between gap-1 mb-2">
          <button
            onClick={handlePrevWeek}
            data-testid="week-prev-btn"
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg active-press transition"
            title="Semaine précédente"
            aria-label="Semaine précédente"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="text-center min-w-0">
            <span className="text-[11px] uppercase tracking-wider font-bold text-blue-600 block leading-tight">
              Semaine
            </span>
            <span className="text-xs font-bold text-gray-800 truncate block capitalize">
              {weekLabel}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleGoToToday}
              className="px-2 py-1 text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg active-press transition"
              title="Aller à aujourd'hui"
            >
              Auj.
            </button>
            <button
              onClick={handleNextWeek}
              data-testid="week-next-btn"
              className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg active-press transition"
              title="Semaine suivante"
              aria-label="Semaine suivante"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* LIGNE 2 : BANDEAU HORIZONTAL DE JOURS SCROLLABLE */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleNavPrev}
            data-testid="nav-prev-btn"
            className="p-1 text-gray-400 hover:text-gray-700 active-press shrink-0"
            title={scheduleViewMode === "week" ? "Semaine précédente" : "Jour précédent"}
            aria-label={scheduleViewMode === "week" ? "Semaine précédente" : "Jour précédent"}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div
            ref={daysScrollRef}
            className="flex-1 flex gap-1.5 overflow-x-auto py-1 px-0.5 scrollbar-none snap-x"
          >
            {weekDays.map((day) => {
              const uDay = presencesMap[day.dateKey]?.[currentUser.id] || {
                am: "NONE",
                diner: "NONE",
                pm: "NONE",
              };
              const b = getDayPresenceBreakdown(day.dateKey);
              const hasOffice =
                uDay.am === "OFFICE" || uDay.diner === "OFFICE" || uDay.pm === "OFFICE";
              const hasRemote =
                !hasOffice &&
                (uDay.am === "REMOTE" || uDay.diner === "REMOTE" || uDay.pm === "REMOTE");
              const hasAbsent =
                !hasOffice &&
                !hasRemote &&
                (uDay.am === "ABSENT" || uDay.diner === "ABSENT" || uDay.pm === "ABSENT");

              const isDayPending = pendingDates.includes(day.dateKey);

              return (
                <button
                  key={day.dateKey}
                  data-selected={day.isSelected}
                  onClick={() => handleSelectDay(day.dateKey)}
                  className={`flex-1 min-w-[42px] max-w-[56px] py-1.5 px-0.5 rounded-xl flex flex-col items-center justify-between text-center transition active-press snap-center border relative ${
                    day.isSelected
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/30 scale-102"
                      : isDayPending
                      ? "bg-amber-50 text-amber-900 border-amber-300 ring-1 ring-amber-300/40"
                      : day.isToday
                      ? "bg-blue-50/70 text-blue-900 border-blue-300"
                      : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {isDayPending && !day.isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 absolute top-1 right-1" title="Modifié, non soumis" />
                  )}
                  <span
                    className={`text-[9px] font-bold leading-none ${
                      day.isSelected ? "text-blue-100" : isDayPending ? "text-amber-800" : "text-gray-500"
                    }`}
                  >
                    {day.dayName}
                  </span>

                  <span className="text-xs font-black my-0.5 leading-none">{day.dayNumber}</span>

                  {/* Pastille de présence personnelle */}
                  <div className="flex items-center justify-center gap-0.5 my-0.5">
                    {hasOffice ? (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          day.isSelected ? "bg-white" : "bg-emerald-500"
                        }`}
                        title="Bureau"
                      />
                    ) : hasRemote ? (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          day.isSelected ? "bg-white" : "bg-indigo-500"
                        }`}
                        title="Télétravail"
                      />
                    ) : hasAbsent ? (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          day.isSelected ? "bg-white" : "bg-rose-500"
                        }`}
                        title="Absent"
                      />
                    ) : (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          day.isSelected ? "bg-blue-400" : "bg-gray-300"
                        }`}
                      />
                    )}
                  </div>

                  {/* Indicateur collègues au bureau */}
                  <span
                    className={`text-[8.5px] font-semibold leading-none ${
                      day.isSelected ? "text-blue-100" : "text-gray-500"
                    }`}
                  >
                    {b.atOffice.length > 0 ? `🏢${b.atOffice.length}` : "—"}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleNavNext}
            data-testid="nav-next-btn"
            className="p-1 text-gray-400 hover:text-gray-700 active-press shrink-0"
            title={scheduleViewMode === "week" ? "Semaine suivante" : "Jour suivant"}
            aria-label={scheduleViewMode === "week" ? "Semaine suivante" : "Jour suivant"}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* LIGNE 3 : SOUS-NAVIGATION (JOUR SÉLECTIONNÉ vs SEMAINE COMPLÈTE) */}
        {activeTab === "schedule" && (
          <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-gray-100 text-xs">
            <div className="flex bg-gray-100 p-0.5 rounded-xl border border-gray-200">
              <button
                onClick={() => setScheduleViewMode("day")}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition ${
                  scheduleViewMode === "day"
                    ? "bg-white text-gray-900 shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Vue Jour
              </button>
              <button
                onClick={() => setScheduleViewMode("week")}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition ${
                  scheduleViewMode === "week"
                    ? "bg-white text-gray-900 shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Vue Semaine (5j)
              </button>
            </div>

            <button
              onClick={() => setShowPresetModal(true)}
              className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-1 active-press transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Semaine type</span>
            </button>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* CONTENU PRINCIPAL PAR ONGLET                                   */}
      {/* ============================================================== */}

      {/* ONGLET 1: PLANNING (RÉSERVATION & JOUR PAR JOUR) */}
      {activeTab === "schedule" && (
        <div className="p-3.5 space-y-3">
          {scheduleViewMode === "day" ? (
            /* --- VUE FOCUS SUR LE JOUR SÉLECTIONNÉ (ULTRA COMPACTE & EFFICACE) --- */
            <div className="space-y-3">
              {/* Carte du jour sélectionné */}
              <div className="bg-[var(--card-bg)] rounded-2xl p-4 border border-[var(--border)] shadow-xs space-y-3.5">
                {/* En-tête du jour */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900 capitalize flex items-center gap-1.5">
                      <CalendarDays className="w-4 h-4 text-blue-600" />
                      {new Intl.DateTimeFormat("fr-FR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      }).format(new Date(selectedDateKey + "T12:00:00"))}
                    </h2>
                    <p className="text-[11px] text-gray-500">
                      {selectedDateKey === todayKey ? (
                        <span className="text-blue-600 font-bold mr-1">● Aujourd&apos;hui</span>
                      ) : null}
                      {selectedDayBreakdown.atOffice.length > 0 ? (
                        <span className="text-emerald-700 font-medium">
                          🏢 {selectedDayBreakdown.atOffice.length} collègues au bureau
                        </span>
                      ) : (
                        <span>Aucun collègue au bureau pour le moment</span>
                      )}
                    </p>
                  </div>

                  {/* Badge statut actuel */}
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {pendingDates.includes(selectedDateKey) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Non soumis
                      </span>
                    )}
                    {isFullOffice ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        🏢 Bureau
                      </span>
                    ) : isFullRemote ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
                        🏠 Télétravail
                      </span>
                    ) : isFullAbsent ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                        🌴 Absent
                      </span>
                    ) : isMixed ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        AM: {STATUS_CONFIG[selectedUserDay.am].shortLabel} | Dîner:{" "}
                        {STATUS_CONFIG[selectedUserDay.diner].shortLabel} | PM:{" "}
                        {STATUS_CONFIG[selectedUserDay.pm].shortLabel}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                        Non renseigné
                      </span>
                    )}
                  </div>
                </div>

                {/* Boutons d'action 1-Clic Journée complète */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    Réserver la journée complète
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      data-testid="btn-action-office"
                      onClick={() => handleSetDayStatus(selectedDateKey, "OFFICE", "all")}
                      className={`py-2.5 px-1 rounded-xl text-center text-xs font-bold border transition active-press flex flex-col items-center justify-center gap-1 ${
                        isFullOffice
                          ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                          : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                      <span>Bureau</span>
                    </button>

                    <button
                      type="button"
                      data-testid="btn-action-remote"
                      onClick={() => handleSetDayStatus(selectedDateKey, "REMOTE", "all")}
                      className={`py-2.5 px-1 rounded-xl text-center text-xs font-bold border transition active-press flex flex-col items-center justify-center gap-1 ${
                        isFullRemote
                          ? "bg-indigo-600 text-white border-indigo-700 shadow-xs"
                          : "bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100"
                      }`}
                    >
                      <Home className="w-4 h-4" />
                      <span>Télétravail</span>
                    </button>

                    <button
                      type="button"
                      data-testid="btn-action-absent"
                      onClick={() => handleSetDayStatus(selectedDateKey, "ABSENT", "all")}
                      className={`py-2.5 px-1 rounded-xl text-center text-xs font-bold border transition active-press flex flex-col items-center justify-center gap-1 ${
                        isFullAbsent
                          ? "bg-rose-600 text-white border-rose-700 shadow-xs"
                          : "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100"
                      }`}
                    >
                      <Palmtree className="w-4 h-4" />
                      <span>Absent</span>
                    </button>

                    <button
                      type="button"
                      data-testid="btn-action-clear"
                      onClick={() => handleSetDayStatus(selectedDateKey, "NONE", "all")}
                      className="py-2.5 px-1 rounded-xl text-center text-xs font-semibold text-gray-500 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition active-press flex flex-col items-center justify-center gap-1"
                      title="Effacer la journée"
                    >
                      <X className="w-4 h-4" />
                      <span>Effacer</span>
                    </button>
                  </div>
                </div>

                {/* Réglage Plages Horaires (AM / Dîner / PM) */}
                <div className="pt-2 border-t border-dashed border-gray-200 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
                  <span className="font-semibold text-gray-500 flex items-center gap-1 text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    Plages horaires :
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleSlot(selectedDateKey, "am")}
                      className={`px-2 py-1 rounded-lg border text-[11px] font-bold transition active-press ${
                        STATUS_CONFIG[selectedUserDay.am].border
                      } ${STATUS_CONFIG[selectedUserDay.am].bg} ${
                        STATUS_CONFIG[selectedUserDay.am].text
                      }`}
                    >
                      AM : {STATUS_CONFIG[selectedUserDay.am].shortLabel}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleSlot(selectedDateKey, "diner")}
                      className={`px-2 py-1 rounded-lg border text-[11px] font-bold transition active-press ${
                        STATUS_CONFIG[selectedUserDay.diner].border
                      } ${STATUS_CONFIG[selectedUserDay.diner].bg} ${
                        STATUS_CONFIG[selectedUserDay.diner].text
                      }`}
                    >
                      Dîner : {STATUS_CONFIG[selectedUserDay.diner].shortLabel}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleSlot(selectedDateKey, "pm")}
                      className={`px-2 py-1 rounded-lg border text-[11px] font-bold transition active-press ${
                        STATUS_CONFIG[selectedUserDay.pm].border
                      } ${STATUS_CONFIG[selectedUserDay.pm].bg} ${
                        STATUS_CONFIG[selectedUserDay.pm].text
                      }`}
                    >
                      PM : {STATUS_CONFIG[selectedUserDay.pm].shortLabel}
                    </button>
                  </div>
                </div>
              </div>

              {/* Collègues ce jour (Intégré sous le jour sélectionné) */}
              <div className="bg-[var(--card-bg)] rounded-2xl p-4 border border-[var(--border)] shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    Collègues ce jour ({teamMembers.length})
                  </h3>
                  <button
                    onClick={() => setActiveTab("team")}
                    className="text-[11px] font-bold text-blue-600 hover:underline"
                  >
                    Voir tout
                  </button>
                </div>

                {/* Au Bureau */}
                <div>
                  <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1 mb-1.5">
                    <Building2 className="w-3 h-3 text-emerald-600" />
                    Au Bureau ({selectedDayBreakdown.atOffice.length})
                  </span>
                  {selectedDayBreakdown.atOffice.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedDayBreakdown.atOffice.map(({ member, period }) => (
                        <span
                          key={member.id}
                          className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl flex items-center gap-1"
                        >
                          <span>{member.firstName} {member.lastName}</span>
                          {period !== "all" && (
                            <span className="text-[9.5px] font-bold opacity-75">
                              ({formatPeriodShort(period)})
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">
                      Aucun collègue n&apos;a encore réservé au bureau.
                    </p>
                  )}
                </div>

                {/* En Télétravail */}
                {selectedDayBreakdown.atRemote.length > 0 && (
                  <div className="pt-2 border-t border-gray-100">
                    <span className="text-[11px] font-bold text-indigo-800 flex items-center gap-1 mb-1.5">
                      <Home className="w-3 h-3 text-indigo-600" />
                      En Télétravail ({selectedDayBreakdown.atRemote.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedDayBreakdown.atRemote.map(({ member }) => (
                        <span
                          key={member.id}
                          className="px-2.5 py-0.5 text-xs font-medium bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-xl"
                        >
                          {member.firstName} {member.lastName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* --- VUE SEMAINE COMPLÈTE (LISTE COMPACTE 5 JOURS AVEC EXPANSION) --- */
            <div className="space-y-2">
              {weekDays.slice(0, 5).map((day) => {
                const uDay = presencesMap[day.dateKey]?.[currentUser.id] || {
                  am: "NONE",
                  diner: "NONE",
                  pm: "NONE",
                };
                const fullOff =
                  uDay.am === "OFFICE" && uDay.diner === "OFFICE" && uDay.pm === "OFFICE";
                const fullRem =
                  uDay.am === "REMOTE" && uDay.diner === "REMOTE" && uDay.pm === "REMOTE";
                const fullAbs =
                  uDay.am === "ABSENT" && uDay.diner === "ABSENT" && uDay.pm === "ABSENT";
                const b = getDayPresenceBreakdown(day.dateKey);
                const isExpanded = !!expandedDays[day.dateKey];

                const isDayPending = pendingDates.includes(day.dateKey);

                return (
                  <div
                    key={day.dateKey}
                    data-testid={`week-day-card-${day.dateKey}`}
                    className={`bg-[var(--card-bg)] rounded-xl border transition shadow-xs overflow-hidden ${
                      isDayPending
                        ? "border-amber-400 ring-2 ring-amber-300/40 bg-amber-50/20"
                        : day.isSelected
                        ? "border-blue-500 ring-2 ring-blue-500/20"
                        : "border-[var(--border)]"
                    }`}
                  >
                    {/* Ligne principale cliquable pour déplier/replier */}
                    <div
                      data-testid={`week-day-row-${day.dateKey}`}
                      onClick={() => toggleDayExpanded(day.dateKey)}
                      className="p-2.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-gray-50/70 transition select-none"
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleDayExpanded(day.dateKey);
                        }
                      }}
                    >
                      {/* Gauche : Jour & Compteur collègues */}
                      <div className="text-left min-w-0 flex items-center gap-2 flex-1">
                        <span
                          className={`w-8 h-8 rounded-lg flex flex-col items-center justify-center font-bold text-[10px] shrink-0 ${
                            day.isToday ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          <span className="leading-none text-[8.5px] opacity-80">{day.dayName}</span>
                          <span className="leading-none mt-0.5 text-[11px]">{day.dayNumber}</span>
                        </span>

                        <div className="truncate">
                          <div className="text-xs font-bold text-gray-900 capitalize truncate flex items-center gap-1.5">
                            <span>
                              {new Intl.DateTimeFormat("fr-FR", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                              }).format(day.date)}
                            </span>
                            {isDayPending && (
                              <span className="text-[9px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-1 py-0.2 rounded leading-tight">
                                Modifié
                              </span>
                            )}
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            )}
                          </div>
                          <div className="text-[10.5px] text-gray-500 truncate flex items-center gap-1">
                            {b.atOffice.length > 0 ? (
                              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                🏢 {b.atOffice.length} au bureau
                              </span>
                            ) : (
                              <span className="text-gray-400">0 au bureau</span>
                            )}
                            <span className="text-gray-300">•</span>
                            <span className="text-[10px] text-blue-600 font-medium">
                              {isExpanded ? "Replier" : "Voir qui est là"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Droite : 1-Tap Statuts compacts */}
                      <div
                        className="flex items-center gap-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => handleSetDayStatus(day.dateKey, "OFFICE", "all")}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold border active-press transition ${
                            fullOff
                              ? "bg-emerald-600 text-white border-emerald-700"
                              : "bg-emerald-50 text-emerald-800 border-emerald-200"
                          }`}
                          title="Journée au bureau"
                        >
                          🏢 Bureau
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSetDayStatus(day.dateKey, "REMOTE", "all")}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold border active-press transition ${
                            fullRem
                              ? "bg-indigo-600 text-white border-indigo-700"
                              : "bg-indigo-50 text-indigo-800 border-indigo-200"
                          }`}
                          title="Journée en télétravail"
                        >
                          🏠 TT
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSetDayStatus(day.dateKey, "ABSENT", "all")}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold border active-press transition ${
                            fullAbs
                              ? "bg-rose-600 text-white border-rose-700"
                              : "bg-rose-50 text-rose-800 border-rose-200"
                          }`}
                          title="Absent"
                        >
                          🌴
                        </button>
                      </div>
                    </div>

                    {/* CONTENU DÉPLIÉ (EXPAND) : QUI VA SE TROUVER AU BUREAU CETTE JOURNÉE LÀ */}
                    {isExpanded && (
                      <div
                        data-testid={`expanded-office-list-${day.dateKey}`}
                        className="px-3 pb-3 pt-2 bg-gray-50/80 border-t border-gray-100 animate-in fade-in slide-in-from-top-1 duration-150 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                            Au bureau ({b.atOffice.length})
                          </span>
                        </div>

                        {b.atOffice.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {b.atOffice.map(({ member, period }) => {
                              const isMe = member.id === currentUser.id;
                              return (
                                <div
                                  key={member.id}
                                  className="flex items-center justify-between p-2 rounded-xl bg-white border border-emerald-200 text-xs shadow-2xs"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                                      {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                                    </div>
                                    <span className="font-semibold text-gray-900 truncate">
                                      {member.firstName} {member.lastName}
                                      {isMe && (
                                        <span className="text-[10px] text-emerald-700 font-bold ml-1">
                                          (Vous)
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 shrink-0">
                                    {formatPeriodLong(period)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-xl bg-white/80 border border-dashed border-gray-200 text-center">
                            <p className="text-xs text-gray-500 italic">
                              Aucun collègue n&apos;a encore réservé au bureau pour cette journée.
                            </p>
                          </div>
                        )}

                        {/* Mention discrète des collègues en télétravail */}
                        {b.atRemote.length > 0 && (
                          <div className="pt-1.5 border-t border-gray-200/60 flex items-center gap-1.5 text-[10.5px] text-indigo-700">
                            <Home className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span className="font-medium">
                              En télétravail ({b.atRemote.length}) : {b.atRemote.map((r) => r.member.firstName).join(", ")}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ONGLET 2: MON ÉQUIPE (QUI EST LÀ ?) */}
      {activeTab === "team" && (
        <div className="p-3.5 space-y-3">
          <div className="bg-[var(--card-bg)] p-3.5 rounded-2xl border border-[var(--border)] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                Présences pour le{" "}
                {new Intl.DateTimeFormat("fr-FR", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                }).format(new Date(selectedDateKey + "T12:00:00"))}
              </h2>
              <span className="text-xs font-semibold text-gray-500">
                {teamMembers.length} membres
              </span>
            </div>

            {/* Champ de recherche */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={teamSearchQuery}
                onChange={(e) => setTeamSearchQuery(e.target.value)}
                placeholder="Rechercher un collègue..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Au Bureau */}
          <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-3.5 shadow-xs">
            <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-600" />
                Au Bureau ({filteredTeamBreakdown.atOffice.length})
              </span>
            </h3>

            {filteredTeamBreakdown.atOffice.length > 0 ? (
              <div className="space-y-1.5">
                {filteredTeamBreakdown.atOffice.map(({ member, period }) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-200 text-emerald-800 font-bold text-[10px] flex items-center justify-center">
                        {member.firstName.charAt(0)}
                        {member.lastName.charAt(0)}
                      </div>
                      <span className="font-semibold text-gray-900">
                        {member.firstName} {member.lastName}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-200 text-emerald-900">
                      {formatPeriodShort(period)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic py-1">
                Aucun collègue au bureau ce jour.
              </p>
            )}
          </div>

          {/* En Télétravail */}
          <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-3.5 shadow-xs">
            <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Home className="w-4 h-4 text-indigo-600" />
                En Télétravail ({filteredTeamBreakdown.atRemote.length})
              </span>
            </h3>

            {filteredTeamBreakdown.atRemote.length > 0 ? (
              <div className="space-y-1.5">
                {filteredTeamBreakdown.atRemote.map(({ member, period }) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-200 text-indigo-800 font-bold text-[10px] flex items-center justify-center">
                        {member.firstName.charAt(0)}
                        {member.lastName.charAt(0)}
                      </div>
                      <span className="font-semibold text-gray-900">
                        {member.firstName} {member.lastName}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-200 text-indigo-900">
                      {formatPeriodShort(period)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic py-1">
                Aucun collègue en télétravail ce jour.
              </p>
            )}
          </div>

          {/* Absents */}
          {filteredTeamBreakdown.atAbsent.length > 0 && (
            <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-3.5 shadow-xs">
              <h3 className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Palmtree className="w-4 h-4 text-rose-600" />
                Absents ({filteredTeamBreakdown.atAbsent.length})
              </h3>
              <div className="space-y-1.5">
                {filteredTeamBreakdown.atAbsent.map(({ member }) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-rose-50/70 border border-rose-200 text-xs"
                  >
                    <span className="font-semibold text-gray-900">
                      {member.firstName} {member.lastName}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-200 text-rose-900">
                      Absent
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ONGLET 3: SEMAINE TYPE (PRESETS RAPIDES) */}
      {activeTab === "templates" && (
        <div className="p-3.5 space-y-3">
          <div className="bg-[var(--card-bg)] p-4 rounded-2xl border border-[var(--border)] shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Modèles de Semaine Type</h2>
                <p className="text-[11px] text-gray-500">
                  Appliquez votre planning de la semaine en 1 clic
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => handleApplyPreset("office_all")}
                className="w-full p-3 text-left rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 transition active-press flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-emerald-700" />
                    <span>Toute la semaine au bureau</span>
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">
                    Du Lundi au Vendredi (5 jours Bureau)
                  </div>
                </div>
                <Check className="w-4 h-4 text-emerald-600" />
              </button>

              <button
                onClick={() => handleApplyPreset("hybrid_3_2")}
                className="w-full p-3 text-left rounded-2xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 transition active-press flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <ArrowRightLeft className="w-4 h-4 text-blue-700" />
                    <span>Hybride (3j Bureau / 2j Télétravail)</span>
                  </div>
                  <div className="text-[11px] text-blue-700 mt-0.5">
                    Lun-Mer Bureau, Jeu-Ven Télétravail
                  </div>
                </div>
                <Check className="w-4 h-4 text-blue-600" />
              </button>

              <button
                onClick={() => handleApplyPreset("hybrid_2_3")}
                className="w-full p-3 text-left rounded-2xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 transition active-press flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <ArrowRightLeft className="w-4 h-4 text-indigo-700" />
                    <span>Hybride (2j Bureau / 3j Télétravail)</span>
                  </div>
                  <div className="text-[11px] text-indigo-700 mt-0.5">
                    Mar &amp; Jeu Bureau, Lun-Mer-Ven Télétravail
                  </div>
                </div>
                <Check className="w-4 h-4 text-indigo-600" />
              </button>

              <button
                onClick={() => handleApplyPreset("remote_all")}
                className="w-full p-3 text-left rounded-2xl bg-indigo-50/60 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 transition active-press flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <Home className="w-4 h-4 text-indigo-700" />
                    <span>100% Télétravail</span>
                  </div>
                  <div className="text-[11px] text-indigo-700 mt-0.5">
                    Du Lundi au Vendredi à distance
                  </div>
                </div>
                <Check className="w-4 h-4 text-indigo-600" />
              </button>

              <button
                onClick={() => handleApplyPreset("clear_all")}
                className="w-full p-2.5 text-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold transition active-press"
              >
                Réinitialiser la semaine
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ONGLET 4: OPTIONS & APPLICATION PWA */}
      {activeTab === "options" && (
        <div className="p-3.5 space-y-3">
          {/* Section PWA App Download */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl p-4 shadow-md space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/30">
                <Download className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold leading-tight">Installer l&apos;application</h3>
                <p className="text-xs text-blue-100">
                  Accès direct sans passer par l&apos;App Store
                </p>
              </div>
            </div>

            <p className="text-xs text-blue-50 leading-relaxed">
              Ajoutez l&apos;application sur votre écran d&apos;accueil pour un accès en plein écran
              et une utilisation fluide sans barre de navigateur.
            </p>

            <button
              onClick={() => setShowPwaInstallModal(true)}
              className="w-full py-2.5 bg-white text-blue-700 font-bold text-xs rounded-xl shadow-xs hover:bg-blue-50 active-press transition flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Voir comment installer l&apos;app</span>
            </button>
          </div>

          {/* Admin Team Switcher */}
          {currentUser.role === "ADMIN" && allTeams && allTeams.length > 0 && (
            <div className="bg-[var(--card-bg)] p-3.5 rounded-2xl border border-[var(--border)] shadow-xs space-y-2">
              <h3 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
                Administration : Changer d&apos;équipe
              </h3>
              <select
                value={selectedTeamId || ""}
                onChange={(e) => {
                  setSelectedTeamId(e.target.value);
                  loadMonthData(weekStart, e.target.value);
                  showToast("Équipe changée");
                }}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {allTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Switch Desktop Mode */}
          {onSwitchToDesktop && (
            <div className="bg-[var(--card-bg)] p-3.5 rounded-2xl border border-[var(--border)] shadow-xs flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-gray-900">Affichage Bureau (Grille)</h3>
                <p className="text-[11px] text-gray-500">
                  Afficher la grille mensuelle sur écran large
                </p>
              </div>
              <button
                onClick={onSwitchToDesktop}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold text-xs rounded-xl active-press transition"
              >
                Basculer
              </button>
            </div>
          )}

          {/* Profile & Info */}
          <div className="bg-[var(--card-bg)] p-3.5 rounded-2xl border border-[var(--border)] shadow-xs text-xs text-gray-600 space-y-2">
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-400">Utilisateur</span>
              <span className="font-semibold text-gray-900">
                {currentUser.firstName} {currentUser.lastName}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-400">Email</span>
              <span className="font-semibold text-gray-900">{currentUser.email}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-400">Rôle</span>
              <span className="font-semibold text-gray-900">
                {currentUser.role === "ADMIN" ? "Administrateur" : "Membre"}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-400">Mode d&apos;affichage</span>
              <span className="font-semibold text-blue-600">Hebdomadaire tactile</span>
            </div>
          </div>
        </div>
      )}

      {/* MODALE POPUP : SEMAINE TYPE */}
      {showPresetModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
          <div
            className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-gray-100 animate-in fade-in slide-in-from-bottom-8 duration-200"
            role="dialog"
          >
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Modèles de Semaine</h3>
                  <p className="text-[11px] text-gray-500">
                    Appliquez une semaine type en 1 clic
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPresetModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 my-3">
              <button
                onClick={() => handleApplyPreset("office_all")}
                className="w-full p-3 text-left rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 transition active-press flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-emerald-700" />
                    <span>Toute la semaine au bureau</span>
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">
                    Lundi au Vendredi (5 jours Bureau)
                  </div>
                </div>
                <Check className="w-4 h-4 text-emerald-600" />
              </button>

              <button
                onClick={() => handleApplyPreset("hybrid_3_2")}
                className="w-full p-3 text-left rounded-2xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 transition active-press flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <ArrowRightLeft className="w-4 h-4 text-blue-700" />
                    <span>Hybride (3j Bureau / 2j TT)</span>
                  </div>
                  <div className="text-[11px] text-blue-700 mt-0.5">
                    Lun-Mer Bureau, Jeu-Ven Télétravail
                  </div>
                </div>
                <Check className="w-4 h-4 text-blue-600" />
              </button>

              <button
                onClick={() => handleApplyPreset("hybrid_2_3")}
                className="w-full p-3 text-left rounded-2xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 transition active-press flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <ArrowRightLeft className="w-4 h-4 text-indigo-700" />
                    <span>Hybride (2j Bureau / 3j TT)</span>
                  </div>
                  <div className="text-[11px] text-indigo-700 mt-0.5">
                    Mar &amp; Jeu Bureau, Lun-Mer-Ven Télétravail
                  </div>
                </div>
                <Check className="w-4 h-4 text-indigo-600" />
              </button>

              <button
                onClick={() => handleApplyPreset("remote_all")}
                className="w-full p-3 text-left rounded-2xl bg-indigo-50/60 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 transition active-press flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <Home className="w-4 h-4 text-indigo-700" />
                    <span>100% Télétravail</span>
                  </div>
                  <div className="text-[11px] text-indigo-700 mt-0.5">
                    Lundi au Vendredi à distance
                  </div>
                </div>
                <Check className="w-4 h-4 text-indigo-600" />
              </button>

              <button
                onClick={() => handleApplyPreset("clear_all")}
                className="w-full p-2.5 text-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold transition active-press"
              >
                Réinitialiser la semaine
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PWA Install Modal */}
      <InstallPwaPrompt
        forceOpen={showPwaInstallModal}
        onClose={() => setShowPwaInstallModal(false)}
        showFloatingBanner={false}
      />

      {/* FIXED BOTTOM NAVIGATION BAR */}
      <nav
        aria-label="Navigation mobile"
        className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--card-bg)]/95 backdrop-blur-md border-t border-[var(--border)] shadow-lg pb-safe"
      >
        <div className="max-w-md mx-auto grid grid-cols-4 h-15">
          {/* TAB 1: PLANNING */}
          <button
            onClick={() => handleTabChange("schedule")}
            className={`flex flex-col items-center justify-center gap-0.5 transition ${
              activeTab === "schedule"
                ? "text-blue-600 font-bold"
                : "text-gray-400 hover:text-gray-600 font-medium"
            }`}
          >
            <CalendarIcon className="w-5 h-5" />
            <span className="text-[10px]">Planning</span>
          </button>

          {/* TAB 2: MON ÉQUIPE */}
          <button
            onClick={() => handleTabChange("team")}
            className={`flex flex-col items-center justify-center gap-0.5 transition ${
              activeTab === "team"
                ? "text-blue-600 font-bold"
                : "text-gray-400 hover:text-gray-600 font-medium"
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px]">Équipe</span>
          </button>

          {/* TAB 3: SEMAINE TYPE */}
          <button
            onClick={() => handleTabChange("templates")}
            className={`flex flex-col items-center justify-center gap-0.5 transition ${
              activeTab === "templates"
                ? "text-blue-600 font-bold"
                : "text-gray-400 hover:text-gray-600 font-medium"
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-[10px]">Modèles</span>
          </button>

          {/* TAB 4: OPTIONS & APP */}
          <button
            onClick={() => handleTabChange("options")}
            className={`flex flex-col items-center justify-center gap-0.5 transition ${
              activeTab === "options"
                ? "text-blue-600 font-bold"
                : "text-gray-400 hover:text-gray-600 font-medium"
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[10px]">Options</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
