import { PrismaClient } from "@prisma/client";

// Nettoyer les guillemets résiduels si collés par erreur dans le dashboard Vercel
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/^["']|["']$/g, "").trim();
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

let dinerColumnChecked = false;
let dinerColumnPromise: Promise<void> | null = null;

/**
 * S'assure que la colonne `dinerStatus` existe dans la table `Presence` en production
 * (PostgreSQL / SQLite) même si `prisma db push` n'a pas encore été exécuté.
 */
export async function ensurePresenceDinerColumn(): Promise<void> {
  if (dinerColumnChecked) return;
  if (dinerColumnPromise) return dinerColumnPromise;

  dinerColumnPromise = (async () => {
    try {
      const dbUrl = process.env.DATABASE_URL || "";
      if (dbUrl.startsWith("postgres:") || dbUrl.startsWith("postgresql:")) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "Presence" ADD COLUMN IF NOT EXISTS "dinerStatus" "PresenceStatus" NOT NULL DEFAULT 'NONE';`
        );
      }
      dinerColumnChecked = true;
    } catch (err) {
      // Ignorer si la colonne existe déjà ou si le type diffère (ex: TEXT)
      try {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "Presence" ADD COLUMN IF NOT EXISTS "dinerStatus" TEXT NOT NULL DEFAULT 'NONE';`
        );
        dinerColumnChecked = true;
      } catch {
        console.warn("[db] Vérification dinerStatus ignorée:", err);
      }
    } finally {
      dinerColumnPromise = null;
    }
  })();

  return dinerColumnPromise;
}