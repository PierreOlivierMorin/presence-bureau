import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await req.json();
    const { endpoint, keys } = body.subscription || {};

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: "Données de souscription invalides" }, { status: 400 });
    }

    // Upsert la souscription pour éviter les doublons d'endpoint
    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        userId: session.id,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      create: {
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userId: session.id,
      },
    });

    return NextResponse.json({ success: true, id: subscription.id });
  } catch (error) {
    console.error("[API Push Subscribe] Erreur:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement de l'abonnement push" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await req.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint requis" }, { status: 400 });
    }

    await prisma.pushSubscription.deleteMany({
      where: {
        endpoint,
        userId: session.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API Push Unsubscribe] Erreur:", error);
    return NextResponse.json(
      { error: "Erreur lors de la désinscription push" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const count = await prisma.pushSubscription.count({
      where: { userId: session.id },
    });

    return NextResponse.json({ isSubscribed: count > 0, count });
  } catch (error) {
    console.error("[API Push Status] Erreur:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du statut" },
      { status: 500 }
    );
  }
}
