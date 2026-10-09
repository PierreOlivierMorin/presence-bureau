/**
 * Script de détection et bascule automatique du provider Prisma (SQLite vs PostgreSQL).
 *
 * Utilisation :
 * - Automatique : node scripts/ensure-db-provider.js
 *   (détecte le protocole dans DATABASE_URL ou le fichier .env)
 * - Explicite   : node scripts/ensure-db-provider.js sqlite
 *                 node scripts/ensure-db-provider.js postgresql
 */

const fs = require("fs");
const path = require("path");

const schemaPath = path.join(__dirname, "..", "prisma", "schema.prisma");
const envPath = path.join(__dirname, "..", ".env");

function getDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL.replace(/^["']|["']$/g, "").trim();
  }

  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("DATABASE_URL=")) {
        return trimmed.replace(/^DATABASE_URL=["']?/, "").replace(/["']?$/, "");
      }
    }
  }

  return "";
}

function main() {
  const explicitArg = process.argv[2]?.toLowerCase();
  let targetProvider = "postgresql"; // Défaut pour la production Vercel

  if (explicitArg === "sqlite") {
    targetProvider = "sqlite";
  } else if (explicitArg === "postgres" || explicitArg === "postgresql") {
    targetProvider = "postgresql";
  } else {
    const dbUrl = getDatabaseUrl();
    if (dbUrl.startsWith("file:") || dbUrl.startsWith("sqlite:")) {
      targetProvider = "sqlite";
    } else if (dbUrl.startsWith("postgres:") || dbUrl.startsWith("postgresql:")) {
      targetProvider = "postgresql";
    }
  }

  if (!fs.existsSync(schemaPath)) {
    console.error(`[prisma-provider] Fichier non trouvé: ${schemaPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(schemaPath, "utf-8");
  const providerRegex = /provider\s*=\s*"(sqlite|postgresql)"/;
  const match = content.match(providerRegex);

  if (match) {
    const currentProvider = match[1];
    if (currentProvider !== targetProvider) {
      const updated = content.replace(providerRegex, `provider = "${targetProvider}"`);
      fs.writeFileSync(schemaPath, updated, "utf-8");
      console.log(`[prisma-provider] Schéma Prisma mis à jour: provider = "${targetProvider}" (était "${currentProvider}")`);
    } else {
      console.log(`[prisma-provider] Schéma Prisma déjà configuré pour "${targetProvider}".`);
    }
  } else {
    console.warn("[prisma-provider] Impossible de détecter la directive provider dans prisma/schema.prisma.");
  }
}

main();
