import { headers } from "next/headers";

/**
 * Résout dynamiquement l'URL de base de l'application :
 * 1. Inspecte les en-têtes HTTP de la requête en cours (Server Action / Route Handler).
 * 2. Vérifie les variables d'environnement explicites (NEXTAUTH_URL, NEXT_PUBLIC_APP_URL, APP_URL).
 * 3. Utilise les variables de déploiement automatiques Vercel (VERCEL_PROJECT_PRODUCTION_URL, VERCEL_URL).
 * 4. Repli garanti sur le domaine de production si en mode production.
 * 5. Repli sur http://localhost:3000 en développement local ou tests.
 */
export async function getAppBaseUrl(): Promise<string> {
  // 1. Tenter d'extraire dynamiquement l'URL de la requête en cours
  try {
    const headerStore = await headers();
    const host =
      headerStore.get("x-forwarded-host") || headerStore.get("host");
    const proto = headerStore.get("x-forwarded-proto") || "https";

    if (host && !host.includes("localhost") && !host.includes("127.0.0.1")) {
      return `${proto}://${host}`.replace(/\/$/, "");
    }
  } catch {
    // Hors contexte de requête HTTP (ex: CLI, scripts, tests)
  }

  // 2. Variables d'environnement explicites
  const explicitUrl =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL;

  if (explicitUrl) {
    const cleanUrl = explicitUrl.replace(/\/$/, "");
    const isLocal =
      cleanUrl.includes("localhost") || cleanUrl.includes("127.0.0.1");
    // En production, ne jamais accepter un localhost accidentel
    if (!isLocal || process.env.NODE_ENV !== "production") {
      return cleanUrl;
    }
  }

  // 3. Variables automatiques injectées par Vercel
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`.replace(
      /\/$/,
      ""
    );
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, "");
  }

  // 4. Repli de sécurité garanti pour la production
  if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
    return "https://presence-bureau.fyi";
  }

  // 5. Environnement local de développement / test
  return "http://localhost:3000";
}
