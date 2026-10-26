import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return NextResponse.json({ error: "Clé VAPID publique non configurée" }, { status: 500 });
  }

  return NextResponse.json({ publicKey });
}
