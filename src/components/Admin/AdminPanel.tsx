"use client";

import { useState, useTransition } from "react";
import {
  createTeamAction,
  deleteTeamAction,
  updateUserTeamAction,
  updateUserRoleAction,
  deleteUserAction,
  createInvitationAction,
  revokeInvitationAction,
  resendInvitationAction,
  sendAdminPushNotificationAction,
} from "@/lib/actions/admin";
import {
  Users,
  Trash2,
  Plus,
  Shield,
  ShieldAlert,
  UserCheck,
  Mail,
  Send,
  Copy,
  Check,
  RotateCcw,
  ShieldCheck,
  History,
  Clock,
  CheckCircle2,
  AlertCircle,
  Bell,
  BellRing,
  Sparkles,
  X,
} from "lucide-react";

interface TeamItem {
  id: string;
  name: string;
  _count: { members: number };
}

interface UserItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "USER" | "ADMIN";
  emailVerified: boolean;
  teamId: string | null;
  team: { id: string; name: string } | null;
  createdAt?: Date | string;
}

interface InvitationItem {
  id: string;
  email: string;
  teamId: string;
  role: "USER" | "ADMIN";
  token: string;
  expiresAt: string;
  createdAt: string;
  team: { id: string; name: string };
  invitedBy?: { firstName: string; lastName: string } | null;
}

interface AuditLogItem {
  id: string;
  action: string;
  target: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
  actor: { firstName: string; lastName: string; email: string } | null;
}

interface AdminPanelProps {
  currentUserId: string;
  initialTeams: TeamItem[];
  initialUsers: UserItem[];
  initialInvitations?: InvitationItem[];
  initialAuditLogs?: AuditLogItem[];
  initialPushStats?: {
    totalSubscriptions: number;
    uniqueUsers: number;
  };
}

export default function AdminPanel({
  currentUserId,
  initialTeams,
  initialUsers,
  initialInvitations = [],
  initialAuditLogs = [],
  initialPushStats = { totalSubscriptions: 0, uniqueUsers: 0 },
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<"teams" | "invitations" | "users" | "audit">("invitations");
  const [teams, setTeams] = useState<TeamItem[]>(initialTeams);
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [invitations, setInvitations] = useState<InvitationItem[]>(initialInvitations);
  const [auditLogs] = useState<AuditLogItem[]>(initialAuditLogs);

  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
  const [lastCreatedInvite, setLastCreatedInvite] = useState<{ url: string; email: string } | null>(null);

  // Notifications push (modal d'envoi & test admin)
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [pushTarget, setPushTarget] = useState<"all" | "self">("all");
  const [pushTitle, setPushTitle] = useState("Présence Bureau");
  const [pushBody, setPushBody] = useState("");
  const [pushUrl, setPushUrl] = useState("/");
  const [isSendingPush, setIsSendingPush] = useState(false);
  const [pushResult, setPushResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleSendPush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pushTitle.trim() || !pushBody.trim()) {
      setPushResult({ type: "error", message: "Le titre et le message sont requis." });
      return;
    }

    setIsSendingPush(true);
    setPushResult(null);

    const res = await sendAdminPushNotificationAction({
      target: pushTarget,
      title: pushTitle,
      body: pushBody,
      url: pushUrl,
    });

    setIsSendingPush(false);

    if (res.error) {
      setPushResult({ type: "error", message: res.error });
    } else if (res.data) {
      setPushResult({
        type: "success",
        message:
          pushTarget === "self"
            ? `Notification de test envoyée (${res.data.sent}/${res.data.total} appareil).`
            : `Notification envoyée à tous les abonnés (${res.data.sent}/${res.data.total} appareils touchés).`,
      });
      if (pushTarget === "all") {
        setPushBody("");
      }
    }
  };

  const applyPushPreset = (preset: "general" | "presence" | "monday") => {
    setPushResult(null);
    if (preset === "general") {
      setPushTitle("📢 Annonce Présence Bureau");
      setPushBody("Bonjour à tous ! Merci de penser à vérifier et renseigner vos présences de la semaine.");
      setPushUrl("/");
    } else if (preset === "presence") {
      setPushTitle("🏢 Présence au bureau aujourd'hui");
      setPushBody("Plusieurs collègues sont au bureau aujourd'hui ! Consultez le planning en direct.");
      setPushUrl("/");
    } else if (preset === "monday") {
      setPushTitle("📅 Planning de la semaine");
      setPushBody("C'est lundi ! N'oubliez pas d'indiquer vos jours de présence au bureau pour cette semaine.");
      setPushUrl("/");
    }
  };

  const showNotification = (success?: string, error?: string) => {
    if (error) {
      setErrorMsg(error);
      setSuccessMsg(null);
    } else if (success) {
      setSuccessMsg(success);
      setErrorMsg(null);
      setTimeout(() => setSuccessMsg(null), 5000);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTokenId(id);
      setTimeout(() => setCopiedTokenId(null), 3000);
    } catch {
      alert(`Lien d'invitation : ${text}`);
    }
  };

  // --- Gestion des Équipes ---
  const handleCreateTeam = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const res = await createTeamAction(formData);
      if (res.error) {
        showNotification(undefined, res.error);
      } else {
        if (res.data) {
          setTeams((prev) => [...prev, res.data!].sort((a, b) => a.name.localeCompare(b.name)));
        }
        showNotification("Équipe créée avec succès !");
        form.reset();
      }
    });
  };

  const handleDeleteTeam = (teamId: string, teamName: string) => {
    if (
      !confirm(
        `Êtes-vous certain de vouloir supprimer l'équipe "${teamName}" ? Les membres ne seront pas supprimés mais détachés de l'équipe.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      const res = await deleteTeamAction(teamId);
      if (res.error) {
        showNotification(undefined, res.error);
      } else {
        setTeams((prev) => prev.filter((t) => t.id !== teamId));
        setUsers((prev) =>
          prev.map((u) => (u.teamId === teamId ? { ...u, teamId: null, team: null } : u))
        );
        setInvitations((prev) => prev.filter((inv) => inv.teamId !== teamId));
        showNotification(`L'équipe "${teamName}" a été supprimée.`);
      }
    });
  };

  // --- Gestion des Invitations ---
  const handleCreateInvitation = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const res = await createInvitationAction(formData);
      if (res.error) {
        showNotification(undefined, res.error);
      } else if (res.data) {
        const newInv: InvitationItem = {
          id: res.data.id,
          email: res.data.email,
          teamId: res.data.teamId,
          role: res.data.role,
          token: res.data.token,
          expiresAt: res.data.expiresAt,
          createdAt: new Date().toISOString(),
          team: { id: res.data.teamId, name: res.data.teamName },
          invitedBy: { firstName: "Vous", lastName: "" },
        };

        setInvitations((prev) => [newInv, ...prev]);
        setLastCreatedInvite({ url: res.data.inviteUrl, email: res.data.email });
        if (res.data.emailSent) {
          showNotification(`Invitation générée et expédiée avec succès à ${res.data.email} !`);
        } else {
          showNotification(
            undefined,
            `L'invitation a été créée, mais le courriel n'a pas pu être délivré (${res.data.emailError || "Erreur de distribution"}). Vous pouvez copier le lien ci-dessous et le transmettre directement au destinataire.`
          );
        }
        form.reset();
      }
    });
  };

  const handleRevokeInvitation = (invitationId: string, email: string) => {
    if (!confirm(`Voulez-vous révoquer l'invitation envoyée à "${email}" ?`)) return;

    startTransition(async () => {
      const res = await revokeInvitationAction(invitationId);
      if (res.error) {
        showNotification(undefined, res.error);
      } else {
        setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
        showNotification(`Invitation pour "${email}" révoquée.`);
      }
    });
  };

  const handleResendInvitation = (invitationId: string, email: string) => {
    startTransition(async () => {
      const res = await resendInvitationAction(invitationId);
      if (res.error) {
        showNotification(undefined, res.error);
      } else {
        showNotification(`L'invitation a été renvoyée à ${email} avec un délai de 7 jours.`);
      }
    });
  };

  // --- Gestion des Utilisateurs ---
  const handleChangeUserTeam = (userId: string, newTeamId: string) => {
    const targetTeamId = newTeamId === "" ? null : newTeamId;
    const targetTeamObj = teams.find((t) => t.id === targetTeamId) || null;

    startTransition(async () => {
      const res = await updateUserTeamAction(userId, targetTeamId);
      if (res.error) {
        showNotification(undefined, res.error);
      } else {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId
              ? {
                  ...u,
                  teamId: targetTeamId,
                  team: targetTeamObj ? { id: targetTeamObj.id, name: targetTeamObj.name } : null,
                }
              : u
          )
        );
        showNotification("Équipe de l'utilisateur mise à jour !");
      }
    });
  };

  const handleToggleUserRole = (userId: string, currentRole: "USER" | "ADMIN") => {
    const newRole = currentRole === "ADMIN" ? "USER" : "ADMIN";
    if (userId === currentUserId && newRole === "USER") {
      alert("Vous ne pouvez pas retirer vos propres privilèges d'administrateur.");
      return;
    }

    startTransition(async () => {
      const res = await updateUserRoleAction(userId, newRole);
      if (res.error) {
        showNotification(undefined, res.error);
      } else {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
        showNotification(`Rôle de l'utilisateur mis à jour (${newRole}).`);
      }
    });
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    if (userId === currentUserId) {
      alert("Vous ne pouvez pas supprimer votre propre compte.");
      return;
    }

    if (
      !confirm(
        `Êtes-vous certain de vouloir supprimer l'utilisateur "${userName}" ? Toutes ses présences seront également supprimées.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      const res = await deleteUserAction(userId);
      if (res.error) {
        showNotification(undefined, res.error);
      } else {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        showNotification(`L'utilisateur "${userName}" a été supprimé.`);
      }
    });
  };

  const formatLogAction = (action: string) => {
    switch (action) {
      case "LOGIN_SUCCESS":
        return <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium border border-emerald-200">Connexion réussie</span>;
      case "LOGIN_FAILED":
        return <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded font-medium border border-red-200">Échec connexion</span>;
      case "USER_REGISTERED":
        return <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-medium border border-blue-200">Compte créé</span>;
      case "EMAIL_VERIFIED":
        return <span className="text-teal-700 bg-teal-50 px-2 py-0.5 rounded font-medium border border-teal-200">Courriel vérifié</span>;
      case "INVITATION_CREATED":
        return <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-medium border border-indigo-200">Invitation créée</span>;
      case "INVITATION_ACCEPTED":
        return <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium border border-emerald-200">Invitation acceptée</span>;
      case "INVITATION_REVOKED":
        return <span className="text-gray-700 bg-gray-100 px-2 py-0.5 rounded font-medium border border-gray-300">Invitation révoquée</span>;
      case "ROLE_UPDATED":
        return <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium border border-amber-200">Rôle modifié</span>;
      case "TEAM_UPDATED":
        return <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded font-medium border border-purple-200">Équipe modifiée</span>;
      case "USER_DELETED":
        return <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-medium border border-rose-200">Utilisateur supprimé</span>;
      case "PASSWORD_RESET_REQUESTED":
        return <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium border border-amber-200">Demande mdp</span>;
      case "PASSWORD_RESET_COMPLETED":
        return <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium border border-emerald-200">Mdp réinitialisé</span>;
      case "PUSH_NOTIFICATION_SENT":
        return <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-medium border border-blue-200">Push envoyé</span>;
      default:
        return <span className="text-gray-600 bg-gray-50 px-2 py-0.5 rounded font-medium">{action}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Alertes globales */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Barre d'onglets de gestion & Bouton notification push */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-2 sm:pb-0">
        <div className="flex border-b sm:border-b-0 border-[var(--border)] overflow-x-auto gap-2 pb-px">
          <button
            type="button"
            onClick={() => setActiveTab("invitations")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === "invitations"
                ? "border-[var(--primary)] text-[var(--primary)] bg-white/50"
                : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Invitations d&apos;équipes</span>
            <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
              {invitations.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === "users"
                ? "border-[var(--primary)] text-[var(--primary)] bg-white/50"
                : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Utilisateurs & Rôles</span>
            <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 font-bold">
              {users.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("teams")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === "teams"
                ? "border-[var(--primary)] text-[var(--primary)] bg-white/50"
                : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Gestion des Équipes</span>
            <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 font-bold">
              {teams.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === "audit"
                ? "border-[var(--primary)] text-[var(--primary)] bg-white/50"
                : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            <History className="w-4 h-4" />
            <span>Journal d&apos;audit & Sécurité</span>
            <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
              {auditLogs.length}
            </span>
          </button>
        </div>

        {/* Bouton d'action Admin pour envoyer des notifications push */}
        <button
          type="button"
          onClick={() => {
            setShowBroadcastModal(true);
            setPushResult(null);
          }}
          className="self-start sm:self-center shrink-0 flex items-center gap-2 px-3.5 py-2 mb-2 sm:mb-0 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-95"
          title="Tester ou envoyer une notification à tous les utilisateurs"
        >
          <Bell className="w-4 h-4" />
          <span>Envoyer notification</span>
          <span
            className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-semibold"
            title={`${initialPushStats.totalSubscriptions} appareil(s) enregistré(s)`}
          >
            {initialPushStats.uniqueUsers} {initialPushStats.uniqueUsers > 1 ? "abonnés" : "abonné"}
          </span>
        </button>
      </div>

      {/* ONGLET 1 : INVITATIONS D'ÉQUIPES */}
      {activeTab === "invitations" && (
        <div className="space-y-6">
          {/* Formulaire d'invitation */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-[var(--text)] flex items-center gap-2">
                <Mail className="w-5 h-5 text-[var(--primary)]" />
                Inviter un collaborateur dans une équipe
              </h2>
              <p className="text-xs text-[var(--muted)] mt-1">
                L&apos;invitation génère un lien sécurisé unique valide 7 jours. Dès son inscription, le compte rejoint directement l&apos;équipe choisie et son courriel est automatiquement certifié.
              </p>
            </div>

            <form onSubmit={handleCreateInvitation} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-5">
                <label className="block text-xs font-semibold text-[var(--text)] mb-1">
                  Adresse courriel du collaborateur
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="collaborateur@bureau.com"
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-white focus:ring-2 focus:ring-[var(--primary)] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-[var(--text)] mb-1">
                  Équipe de rattachement
                </label>
                <select
                  name="teamId"
                  required
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-white focus:ring-2 focus:ring-[var(--primary)] focus:outline-none cursor-pointer"
                >
                  <option value="">Sélectionnez une équipe...</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[var(--text)] mb-1">
                  Rôle
                </label>
                <select
                  name="role"
                  defaultValue="USER"
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-white focus:ring-2 focus:ring-[var(--primary)] focus:outline-none cursor-pointer"
                >
                  <option value="USER">Utilisateur</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <div className="sm:col-span-1">
                <button
                  type="submit"
                  disabled={isPending || teams.length === 0}
                  className="w-full py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:opacity-95 transition flex items-center justify-center gap-1 shadow-sm disabled:opacity-50"
                  title="Envoyer l'invitation"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>

            {/* Notification de copie du dernier lien créé */}
            {lastCreatedInvite && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs text-blue-900">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  <span>
                    Invitation créée pour <strong>{lastCreatedInvite.email}</strong>.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(lastCreatedInvite.url, "last-created")}
                  className="px-2.5 py-1 bg-white border border-blue-300 rounded font-semibold text-blue-800 hover:bg-blue-100 flex items-center gap-1 transition"
                >
                  {copiedTokenId === "last-created" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Lien copié !</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copier le lien d&apos;invitation</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Table des invitations actives */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-base font-bold text-[var(--text)]">
                Invitations en attente ({invitations.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--muted)] text-xs uppercase font-semibold">
                    <th className="pb-3 px-2">Courriel</th>
                    <th className="pb-3 px-2">Équipe assignée</th>
                    <th className="pb-3 px-2">Rôle prévu</th>
                    <th className="pb-3 px-2">Expire le</th>
                    <th className="pb-3 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {invitations.map((inv) => {
                    const isExpired = new Date(inv.expiresAt) < new Date();
                    const inviteUrl = `${
                      typeof window !== "undefined" ? window.location.origin : ""
                    }/register?invite=${inv.token}`;

                    return (
                      <tr key={inv.id} className="hover:bg-gray-50/70 transition">
                        <td className="py-3 px-2 font-medium text-[var(--text)]">
                          {inv.email}
                        </td>
                        <td className="py-3 px-2">
                          <span className="font-semibold text-xs px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded">
                            {inv.team.name}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-xs">
                          {inv.role === "ADMIN" ? (
                            <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              Admin
                            </span>
                          ) : (
                            <span className="text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                              Utilisateur
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-xs text-[var(--muted)]">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(inv.expiresAt).toLocaleDateString("fr-CA")}
                            {isExpired && (
                              <span className="ml-1 text-[10px] text-red-600 font-bold uppercase">
                                Expirée
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => copyToClipboard(inviteUrl, inv.id)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Copier le lien d'invitation"
                            >
                              {copiedTokenId === inv.id ? (
                                <Check className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResendInvitation(inv.id, inv.email)}
                              disabled={isPending}
                              className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                              title="Renvoyer l'invitation"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRevokeInvitation(inv.id, inv.email)}
                              disabled={isPending}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Révoquer l'invitation"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {invitations.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-[var(--muted)]">
                        Aucune invitation en cours. Utilisez le formulaire ci-dessus pour inviter des collègues.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ONGLET 2 : UTILISATEURS & RÔLES */}
      {activeTab === "users" && (
        <section className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
          <div className="mb-6 pb-4 border-b border-[var(--border)]">
            <h2 className="text-lg font-bold text-[var(--text)] flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-600" />
              Gestion des Utilisateurs ({users.length})
            </h2>
            <p className="text-xs text-[var(--muted)] mt-1">
              Consultez l&apos;état de vérification, attribuez les équipes ou gérez les privilèges d&apos;administration.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--muted)] text-xs uppercase font-semibold">
                  <th className="pb-3 px-2">Utilisateur</th>
                  <th className="pb-3 px-2">Courriel</th>
                  <th className="pb-3 px-2">Vérification</th>
                  <th className="pb-3 px-2">Équipe rattachée</th>
                  <th className="pb-3 px-2">Rôle</th>
                  <th className="pb-3 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {users.map((u) => {
                  const isSelf = u.id === currentUserId;
                  return (
                    <tr key={u.id} className="hover:bg-gray-50/70 transition">
                      <td className="py-3 px-2 font-medium text-[var(--text)]">
                        {u.firstName} {u.lastName}
                        {isSelf && (
                          <span className="ml-2 text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded font-semibold">
                            Vous
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-[var(--muted)]">{u.email}</td>
                      <td className="py-3 px-2">
                        {u.emailVerified ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Vérifié
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            En attente
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <select
                          value={u.teamId || ""}
                          onChange={(e) => handleChangeUserTeam(u.id, e.target.value)}
                          disabled={isPending}
                          className="text-xs px-2 py-1 bg-white border border-[var(--border)] rounded-md cursor-pointer focus:ring-1 focus:ring-[var(--primary)]"
                        >
                          <option value="">(Aucune équipe)</option>
                          {teams.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-2">
                        <button
                          type="button"
                          onClick={() => handleToggleUserRole(u.id, u.role)}
                          disabled={isPending || isSelf}
                          className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold transition ${
                            u.role === "ADMIN"
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : "bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200"
                          }`}
                          title={
                            isSelf
                              ? "Vous ne pouvez pas modifier votre propre rôle"
                              : "Cliquer pour basculer le rôle"
                          }
                        >
                          {u.role === "ADMIN" ? (
                            <>
                              <ShieldAlert className="w-3 h-3" />
                              Admin
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3 h-3" />
                              Utilisateur
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-2 text-right">
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u.id, `${u.firstName} ${u.lastName}`)}
                            disabled={isPending}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Supprimer cet utilisateur"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ONGLET 3 : GESTION DES ÉQUIPES */}
      {activeTab === "teams" && (
        <section className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-6 pb-4 border-b border-[var(--border)]">
            <div>
              <h2 className="text-lg font-bold text-[var(--text)] flex items-center gap-2">
                <Users className="w-5 h-5 text-[var(--primary)]" />
                Gestion des Équipes ({teams.length})
              </h2>
              <p className="text-xs text-[var(--muted)] mt-1">
                Chaque utilisateur ne voit que les présences des membres de sa propre équipe.
              </p>
            </div>

            <form onSubmit={handleCreateTeam} className="flex gap-2">
              <input
                name="name"
                type="text"
                required
                placeholder="Nom de l'équipe (ex. RH, Dev)..."
                className="px-3 py-1.5 border border-[var(--border)] rounded-lg text-sm bg-white focus:ring-2 focus:ring-[var(--primary)] focus:outline-none"
              />
              <button
                type="submit"
                disabled={isPending}
                className="px-3.5 py-1.5 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:opacity-95 transition flex items-center gap-1 shadow-sm disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>Créer</span>
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {teams.map((team) => (
              <div
                key={team.id}
                className="p-4 rounded-xl border border-[var(--border)] bg-gray-50/50 flex justify-between items-center"
              >
                <div>
                  <h3 className="font-semibold text-sm text-[var(--text)]">{team.name}</h3>
                  <span className="text-xs text-[var(--muted)]">
                    {users.filter((u) => u.teamId === team.id).length} membre(s) actif(s)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteTeam(team.id, team.name)}
                  disabled={isPending}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="Supprimer cette équipe"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            {teams.length === 0 && (
              <div className="col-span-full py-6 text-center text-sm text-[var(--muted)]">
                Aucune équipe créée pour l&apos;instant.
              </div>
            )}
          </div>
        </section>
      )}

      {/* ONGLET 4 : JOURNAL D'AUDIT & SÉCURITÉ */}
      {activeTab === "audit" && (
        <section className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
          <div className="mb-6 pb-4 border-b border-[var(--border)]">
            <h2 className="text-lg font-bold text-[var(--text)] flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-600" />
              Journal d&apos;audit de sécurité ({auditLogs.length} derniers événements)
            </h2>
            <p className="text-xs text-[var(--muted)] mt-1">
              Historique immuable des connexions, échecs d&apos;authentification, créations d&apos;invitations et modifications de privilèges.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--muted)] text-xs uppercase font-semibold">
                  <th className="pb-3 px-2">Date & Heure</th>
                  <th className="pb-3 px-2">Action</th>
                  <th className="pb-3 px-2">Cible</th>
                  <th className="pb-3 px-2">Auteur</th>
                  <th className="pb-3 px-2">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/70 transition">
                    <td className="py-2.5 px-2 text-xs text-[var(--muted)] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("fr-CA", {
                        dateStyle: "short",
                        timeStyle: "medium",
                      })}
                    </td>
                    <td className="py-2.5 px-2 whitespace-nowrap">
                      {formatLogAction(log.action)}
                    </td>
                    <td className="py-2.5 px-2 text-xs font-mono text-gray-800">
                      {log.target || "—"}
                    </td>
                    <td className="py-2.5 px-2 text-xs text-gray-700">
                      {log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : "Système"}
                    </td>
                    <td className="py-2.5 px-2 text-xs text-[var(--muted)] truncate max-w-xs">
                      {log.details || "—"}
                    </td>
                  </tr>
                ))}

                {auditLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-[var(--muted)]">
                      Aucun événement de sécurité enregistré pour le moment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Modal d'envoi et de test de notification Push */}
      {showBroadcastModal && (
        <div
          onClick={() => setShowBroadcastModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--card-bg)] border border-[var(--border)] text-[var(--text)] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
          >
            {/* Header modal */}
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">Envoyer une notification push</h3>
                  <p className="text-[11px] text-[var(--muted)]">
                    {initialPushStats.uniqueUsers} {initialPushStats.uniqueUsers > 1 ? "utilisateurs abonnés" : "utilisateur abonné"} ({initialPushStats.totalSubscriptions} appareil{initialPushStats.totalSubscriptions > 1 ? "s" : ""})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBroadcastModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Presets rapides */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Modèles de messages rapides :</span>
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyPushPreset("general")}
                  className="px-2.5 py-1 text-xs rounded-lg border border-[var(--border)] hover:bg-gray-50 text-gray-700 transition"
                >
                  📢 Annonce générale
                </button>
                <button
                  type="button"
                  onClick={() => applyPushPreset("presence")}
                  className="px-2.5 py-1 text-xs rounded-lg border border-[var(--border)] hover:bg-gray-50 text-gray-700 transition"
                >
                  🏢 Présence bureau
                </button>
                <button
                  type="button"
                  onClick={() => applyPushPreset("monday")}
                  className="px-2.5 py-1 text-xs rounded-lg border border-[var(--border)] hover:bg-gray-50 text-gray-700 transition"
                >
                  📅 Rappel du lundi
                </button>
              </div>
            </div>

            <form onSubmit={handleSendPush} className="space-y-3.5">
              {/* Choix des destinataires */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700">Destinataires :</label>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer text-xs transition ${
                      pushTarget === "all"
                        ? "border-blue-500 bg-blue-50/50 text-blue-900 font-semibold"
                        : "border-[var(--border)] hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="pushTarget"
                      value="all"
                      checked={pushTarget === "all"}
                      onChange={() => setPushTarget("all")}
                      className="text-blue-600"
                    />
                    <span>Tous les abonnés ({initialPushStats.uniqueUsers})</span>
                  </label>

                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer text-xs transition ${
                      pushTarget === "self"
                        ? "border-blue-500 bg-blue-50/50 text-blue-900 font-semibold"
                        : "border-[var(--border)] hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="pushTarget"
                      value="self"
                      checked={pushTarget === "self"}
                      onChange={() => setPushTarget("self")}
                      className="text-blue-600"
                    />
                    <span>Moi uniquement (Test)</span>
                  </label>
                </div>
              </div>

              {/* Titre */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Titre de la notification :</label>
                <input
                  type="text"
                  value={pushTitle}
                  onChange={(e) => setPushTitle(e.target.value)}
                  placeholder="Ex: Présence Bureau"
                  required
                  className="w-full px-3 py-2 text-xs border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Message */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Contenu du message :</label>
                <textarea
                  value={pushBody}
                  onChange={(e) => setPushBody(e.target.value)}
                  placeholder="Ex: N'oubliez pas d'indiquer vos présences de la semaine !"
                  rows={3}
                  required
                  className="w-full px-3 py-2 text-xs border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* URL au clic */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Lien lors du clic (optionnel) :</label>
                <input
                  type="text"
                  value={pushUrl}
                  onChange={(e) => setPushUrl(e.target.value)}
                  placeholder="/"
                  className="w-full px-3 py-2 text-xs border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              {/* Résultat de l'envoi */}
              {pushResult && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                    pushResult.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-rose-50 text-rose-800 border-rose-200"
                  }`}
                >
                  {pushResult.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  )}
                  <span>{pushResult.message}</span>
                </div>
              )}

              {/* Boutons d'action */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="px-3.5 py-2 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition"
                >
                  Fermer
                </button>
                <button
                  type="submit"
                  disabled={isSendingPush || !pushTitle.trim() || !pushBody.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-95 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {isSendingPush
                      ? "Envoi en cours..."
                      : pushTarget === "self"
                      ? "Tester sur mon appareil"
                      : "Diffuser à tous les abonnés"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}