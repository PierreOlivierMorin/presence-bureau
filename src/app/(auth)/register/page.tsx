import { prisma } from "@/lib/db";
import RegisterForm from "./RegisterForm";
import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

interface RegisterPageProps {
  searchParams: Promise<{ invite?: string }>;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const { invite: inviteToken } = await searchParams;

  let invitation = null;
  if (inviteToken) {
    try {
      invitation = await prisma.invitation.findUnique({
        where: { token: inviteToken },
        include: {
          team: { select: { id: true, name: true } },
          invitedBy: { select: { firstName: true, lastName: true } },
        },
      });

      // Ignorer si expirée
      if (invitation && invitation.expiresAt < new Date()) {
        invitation = null;
      }
    } catch (err) {
      console.error("Erreur lors de la lecture de l'invitation :", err);
    }
  }

  let totalUsers = 0;
  let dbError: string | null = null;
  try {
    totalUsers = await prisma.user.count();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Erreur de connexion à la base de données :", message);
    dbError = message;
  }

  if (dbError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg)]">
        <div className="w-full max-w-lg bg-[var(--card-bg)] border border-red-200 rounded-2xl shadow-sm p-8 text-center">
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-red-900">Base de données non accessible</h1>
          <p className="text-sm text-[var(--muted)] mt-2 leading-relaxed">
            L&apos;application n&apos;a pas pu communiquer avec la base de données ou les tables n&apos;ont pas encore été initialisées.
          </p>
          <div className="mt-4 p-3 bg-red-50/80 rounded-xl text-left text-xs text-red-800 font-mono overflow-auto max-h-32">
            {dbError}
          </div>
          <div className="mt-4 text-xs text-[var(--muted)] text-left space-y-1">
            <p className="font-semibold text-[var(--text)]">Pour résoudre ce problème :</p>
            <p>1. Vérifiez que la variable <code>DATABASE_URL</code> est bien configurée dans les paramètres de votre projet Vercel.</p>
            <p>2. Assurez-vous d&apos;avoir initialisé le schéma sur votre base PostgreSQL en lançant <code>npm run db:push</code>.</p>
          </div>
          <div className="mt-6 pt-4 border-t border-[var(--border)]">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-4 bg-[var(--primary)] text-white font-medium rounded-lg hover:opacity-95 transition text-sm shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour à la page de connexion</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isFirstUser = totalUsers === 0;
  const allowPublic = process.env.ALLOW_PUBLIC_REGISTRATION === "true" || isFirstUser;

  // Si l'inscription publique est désactivée et qu'aucune invitation valide n'est présente
  if (!allowPublic && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg)]">
        <div className="w-full max-w-md bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-sm p-8 text-center">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-[var(--text)]">Inscription sur invitation</h1>
          <p className="text-sm text-[var(--muted)] mt-2 leading-relaxed">
            L&apos;accès à Présence Bureau est strictement réservé aux membres d&apos;équipes autorisées.
            Pour créer votre compte, vous devez recevoir un lien d&apos;invitation de votre administrateur.
          </p>

          <div className="mt-6 pt-4 border-t border-[var(--border)]">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-4 bg-[var(--primary)] text-white font-medium rounded-lg hover:opacity-95 transition text-sm shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour à la page de connexion</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  let teams: { id: string; name: string }[] = [];
  try {
    teams = await prisma.team.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des équipes:", error);
  }

  return (
    <RegisterForm
      teams={teams}
      invitation={
        invitation
          ? {
              token: invitation.token,
              email: invitation.email,
              teamName: invitation.team.name,
              teamId: invitation.teamId,
              role: invitation.role,
              invitedByName: `${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName}`,
            }
          : null
      }
      isFirstUser={isFirstUser}
    />
  );
}