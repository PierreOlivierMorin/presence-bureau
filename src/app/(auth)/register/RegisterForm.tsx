"use client";

import { useActionState, useState } from "react";
import { registerAction, AuthState } from "@/lib/actions/auth";
import { getPasswordStrength, validatePassword } from "@/lib/password-policy";
import Link from "next/link";
import { Check, X, Shield, Users, Mail, Crown, Eye, EyeOff } from "lucide-react";

interface RegisterFormProps {
  teams: { id: string; name: string }[];
  invitation?: {
    token: string;
    email: string;
    teamName: string;
    teamId: string;
    role: "USER" | "ADMIN";
    invitedByName: string;
  } | null;
  isFirstUser?: boolean;
}

export default function RegisterForm({
  teams,
  invitation,
  isFirstUser,
}: RegisterFormProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, isPending] = useActionState<AuthState | null, FormData>(
    registerAction,
    null
  );

  const strength = getPasswordStrength(password);
  const validation = validatePassword(password);

  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg)]">
      <div className="w-full max-w-md bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-sm p-8">
        <div className="mb-6 text-center">
          <div className="w-12 h-12 bg-blue-50 text-[var(--primary)] rounded-full flex items-center justify-center mx-auto mb-3">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Créer un compte</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            {invitation
              ? "Finalisez votre inscription à l'équipe"
              : isFirstUser
              ? "Initialisation du compte administrateur"
              : "Rejoignez votre équipe sur Présence Bureau"}
          </p>
        </div>

        {/* Message d'invitation */}
        {invitation && (
          <div className="mb-5 p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
            <Users className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-950">Invitation officielle</p>
              <p className="mt-0.5 leading-relaxed">
                <strong>{invitation.invitedByName}</strong> vous a invité(e) à rejoindre l&apos;équipe{" "}
                <span className="font-semibold text-blue-800 bg-blue-100 px-1.5 py-0.5 rounded">
                  {invitation.teamName}
                </span>{" "}
                avec le rôle {invitation.role === "ADMIN" ? "Administrateur" : "Membre"}.
              </p>
            </div>
          </div>
        )}

        {/* Message premier utilisateur */}
        {isFirstUser && (
          <div className="mb-5 p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
            <Crown className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-950">Premier compte du système</p>
              <p className="mt-0.5">
                Ce premier compte bénéficiera automatiquement des privilèges Administrateur.
              </p>
            </div>
          </div>
        )}

        {state?.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          {invitation && (
            <input type="hidden" name="inviteToken" value={invitation.token} />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="firstName"
                className="block text-sm font-medium text-[var(--text)] mb-1"
              >
                Prénom
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
                placeholder="ex. Élisabeth"
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white"
              />
            </div>
            <div>
              <label
                htmlFor="lastName"
                className="block text-sm font-medium text-[var(--text)] mb-1"
              >
                Nom
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                required
                placeholder="ex. Sirois"
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-[var(--text)] mb-1"
            >
              Adresse courriel
            </label>
            {invitation ? (
              <div className="relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={invitation.email}
                  readOnly
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-gray-100 text-gray-700 cursor-not-allowed pr-8 font-medium"
                />
                <Mail className="w-4 h-4 text-gray-400 absolute right-3 top-2.5" />
              </div>
            ) : (
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="nom@bureau.com"
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white"
              />
            )}
            {invitation && (
              <p className="text-[11px] text-[var(--muted)] mt-1">
                L&apos;adresse est verrouillée pour correspondre à votre invitation.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-[var(--text)] mb-1"
            >
              Mot de passe
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 pr-10 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Jauge visuelle de complexité */}
            {password.length > 0 && (
              <div className="mt-2 space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--muted)]">Complexité :</span>
                  <span className="font-semibold text-gray-700">{strength.label}</span>
                </div>
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${strength.color}`}
                    style={{ width: `${strength.percent}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-1 pt-1 text-[11px] text-gray-600">
                  <span className={`flex items-center gap-1 ${hasLength ? "text-emerald-600 font-medium" : ""}`}>
                    {hasLength ? <Check className="w-3 h-3" /> : <X className="w-3 h-3 text-gray-400" />} 8+ caractères
                  </span>
                  <span className={`flex items-center gap-1 ${hasUpper ? "text-emerald-600 font-medium" : ""}`}>
                    {hasUpper ? <Check className="w-3 h-3" /> : <X className="w-3 h-3 text-gray-400" />} 1 majuscule
                  </span>
                  <span className={`flex items-center gap-1 ${hasLower ? "text-emerald-600 font-medium" : ""}`}>
                    {hasLower ? <Check className="w-3 h-3" /> : <X className="w-3 h-3 text-gray-400" />} 1 minuscule
                  </span>
                  <span className={`flex items-center gap-1 ${hasNumber ? "text-emerald-600 font-medium" : ""}`}>
                    {hasNumber ? <Check className="w-3 h-3" /> : <X className="w-3 h-3 text-gray-400" />} 1 chiffre
                  </span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="teamId"
              className="block text-sm font-medium text-[var(--text)] mb-1"
            >
              Équipe rattachée
            </label>
            {invitation ? (
              <div>
                <input type="hidden" name="teamId" value={invitation.teamId} />
                <div className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-gray-100 text-gray-800 font-medium flex items-center justify-between">
                  <span>{invitation.teamName}</span>
                  <span className="text-[11px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-normal">
                    Attribuée par invitation
                  </span>
                </div>
              </div>
            ) : (
              <select
                id="teamId"
                name="teamId"
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white cursor-pointer"
              >
                <option value="">Sélectionnez une équipe...</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            type="submit"
            disabled={isPending || (password.length > 0 && !validation.isValid)}
            className="w-full py-2.5 px-4 bg-[var(--primary)] text-white font-medium rounded-lg hover:opacity-95 transition disabled:opacity-50 text-sm shadow-sm"
          >
            {isPending ? "Création du compte..." : "Créer mon compte"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-[var(--muted)]">
          Déjà un compte ?{" "}
          <Link
            href="/login"
            className="text-[var(--primary)] font-medium hover:underline"
          >
            Se connecter
          </Link>
        </div>
      </div>
    </div>
  );
}