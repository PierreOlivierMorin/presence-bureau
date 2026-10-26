import { requireAuth } from "@/lib/auth";
import { prisma, ensurePresenceDinerColumn } from "@/lib/db";
import Navbar from "@/components/Navbar";
import CalendarView from "@/components/Calendar/CalendarView";
import DailyPushReminder from "@/components/PWA/DailyPushReminder";
import Link from "next/link";
import { Shield, Users, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  try {
    const session = await requireAuth();

    // Si admin, charger toutes les équipes disponibles, sinon l'équipe active
    const allTeams =
      session.role === "ADMIN"
        ? await prisma.team.findMany({
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          })
        : [];

    // Équipe active (soit celle du user, soit la 1ère équipe si l'admin n'en a pas)
    const activeTeamId =
      session.teamId ||
      (session.role === "ADMIN" && allTeams.length > 0 ? allTeams[0].id : null);

    let activeTeam = null;
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
      const endDate = `${year}-${String(month).padStart(2, "0")}-${String(
        lastDay
      ).padStart(2, "0")}`;

      await ensurePresenceDinerColumn();

      try {
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
      } catch {
        const legacyPresences = await prisma.presence.findMany({
          where: {
            date: { gte: startDate, lte: endDate },
            user: { teamId: activeTeamId },
          },
          select: {
            date: true,
            userId: true,
            amStatus: true,
            pmStatus: true,
          },
        });
        initialPresences = legacyPresences.map((p) => ({
          ...p,
          dinerStatus: "NONE",
        }));
      }
    }

    return (
      <div className="min-h-screen p-1.5 sm:p-6 lg:p-8 bg-[var(--bg)]">
        <div className="max-w-[1240px] mx-auto">
          <div className="hidden md:block">
            <Navbar user={session} activeTeamName={activeTeam?.name} />
          </div>

          <DailyPushReminder />

          {!activeTeamId ? (
            <div className="bg-[var(--card-bg)] border border-yellow-200 rounded-2xl p-8 text-center max-w-lg mx-auto shadow-sm mt-8">
              <Users className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-[var(--text)] mb-2">
                Aucune équipe assignée
              </h2>
              <p className="text-sm text-[var(--muted)] mb-6">
                Vous n&apos;êtes actuellement rattaché(e) à aucune équipe. Un
                administrateur doit vous affecter à une équipe pour voir et
                renseigner vos présences.
              </p>
              {session.role === "ADMIN" && (
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition"
                >
                  <Shield className="w-4 h-4" />
                  Créer ou gérer les équipes
                </Link>
              )}
            </div>
          ) : (
            <CalendarView
              currentUser={session}
              initialYear={year}
              initialMonth={month}
              initialMembers={teamMembers}
              initialPresences={initialPresences}
              allTeams={
                allTeams.length > 0
                  ? allTeams
                  : activeTeam
                  ? [{ id: activeTeam.id, name: activeTeam.name }]
                  : []
              }
              activeTeamId={activeTeamId}
            />
          )}
        </div>
      </div>
    );
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      typeof (error as { digest: unknown }).digest === "string" &&
      (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }

    console.error("Erreur serveur HomePage :", error);
    return (
      <div className="min-h-screen p-4 bg-[var(--bg)] flex items-center justify-center">
        <div className="w-full max-w-md bg-[var(--card-bg)] border border-red-200 rounded-2xl p-6 shadow-sm text-center">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-red-900 mb-1">
            Erreur de chargement
          </h2>
          <p className="text-xs text-[var(--muted)] mb-4">
            Impossible de charger le calendrier de présence.
          </p>
          <div className="flex gap-2 justify-center">
            <Link
              href="/login"
              className="px-3.5 py-2 bg-[var(--primary)] text-white rounded-lg text-xs font-semibold"
            >
              Se reconnecter
            </Link>
          </div>
        </div>
      </div>
    );
  }
}