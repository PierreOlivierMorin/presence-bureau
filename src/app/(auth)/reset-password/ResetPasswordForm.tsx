"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { resetPasswordAction, AuthState } from "@/lib/actions/auth";
import { getPasswordStrength, validatePassword } from "@/lib/password-policy";
import Link from "next/link";
import { Lock, KeyRound, Check, X, ShieldCheck, Eye, EyeOff } from "lucide-react";

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") || "";
  const initialToken = searchParams.get("token") || "";

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [state, formAction, isPending] = useActionState<AuthState | null, FormData>(
    resetPasswordAction,
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
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Nouveau mot de passe</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Définissez un mot de passe robuste pour votre compte
          </p>
        </div>

        {state?.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="token" value={initialToken} />

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-[var(--text)] mb-1"
            >
              Adresse courriel
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nom@bureau.com"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white"
            />
          </div>

          {!initialToken && (
            <div>
              <label
                htmlFor="code"
                className="block text-sm font-medium text-[var(--text)] mb-1"
              >
                Code de vérification reçu (6 chiffres)
              </label>
              <div className="relative">
                <input
                  id="code"
                  name="code"
                  type="text"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="w-full px-3 py-2 font-mono tracking-widest text-center text-lg font-bold border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white"
                />
                <KeyRound className="w-4 h-4 text-gray-400 absolute right-3 top-3" />
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-[var(--text)] mb-1"
            >
              Nouveau mot de passe
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

            {/* Jauge visuelle de robustesse */}
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

          <button
            type="submit"
            disabled={isPending || !validation.isValid}
            className="w-full py-2.5 px-4 bg-[var(--primary)] text-white font-medium rounded-lg hover:opacity-95 transition disabled:opacity-50 text-sm shadow-sm flex items-center justify-center gap-1.5"
          >
            {isPending ? (
              "Mise à jour..."
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Enregistrer le nouveau mot de passe</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-[var(--muted)]">
          <Link
            href="/login"
            className="text-[var(--primary)] font-medium hover:underline"
          >
            Retourner à la connexion
          </Link>
        </div>
      </div>
    </div>
  );
}
