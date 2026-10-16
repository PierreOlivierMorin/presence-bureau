"use server";

import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const CYCLE: Record<string, "NONE" | "OFFICE" | "REMOTE" | "ABSENT"> = {
  NONE: "OFFICE",
  OFFICE: "REMOTE",
  REMOTE: "ABSENT",
  ABSENT: "NONE",
};

export async function togglePresenceAction(date: string, period: "am" | "diner" | "pm") {
  const session = await requireAuth();

  const existing = await prisma.presence.findUnique({
    where: {
      date_userId: {
        date,
        userId: session.id,
      },
    },
  });

  const currentAm = existing?.amStatus || "NONE";
  const currentDiner = existing?.dinerStatus || "NONE";
  const currentPm = existing?.pmStatus || "NONE";

  const nextAm = period === "am" ? CYCLE[currentAm] : currentAm;
  const nextDiner = period === "diner" ? CYCLE[currentDiner] : currentDiner;
  const nextPm = period === "pm" ? CYCLE[currentPm] : currentPm;

  if (nextAm === "NONE" && nextDiner === "NONE" && nextPm === "NONE") {
    if (existing) {
      await prisma.presence.delete({
        where: { id: existing.id },
      });
    }
    revalidatePath("/");
    return {
      date,
      userId: session.id,
      amStatus: "NONE",
      dinerStatus: "NONE",
      pmStatus: "NONE",
    };
  }

  const updated = await prisma.presence.upsert({
    where: {
      date_userId: {
        date,
        userId: session.id,
      },
    },
    update: {
      amStatus: nextAm,
      dinerStatus: nextDiner,
      pmStatus: nextPm,
    },
    create: {
      date,
      userId: session.id,
      amStatus: nextAm,
      dinerStatus: nextDiner,
      pmStatus: nextPm,
    },
  });

  revalidatePath("/");
  return updated;
}

export async function setDayPresenceAction(
  date: string,
  status: "NONE" | "OFFICE" | "REMOTE" | "ABSENT",
  period: "all" | "am" | "diner" | "pm" = "all"
) {
  const session = await requireAuth();

  const existing = await prisma.presence.findUnique({
    where: {
      date_userId: {
        date,
        userId: session.id,
      },
    },
  });

  const currentAm = existing?.amStatus || "NONE";
  const currentDiner = existing?.dinerStatus || "NONE";
  const currentPm = existing?.pmStatus || "NONE";

  let nextAm = currentAm;
  let nextDiner = currentDiner;
  let nextPm = currentPm;

  if (period === "all") {
    nextAm = status;
    nextDiner = status;
    nextPm = status;
  } else if (period === "am") {
    nextAm = status;
  } else if (period === "diner") {
    nextDiner = status;
  } else if (period === "pm") {
    nextPm = status;
  }

  if (nextAm === "NONE" && nextDiner === "NONE" && nextPm === "NONE") {
    if (existing) {
      await prisma.presence.delete({
        where: { id: existing.id },
      });
    }
    revalidatePath("/");
    return {
      date,
      userId: session.id,
      amStatus: "NONE",
      dinerStatus: "NONE",
      pmStatus: "NONE",
    };
  }

  const updated = await prisma.presence.upsert({
    where: {
      date_userId: {
        date,
        userId: session.id,
      },
    },
    update: {
      amStatus: nextAm,
      dinerStatus: nextDiner,
      pmStatus: nextPm,
    },
    create: {
      date,
      userId: session.id,
      amStatus: nextAm,
      dinerStatus: nextDiner,
      pmStatus: nextPm,
    },
  });

  revalidatePath("/");
  return updated;
}

export async function batchSetPresencesAction(
  entries: {
    date: string;
    amStatus: "NONE" | "OFFICE" | "REMOTE" | "ABSENT";
    dinerStatus?: "NONE" | "OFFICE" | "REMOTE" | "ABSENT";
    pmStatus: "NONE" | "OFFICE" | "REMOTE" | "ABSENT";
  }[]
) {
  const session = await requireAuth();

  for (const entry of entries) {
    const dinerStatus = entry.dinerStatus ?? entry.amStatus;
    if (entry.amStatus === "NONE" && dinerStatus === "NONE" && entry.pmStatus === "NONE") {
      await prisma.presence.deleteMany({
        where: {
          date: entry.date,
          userId: session.id,
        },
      });
    } else {
      await prisma.presence.upsert({
        where: {
          date_userId: {
            date: entry.date,
            userId: session.id,
          },
        },
        update: {
          amStatus: entry.amStatus,
          dinerStatus,
          pmStatus: entry.pmStatus,
        },
        create: {
          date: entry.date,
          userId: session.id,
          amStatus: entry.amStatus,
          dinerStatus,
          pmStatus: entry.pmStatus,
        },
      });
    }
  }

  revalidatePath("/");
  return { success: true };
}

export async function getMonthPresencesAction(year: number, month: number, targetTeamId?: string) {
  const session = await requireAuth();
  const effectiveTeamId = targetTeamId && session.role === "ADMIN" ? targetTeamId : session.teamId;

  if (!effectiveTeamId) {
    return { teamMembers: [], presences: [] };
  }

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const teamMembers = await prisma.user.findMany({
    where: { teamId: effectiveTeamId },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { firstName: "asc" },
  });

  const presences = await prisma.presence.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
      user: {
        teamId: effectiveTeamId,
      },
    },
    select: {
      date: true,
      userId: true,
      amStatus: true,
      dinerStatus: true,
      pmStatus: true,
    },
  });

  return { teamMembers, presences };
}