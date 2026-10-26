import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendNotificationToSubscription } from "@/lib/push";

export const dynamic = "force-dynamic";

/**
 * Formatage lisible des noms des collègues présents au bureau
 */
function formatOfficeMembers(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} est au bureau aujourd'hui.`;
  if (names.length === 2) return `${names[0]} et ${names[1]} sont au bureau aujourd'hui.`;
  if (names.length === 3) return `${names[0]}, ${names[1]} et ${names[2]} sont au bureau aujourd'hui.`;
  
  const othersCount = names.length - 3;
  return `${names[0]}, ${names[1]}, ${names[2]} et ${othersCount} autre${othersCount > 1 ? "s" : ""} sont au bureau (${names.length} personnes).`;
}

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}

async function handleCron(req: NextRequest) {
  try {
    // Vérification du secret CRON si configuré
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");
    const { searchParams } = new URL(req.url);
    const keyParam = searchParams.get("key");

    if (cronSecret) {
      const isAuthorized =
        authHeader === `Bearer ${cronSecret}` || keyParam === cronSecret;
      if (!isAuthorized) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
      }
    }

    // Calcul de la date locale (fuseau horaire paramétrable, défaut Canada/Montréal)
    const timeZone = process.env.TIMEZONE || "America/Toronto";
    const now = new Date();
    
    // Obtenir YYYY-MM-DD dans le fuseau horaire
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const todayStr = formatter.format(now); // "YYYY-MM-DD"

    // Obtenir le jour de la semaine (1 = lundi, 5 = vendredi, 6 = samedi, 0 = dimanche)
    const dayOfWeekFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
    });
    const dayOfWeekStr = dayOfWeekFormatter.format(now); // "Mon", "Tue", ...
    const isMonday = dayOfWeekStr === "Mon";
    const isWeekend = dayOfWeekStr === "Sat" || dayOfWeekStr === "Sun";

    if (isWeekend) {
      return NextResponse.json({
        message: "Fin de semaine, aucune notification envoyée.",
        date: todayStr,
      });
    }

    // Récupérer toutes les présences au bureau pour aujourd'hui
    const presencesToday = await prisma.presence.findMany({
      where: {
        date: todayStr,
        OR: [
          { amStatus: "OFFICE" },
          { dinerStatus: "OFFICE" },
          { pmStatus: "OFFICE" },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            teamId: true,
          },
        },
      },
    });

    // Regrouper les présents par équipe
    const presentByTeam = new Map<string, { id: string; name: string }[]>();
    const allPresentUsers: { id: string; name: string }[] = [];

    for (const p of presencesToday) {
      const user = p.user;
      const userName = `${user.firstName} ${user.lastName}`.trim();
      allPresentUsers.push({ id: user.id, name: userName });

      if (user.teamId) {
        const teamList = presentByTeam.get(user.teamId) || [];
        teamList.push({ id: user.id, name: userName });
        presentByTeam.set(user.teamId, teamList);
      }
    }

    // Récupérer toutes les souscriptions push actives avec leur utilisateur
    const subscriptions = await prisma.pushSubscription.findMany({
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            teamId: true,
          },
        },
      },
    });

    if (subscriptions.length === 0) {
      return NextResponse.json({
        message: "Aucun utilisateur abonné aux notifications push.",
        date: todayStr,
      });
    }

    let sentCount = 0;
    let skippedCount = 0;

    for (const sub of subscriptions) {
      const userTeamId = sub.user.teamId;

      // Déterminer la liste des personnes au bureau pour cet utilisateur (de son équipe ou global si pas d'équipe)
      const officeMembersForUser = userTeamId
        ? presentByTeam.get(userTeamId) || []
        : allPresentUsers;

      const hasPeopleAtOffice = officeMembersForUser.length > 0;
      const officeText = formatOfficeMembers(officeMembersForUser.map((u) => u.name));

      let notificationToSend: { title: string; body: string; url: string; tag: string } | null = null;

      if (isMonday) {
        // Lundi : Rappel d'enregistrer les horaires de la semaine
        if (hasPeopleAtOffice) {
          notificationToSend = {
            title: "📅 Lundi : Planning & Présences",
            body: `Pensez à entrer vos présences de la semaine ! ${officeText}`,
            url: "/",
            tag: "monday-reminder",
          };
        } else {
          notificationToSend = {
            title: "📅 Planning de la semaine",
            body: "C'est lundi ! N'oubliez pas d'indiquer vos jours de présence pour la semaine.",
            url: "/",
            tag: "monday-reminder",
          };
        }
      } else {
        // Du mardi au vendredi : SEULEMENT envoyer s'il y a des gens au bureau
        if (hasPeopleAtOffice) {
          notificationToSend = {
            title: "🏢 Présence au bureau aujourd'hui",
            body: officeText,
            url: "/",
            tag: "daily-presence",
          };
        } else {
          // Personne au bureau -> on n'envoie rien selon l'exigence de l'utilisateur !
          skippedCount++;
        }
      }

      if (notificationToSend) {
        const success = await sendNotificationToSubscription(
          {
            id: sub.id,
            endpoint: sub.endpoint,
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
          notificationToSend
        );
        if (success) sentCount++;
      }
    }

    return NextResponse.json({
      success: true,
      date: todayStr,
      day: dayOfWeekStr,
      isMonday,
      officePresentCount: allPresentUsers.length,
      notificationsSent: sentCount,
      notificationsSkipped: skippedCount,
    });
  } catch (error) {
    console.error("[Cron Notifications] Erreur:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'exécution du cron de notifications" },
      { status: 500 }
    );
  }
}
