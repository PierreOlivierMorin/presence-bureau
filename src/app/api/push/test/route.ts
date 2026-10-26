import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sendPushToUser } from "@/lib/push";

export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const result = await sendPushToUser(session.id, {
      title: "🎉 Test Présence Bureau",
      body: `Bonjour ${session.firstName} ! Vos notifications push fonctionnent parfaitement sur cet appareil.`,
      url: "/",
      tag: "test-notification",
    });

    if (result.total === 0) {
      return NextResponse.json(
        { error: "Aucun appareil enregistré pour cet utilisateur." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      sent: result.sent,
      total: result.total,
    });
  } catch (error) {
    console.error("[API Push Test] Erreur:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'envoi de la notification de test" },
      { status: 500 }
    );
  }
}
