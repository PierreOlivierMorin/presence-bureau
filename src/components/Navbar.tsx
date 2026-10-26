"use client";

import { SessionUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Shield, Calendar, Users } from "lucide-react";
import NotificationSettingsButton from "@/components/PWA/NotificationSettingsButton";

interface NavbarProps {
  user: SessionUser;
  activeTeamName?: string | null;
}

export default function Navbar({ user, activeTeamName }: NavbarProps) {
  const pathname = usePathname();
  const isAdmin = user.role === "ADMIN";
  const isOnAdmin = pathname.startsWith("/admin");

  return (
    <header className="flex flex-wrap justify-between items-center gap-4 mb-5 bg-[var(--card-bg)] p-4 sm:px-6 rounded-xl border border-[var(--border)] shadow-sm">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-[var(--text)]">Planning de Présence</h1>
        {activeTeamName ? (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[var(--primary)] border border-blue-200">
            <Users className="w-3.5 h-3.5" />
            {activeTeamName}
          </span>
        ) : (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200">
            Sans équipe
          </span>
        )}
      </div>

      <div className="flex items-center flex-wrap gap-3">
        <div className="text-sm text-[var(--muted)]">
          Bonjour, <span className="font-semibold text-[var(--text)]">{user.firstName} {user.lastName}</span>
          {isAdmin && (
            <span className="ml-1.5 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
              Admin
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <NotificationSettingsButton />
          {isAdmin && (
            isOnAdmin ? (
              <Link
                href="/"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] hover:bg-gray-50 transition"
              >
                <Calendar className="w-3.5 h-3.5 text-[var(--primary)]" />
                Retour au Calendrier
              </Link>
            ) : (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] hover:bg-gray-50 transition"
              >
                <Shield className="w-3.5 h-3.5 text-amber-600" />
                Administration
              </Link>
            )
          )}

          <form action={logoutAction}>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 rounded-lg border border-red-200 hover:bg-red-50 transition"
              title="Se déconnecter"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Déconnexion</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}