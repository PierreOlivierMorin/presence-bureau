export type StatusType = "NONE" | "OFFICE" | "REMOTE" | "ABSENT";

export interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
}

export type PeriodDisplay = "all" | "am" | "diner" | "pm" | "am+diner" | "diner+pm" | "am+pm";

export interface DayPresenceItem {
  member: TeamMember;
  period: PeriodDisplay;
}

export interface DayPresenceBreakdown {
  atOffice: DayPresenceItem[];
  atRemote: DayPresenceItem[];
  atAbsent: DayPresenceItem[];
  notSet: TeamMember[];
}

export interface WeekDayInfo {
  date: Date;
  dateKey: string;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
  isSelected: boolean;
}

/** Formate une date en format 'YYYY-MM-DD' */
export function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Trouve le lundi de la semaine d'une date donnée */
export function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(date.setDate(diff));
  mon.setHours(0, 0, 0, 0);
  return mon;
}

/**
 * Navigation temporelle selon le mode d'affichage :
 * - Mode 'week' : navigation de semaine en semaine (+/- 7 jours)
 * - Mode 'day'  : navigation de jour en jour (+/- 1 jour)
 */
export function navigateDate({
  currentDateKey,
  currentWeekStart,
  mode,
  direction,
}: {
  currentDateKey: string;
  currentWeekStart: Date;
  mode: "day" | "week";
  direction: "prev" | "next";
}): {
  newDateKey: string;
  newWeekStart: Date;
} {
  const multiplier = direction === "next" ? 1 : -1;

  if (mode === "week") {
    // Navigation par semaine : sauter exactement 7 jours
    const nextMon = new Date(currentWeekStart);
    nextMon.setDate(nextMon.getDate() + 7 * multiplier);

    const selD = new Date(currentDateKey + "T12:00:00");
    selD.setDate(selD.getDate() + 7 * multiplier);

    return {
      newDateKey: formatDateKey(selD),
      newWeekStart: nextMon,
    };
  } else {
    // Navigation par jour : sauter exactement 1 jour
    const d = new Date(currentDateKey + "T12:00:00");
    d.setDate(d.getDate() + 1 * multiplier);
    const newKey = formatDateKey(d);
    const newMon = getMonday(d);

    return {
      newDateKey: newKey,
      newWeekStart: newMon,
    };
  }
}

/** Calcule les 7 jours de la semaine à partir de weekStart */
export function getWeekDays(
  weekStart: Date,
  todayKey: string,
  selectedDateKey: string
): WeekDayInfo[] {
  const days: WeekDayInfo[] = [];
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
}

function getStatusPeriod(
  am: StatusType,
  diner: StatusType,
  pm: StatusType,
  target: StatusType
): PeriodDisplay | null {
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
}

/** Calcule la répartition des présences pour une date donnée */
export function getDayPresenceBreakdown(
  teamMembers: TeamMember[],
  presencesMap: Record<string, Record<string, { am: StatusType; diner?: StatusType; pm: StatusType }>>,
  dateKey: string
): DayPresenceBreakdown {
  const atOffice: DayPresenceItem[] = [];
  const atRemote: DayPresenceItem[] = [];
  const atAbsent: DayPresenceItem[] = [];
  const notSet: TeamMember[] = [];

  for (const m of teamMembers) {
    const entry = presencesMap[dateKey]?.[m.id];
    const am = entry?.am || "NONE";
    const pm = entry?.pm || "NONE";
    const diner = entry?.diner !== undefined ? entry.diner : am === pm ? am : "NONE";

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
}

/** Gestionnaire d'état pour le toggle de row déployé */
export function toggleRowExpansion(
  currentExpanded: Record<string, boolean>,
  dateKey: string
): Record<string, boolean> {
  return {
    ...currentExpanded,
    [dateKey]: !currentExpanded[dateKey],
  };
}
