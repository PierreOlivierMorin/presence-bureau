"use server";

import crypto from "crypto";
import { prisma } from "@/lib/db";
import { checkAdminSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";
import { sendInvitationEmail } from "@/lib/email";

export type ActionResult<T = unknown> = {
  success?: boolean;
  error?: string;
  data?: T;
};

export async function createTeamAction(
  formData: FormData
): Promise<ActionResult<{ id: string; name: string; _count: { members: number } }>> {
  try {
    const admin = await checkAdminSession();
    const name = formData.get("name")?.toString().trim();

    if (!name) {
      return { error: "Le nom de l'équipe ne peut pas être vide." };
    }

    const existing = await prisma.team.findUnique({
      where: { name },
    });

    if (existing) {
      return { error: "Une équipe avec ce nom existe déjà." };
    }

    const created = await prisma.team.create({
      data: { name },
      select: {
        id: true,
        name: true,
      },
    });

    await createAuditLog({
      action: "TEAM_UPDATED",
      actorId: admin.id,
      target: created.name,
      details: `Création de l'équipe ${created.name}`,
    });

    revalidatePath("/admin");
    revalidatePath("/register");
    revalidatePath("/");
    return {
      success: true,
      data: { id: created.id, name: created.name, _count: { members: 0 } },
    };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Erreur lors de la création de l'équipe." };
  }
}

export async function deleteTeamAction(teamId: string): Promise<ActionResult> {
  try {
    const admin = await checkAdminSession();

    const team = await prisma.team.findUnique({ where: { id: teamId } });

    await prisma.team.delete({
      where: { id: teamId },
    });

    await createAuditLog({
      action: "TEAM_UPDATED",
      actorId: admin.id,
      target: team?.name || teamId,
      details: `Suppression de l'équipe ${team?.name || teamId}`,
    });

    revalidatePath("/admin");
    revalidatePath("/");
    return { success: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Erreur lors de la suppression de l'équipe." };
  }
}

export async function updateUserTeamAction(
  userId: string,
  teamId: string | null
): Promise<ActionResult> {
  try {
    const admin = await checkAdminSession();

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    const targetTeam = teamId ? await prisma.team.findUnique({ where: { id: teamId } }) : null;

    await prisma.user.update({
      where: { id: userId },
      data: { teamId: teamId || null },
    });

    await createAuditLog({
      action: "TEAM_UPDATED",
      actorId: admin.id,
      target: targetUser?.email || userId,
      details: `Changement d'équipe vers : ${targetTeam?.name || "(Aucune)"}`,
    });

    revalidatePath("/admin");
    revalidatePath("/");
    return { success: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Erreur lors du changement d'équipe." };
  }
}

export async function updateUserRoleAction(
  userId: string,
  role: "USER" | "ADMIN"
): Promise<ActionResult> {
  try {
    const currentAdmin = await checkAdminSession();

    if (currentAdmin.id === userId && role === "USER") {
      return { error: "Vous ne pouvez pas retirer vos propres droits d'administrateur." };
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    await createAuditLog({
      action: "ROLE_UPDATED",
      actorId: currentAdmin.id,
      target: updatedUser.email,
      details: `Attribution du rôle : ${role}`,
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Erreur lors de la modification du rôle." };
  }
}

export async function deleteUserAction(userId: string): Promise<ActionResult> {
  try {
    const currentAdmin = await checkAdminSession();

    if (currentAdmin.id === userId) {
      return { error: "Vous ne pouvez pas supprimer votre propre compte administrateur." };
    }

    const userToDelete = await prisma.user.findUnique({ where: { id: userId } });

    await prisma.user.delete({
      where: { id: userId },
    });

    await createAuditLog({
      action: "USER_DELETED",
      actorId: currentAdmin.id,
      target: userToDelete?.email || userId,
      details: `Suppression du compte de ${userToDelete?.firstName} ${userToDelete?.lastName}`,
    });

    revalidatePath("/admin");
    revalidatePath("/");
    return { success: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Erreur lors de la suppression de l'utilisateur." };
  }
}

/**
 * Création et envoi d'une invitation à rejoindre une équipe
 */
export async function createInvitationAction(
  formData: FormData
): Promise<
  ActionResult<{
    id: string;
    email: string;
    teamId: string;
    teamName: string;
    role: "USER" | "ADMIN";
    token: string;
    expiresAt: string;
    inviteUrl: string;
  }>
> {
  try {
    const adminSession = await checkAdminSession();
    const email = formData.get("email")?.toString().trim().toLowerCase();
    const teamId = formData.get("teamId")?.toString().trim();
    const roleInput = formData.get("role")?.toString().trim();
    const role: "USER" | "ADMIN" = roleInput === "ADMIN" ? "ADMIN" : "USER";

    if (!email || !teamId) {
      return { error: "Veuillez renseigner le courriel et sélectionner une équipe." };
    }

    // Validation du format courriel basique
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { error: "Veuillez fournir une adresse courriel valide." };
    }

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      return { error: "Équipe sélectionnée introuvable." };
    }

    // Double sécurité : s'assurer que l'administrateur existe bel et bien en base
    let admin = await prisma.user.findUnique({ where: { id: adminSession.id } });
    if (!admin && adminSession.email) {
      admin = await prisma.user.findUnique({ where: { email: adminSession.email } });
    }

    if (!admin || admin.role !== "ADMIN") {
      return {
        error: "Session administrateur invalide ou utilisateur introuvable en base de données. Veuillez vous reconnecter.",
      };
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { team: true },
    });

    if (existingUser) {
      if (existingUser.teamId === teamId) {
        return {
          error: `Cet utilisateur (${email}) est déjà inscrit et membre de l'équipe "${team.name}".`,
        };
      }
      return {
        error: `Cet utilisateur possède déjà un compte (équipe actuelle : "${
          existingUser.team?.name || "Aucune"
        }"). Vous pouvez directement modifier son équipe dans la table des utilisateurs ci-dessous.`,
      };
    }

    // Supprimer une éventuelle invitation existante non acceptée pour ce couple email-équipe
    await prisma.invitation.deleteMany({
      where: { email, teamId },
    });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 jours

    const invitation = await prisma.invitation.create({
      data: {
        email,
        teamId,
        role,
        token,
        invitedById: admin.id,
        expiresAt,
      },
      include: { team: true },
    });

    const inviterName = `${admin.firstName || ""} ${admin.lastName || ""}`.trim() || "Un administrateur";
    const emailRes = await sendInvitationEmail({
      to: email,
      inviterName,
      teamName: team.name,
      token,
      role,
    });

    await createAuditLog({
      action: "INVITATION_CREATED",
      actorId: admin.id,
      target: email,
      details: {
        teamName: team.name,
        role,
        simulated: emailRes.simulated,
      },
    });

    const baseUrl =
      process.env.NEXTAUTH_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";
    const inviteUrl = `${baseUrl.replace(/\/$/, "")}/register?invite=${token}`;

    revalidatePath("/admin");

    return {
      success: true,
      data: {
        id: invitation.id,
        email: invitation.email,
        teamId: invitation.teamId,
        teamName: invitation.team.name,
        role: invitation.role as "USER" | "ADMIN",
        token: invitation.token,
        expiresAt: invitation.expiresAt.toISOString(),
        inviteUrl,
      },
    };
  } catch (e: unknown) {
    return {
      error: e instanceof Error ? e.message : "Erreur lors de l'envoi de l'invitation.",
    };
  }
}

/**
 * Révoquer / supprimer une invitation en cours
 */
export async function revokeInvitationAction(invitationId: string): Promise<ActionResult> {
  try {
    const admin = await checkAdminSession();

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: { team: true },
    });

    if (!invitation) {
      return { error: "Invitation introuvable." };
    }

    await prisma.invitation.delete({
      where: { id: invitationId },
    });

    await createAuditLog({
      action: "INVITATION_REVOKED",
      actorId: admin.id,
      target: invitation.email,
      details: `Révocation de l'invitation pour l'équipe ${invitation.team.name}`,
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (e: unknown) {
    return {
      error: e instanceof Error ? e.message : "Erreur lors de la révocation de l'invitation.",
    };
  }
}

/**
 * Renvoyer le courriel pour une invitation existante
 */
export async function resendInvitationAction(invitationId: string): Promise<ActionResult> {
  try {
    const admin = await checkAdminSession();

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: { team: true },
    });

    if (!invitation) {
      return { error: "Invitation introuvable." };
    }

    // Renouveler la date d'expiration pour 7 jours
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.invitation.update({
      where: { id: invitationId },
      data: { expiresAt: newExpiresAt },
    });

    await sendInvitationEmail({
      to: invitation.email,
      inviterName: `${admin.firstName} ${admin.lastName}`,
      teamName: invitation.team.name,
      token: invitation.token,
      role: invitation.role,
    });

    await createAuditLog({
      action: "INVITATION_CREATED",
      actorId: admin.id,
      target: invitation.email,
      details: `Renvoi de l'invitation pour l'équipe ${invitation.team.name}`,
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (e: unknown) {
    return {
      error: e instanceof Error ? e.message : "Erreur lors du renvoi de l'invitation.",
    };
  }
}