import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET || "presence_bureau_secret_key_super_secure_12345";
  if (!process.env.AUTH_SECRET && process.env.NODE_ENV === "production") {
    console.warn("⚠️ [AUTH] Variable AUTH_SECRET manquante sur Vercel. Utilisation d'une clé de secours.");
  }
  return new TextEncoder().encode(secret);
}

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "USER" | "ADMIN";
  teamId: string | null;
  teamName?: string;
  emailVerified?: boolean;
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecretKey());

  try {
    const cookieStore = await cookies();
    cookieStore.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 jours
    });
  } catch {
    // Dans un Server Component de rendu (GET), les cookies sont en lecture seule.
    // L'exception est interceptée pour éviter l'erreur de digest Next.js.
  }

  return token;
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  // Vérifier et synchroniser l'existence de l'utilisateur en base de données
  let dbUser = await prisma.user.findUnique({
    where: { id: session.id },
  });

  // Si l'ID en session est orphelin (ex: réinitialisation DB, bascule sqlite/postgres),
  // tenter de resynchroniser automatiquement via l'adresse courriel
  if (!dbUser && session.email) {
    dbUser = await prisma.user.findUnique({
      where: { email: session.email },
    });
  }

  if (!dbUser) {
    redirect("/login");
  }

  if (dbUser.emailVerified === false) {
    redirect(`/verify-email?email=${encodeURIComponent(dbUser.email)}`);
  }

  return {
    ...session,
    id: dbUser.id,
    role: dbUser.role,
    teamId: dbUser.teamId,
    emailVerified: dbUser.emailVerified,
  };
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireAuth();
  if (session.role !== "ADMIN") {
    redirect("/");
  }
  return session;
}

export async function checkAdminSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new Error("Authentification requise.");
  }
  if (session.role !== "ADMIN") {
    throw new Error("Droits administrateur requis.");
  }

  // Vérifier l'existence en base de données
  let dbUser = await prisma.user.findUnique({
    where: { id: session.id },
  });

  // Auto-guérison de session par courriel si l'ID a changé en base
  if (!dbUser && session.email) {
    dbUser = await prisma.user.findUnique({
      where: { email: session.email },
    });
    if (dbUser && dbUser.role === "ADMIN") {
      await createSession({
        id: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        role: dbUser.role,
        teamId: dbUser.teamId,
        teamName: session.teamName,
        emailVerified: dbUser.emailVerified,
      });
      return {
        ...session,
        id: dbUser.id,
      };
    }
  }

  if (!dbUser || dbUser.role !== "ADMIN") {
    await destroySession();
    throw new Error("Session invalide ou utilisateur introuvable en base de données. Veuillez vous reconnecter.");
  }

  return {
    ...session,
    id: dbUser.id,
  };
}

export async function destroySession() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("auth_token");
  } catch {
    // Si appelé dans un contexte en lecture seule (Server Component)
  }
}