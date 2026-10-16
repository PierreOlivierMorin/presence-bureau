"use client";

import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction, AuthState } from "@/lib/actions/auth";
import Link from "next/link";
import { Shield, CheckCircle2, AlertCircle, ArrowRight, Eye, EyeOff } from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const isVerified = searchParams.get("verified") === "true";
  const isReset = searchParams.get("reset") === "success";
  const [showPassword, setShowPassword] = useState(false);

  const [state, formAction, isPending] = useActionState<AuthState | null, FormData>(
    loginAction,
    null
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg)]">
      <div className="w-full max-w-md bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-sm p-8">
        <div className="mb-6 text-center">
          <div className="w-12 h-12 bg-blue-50 text-[var(--primary)] rounded-full flex items-center justify-center mx-auto mb-3">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Connexion</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Planification sécurisée des présences au bureau
          </p>
        </div>

        {isVerified && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Votre adresse courriel a été validée avec succès ! Connectez-vous ci-dessous.</span>
          </div>
        )}

        {isReset && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Votre mot de passe a été modifié avec succès.</span>
          </div>
        )}

        {state?.error && (
          <div className="mb-4 p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p>{state.error}</p>
                {state.unverifiedEmail && (
                  <Link
                    href={`/verify-email?email=${encodeURIComponent(state.unverifiedEmail)}`}
                    className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-red-800 underline hover:text-red-950"
                  >
                    <span>Valider mon courriel maintenant</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        <form action={formAction} className="space-y-4">
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
              placeholder="nom@bureau.com"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[var(--text)]"
              >
                Mot de passe
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-[var(--primary)] hover:underline"
              >
                Mot de passe oublié ?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
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
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-2.5 px-4 bg-[var(--primary)] text-white font-medium rounded-lg hover:opacity-95 transition disabled:opacity-50 text-sm shadow-sm"
          >
            {isPending ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-[var(--muted)]">
          Pas encore de compte ?{" "}
          <Link
            href="/register"
            className="text-[var(--primary)] font-medium hover:underline"
          >
            S&apos;inscrire avec une invitation
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg)] text-sm text-[var(--muted)]">
          Chargement...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}