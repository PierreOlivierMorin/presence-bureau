import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import MobileReservationView from "@/components/Calendar/MobileReservationView";
import Link from "next/link";
import { Users, Shield } from "lucide-react";

export default async function MobilePage() {
  const session = await requireAuth();

  const allTeams =
    session.role === "ADMIN"
      ? await prisma.team.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [];

  const activeTeamId =
    session.teamId ||
    (session.role === "ADMIN" && allTeams.length > 0 ? allTeams[0].id : null);

  let teamMembers: { id: string; firstName: string; lastName: string }[] = [];
  let initialPresences: {
    date: string;
    userId: string;
    amStatus: string;
    dinerStatus: string;
    pmStatus: string;
  }[] = [];

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  let activeTeam = null;
  if (activeTeamId) {
    activeTeam = await prisma.team.findUnique({
      where: { id: activeTeamId },
    });

    teamMembers = await prisma.user.findMany({
      where: { teamId: activeTeamId },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { firstName: "asc" },
    });

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    initialPresences = await prisma.presence.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        user: { teamId: activeTeamId },
      },
      select: {
        date: true,
        userId: true,
        amStatus: true,
        dinerStatus: true,
        pmStatus: true,
      },
    });
  }

  if (!activeTeamId) {
    return (
      <div className="min-h-screen p-4 bg-[var(--bg)] flex items-center justify-center">
        <div className="bg-[var(--card-bg)] border border-yellow-200 rounded-2xl p-6 text-center max-w-sm mx-auto shadow-sm">
          <Users className="w-10 h-10 text-yellow-600 mx-auto mb-3" />
          <h2 className="text-base font-bold text-[var(--text)] mb-2">
            Aucune équipe assignée
          </h2>
          <p className="text-xs text-[var(--muted)] mb-5">
            Vous n&apos;êtes rattaché(e) à aucune équipe. Un administrateur doit vous affecter pour voir et réserver vos présences.
          </p>
          {session.role === "ADMIN" && (
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white text-xs font-semibold rounded-xl"
            >
              <Shield className="w-4 h-4" />
              Gérer les équipes
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <MobileReservationView
        currentUser={session}
        initialYear={year}
        initialMonth={month}
        initialMembers={teamMembers}
        initialPresences={initialPresences}
        allTeams={allTeams.length > 0 ? allTeams : (activeTeam ? [{ id: activeTeam.id, name: activeTeam.name }] : [])}
        activeTeamId={activeTeamId}
      />
    </div>
  );
}
