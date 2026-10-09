import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET || "presence_bureau_secret_key_super_secure_12345";
  return new TextEncoder().encode(secret);
}

const PUBLIC_ROUTES = [
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get("auth_token")?.value;
  let user: { id: string; role?: string; emailVerified?: boolean; [key: string]: unknown } | null = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, getSecretKey());
      user = payload as unknown as { id: string; role?: string; emailVerified?: boolean };
    } catch {
      // Ignorer si invalide
    }
  }

  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  // 1. Non authentifié -> redirection login
  if (!user && !isPublicRoute) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 2. Connecté mais courriel non vérifié -> rediriger vers la page de vérification
  if (user && user.emailVerified === false && pathname !== "/verify-email") {
    const url = req.nextUrl.clone();
    url.pathname = "/verify-email";
    return NextResponse.redirect(url);
  }

  // 3. Déjà connecté et courriel vérifié -> redirection accueil si tentative d'accéder aux routes publiques d'authentification
  if (
    user &&
    user.emailVerified !== false &&
    (pathname === "/login" ||
      pathname === "/register" ||
      pathname === "/forgot-password" ||
      pathname === "/reset-password")
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // 4. Zone Admin réservée aux ADMIN
  if (pathname.startsWith("/admin") && user?.role !== "ADMIN") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};