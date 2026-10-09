"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg)]">
      <div className="w-full max-w-md bg-[var(--card-bg)] border border-red-200 rounded-2xl shadow-sm p-8 text-center">
        <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-red-900">Une erreur est survenue</h1>
        <p className="text-sm text-[var(--muted)] mt-2">
          {error?.message || "Une exception inattendue s'est produite lors de l'exécution."}
        </p>
        {error?.digest && (
          <p className="text-xs text-[var(--muted)] font-mono mt-2 bg-gray-100 py-1 px-2 rounded inline-block">
            Code diagnostic : {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:opacity-95 transition"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Réessayer</span>
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 bg-gray-100 text-[var(--text)] text-sm font-medium rounded-lg hover:bg-gray-200 transition"
          >
            <Home className="w-4 h-4" />
            <span>Retour à l&apos;accueil</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
