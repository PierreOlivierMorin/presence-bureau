import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Navbar from "@/components/Navbar";
import AdminPanel from "@/components/Admin/AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  try {
    const session = await requireAdmin();

    const teams = await prisma.team.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: { members: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const users = await prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        emailVerified: true,
        teamId: true,
        createdAt: true,
        team: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ role: "asc" }, { firstName: "asc" }],
    });

    const invitations = await prisma.invitation.findMany({
      select: {
        id: true,
        email: true,
        teamId: true,
        role: true,
        token: true,
        expiresAt: true,
        createdAt: true,
        team: {
          select: { id: true, name: true },
        },
        invitedBy: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const auditLogs = await prisma.auditLog.findMany({
      take: 40,
      select: {
        id: true,
        action: true,
        target: true,
        details: true,
        ipAddress: true,
        createdAt: true,
        actor: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const currentTeam = session.teamId
      ? await prisma.team.findUnique({ where: { id: session.teamId } })
      : null;

    const totalPushSubscriptions = await prisma.pushSubscription.count();
    const uniquePushUsers = (
      await prisma.pushSubscription.groupBy({
        by: ["userId"],
      })
    ).length;

    return (
      <div className="min-h-screen p-4 sm:p-6 lg:p-8 bg-[var(--bg)]">
        <div className="max-w-[1240px] mx-auto">
          <Navbar user={session} activeTeamName={currentTeam?.name} />
          <AdminPanel
            currentUserId={session.id}
            initialTeams={teams}
            initialPushStats={{
              totalSubscriptions: totalPushSubscriptions,
              uniqueUsers: uniquePushUsers,
            }}
            initialUsers={users.map((u) => ({
              ...u,
              createdAt: u.createdAt ? u.createdAt.toISOString() : undefined,
            }))}
            initialInvitations={invitations.map((inv) => ({
              ...inv,
              expiresAt: inv.expiresAt.toISOString(),
              createdAt: inv.createdAt.toISOString(),
            }))}
            initialAuditLogs={auditLogs.map((log) => ({
              ...log,
              createdAt: log.createdAt.toISOString(),
            }))}
          />
        </div>
      </div>
    );
  } catch (error: unknown) {
    // Si c'est une redirection Next.js (lancer par requireAdmin / requireAuth), la propager
    if (
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      typeof (error as { digest: unknown }).digest === "string" &&
      (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }

    console.error("Erreur serveur AdminPage :", error);
    const message = error instanceof Error ? error.message : String(error);

    return (
      <div className="min-h-screen p-4 sm:p-6 lg:p-8 bg-[var(--bg)] flex items-center justify-center">
        <div className="w-full max-w-lg bg-[var(--card-bg)] border border-red-200 rounded-2xl p-6 shadow-sm text-center">
          <h1 className="text-xl font-bold text-red-900 mb-2">Erreur sur la page d&apos;administration</h1>
          <p className="text-sm text-[var(--muted)] mb-4">
            Une erreur est survenue lors de la récupération des données.
          </p>
          <div className="p-3 bg-red-50 text-red-800 rounded-xl font-mono text-xs text-left overflow-auto max-h-40">
            {message}
          </div>
        </div>
      </div>
    );
  }
}