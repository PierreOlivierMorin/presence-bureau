import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/db";
import bcrypt from "bcryptjs";
import { batchSetPresencesForUser } from "../src/lib/actions/presence";

describe("Soumission groupée d'horaires (Batch Schedule Submission)", () => {
  let testUserId: string;
  let testTeamId: string;

  before(async () => {
    // Créer une équipe de test
    const team = await prisma.team.create({
      data: { name: `Équipe Batch Test ${Date.now()}` },
    });
    testTeamId = team.id;

    // Créer un utilisateur de test
    const user = await prisma.user.create({
      data: {
        email: `batch_user_${Date.now()}@bureau.local`,
        firstName: "Test",
        lastName: "Batch",
        passwordHash: await bcrypt.hash("BatchUser123!", 10),
        role: "USER",
        emailVerified: true,
        teamId: testTeamId,
      },
    });
    testUserId = user.id;
  });

  after(async () => {
    await prisma.presence.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.user.deleteMany({
      where: { id: testUserId },
    });
    await prisma.team.deleteMany({
      where: { id: testTeamId },
    });
  });

  it("1. Soumet un horaire de 5 jours en une seule opération groupée atomique", async () => {
    const dates = [
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
    ];

    const entries = [
      { date: dates[0], amStatus: "OFFICE" as const, dinerStatus: "OFFICE" as const, pmStatus: "OFFICE" as const },
      { date: dates[1], amStatus: "REMOTE" as const, dinerStatus: "REMOTE" as const, pmStatus: "REMOTE" as const },
      { date: dates[2], amStatus: "OFFICE" as const, dinerStatus: "NONE" as const, pmStatus: "REMOTE" as const },
      { date: dates[3], amStatus: "ABSENT" as const, dinerStatus: "ABSENT" as const, pmStatus: "ABSENT" as const },
      { date: dates[4], amStatus: "REMOTE" as const, dinerStatus: "REMOTE" as const, pmStatus: "REMOTE" as const },
    ];

    const result = await batchSetPresencesForUser(testUserId, entries);
    assert.equal(result.success, true);
    assert.equal(result.count, 5);

    // Vérifier en base de données que les 5 présences ont été créées
    const presences = await prisma.presence.findMany({
      where: {
        userId: testUserId,
        date: { in: dates },
      },
      orderBy: { date: "asc" },
    });

    assert.equal(presences.length, 5);
    assert.equal(presences[0].amStatus, "OFFICE");
    assert.equal(presences[0].dinerStatus, "OFFICE");
    assert.equal(presences[1].amStatus, "REMOTE");
    assert.equal(presences[2].amStatus, "OFFICE");
    assert.equal(presences[2].dinerStatus, "NONE");
    assert.equal(presences[2].pmStatus, "REMOTE");
    assert.equal(presences[3].amStatus, "ABSENT");
  });

  it("2. Met à jour et supprime les présences quand réinitialisées à NONE en une seule soumission", async () => {
    const updateEntries = [
      // Changer le premier jour en Télétravail
      { date: "2026-11-02", amStatus: "REMOTE" as const, dinerStatus: "REMOTE" as const, pmStatus: "REMOTE" as const },
      // Effacer le second jour (NONE)
      { date: "2026-11-03", amStatus: "NONE" as const, dinerStatus: "NONE" as const, pmStatus: "NONE" as const },
    ];

    const result = await batchSetPresencesForUser(testUserId, updateEntries);
    assert.equal(result.success, true);

    const pres1 = await prisma.presence.findUnique({
      where: { date_userId: { date: "2026-11-02", userId: testUserId } },
    });
    assert.ok(pres1 !== null);
    assert.equal(pres1.amStatus, "REMOTE");

    const pres2 = await prisma.presence.findUnique({
      where: { date_userId: { date: "2026-11-03", userId: testUserId } },
    });
    assert.equal(pres2, null); // Doit avoir été supprimé
  });

  it("3. Gère une liste vide de façon sécuritaire sans requêtes inutiles", async () => {
    const result = await batchSetPresencesForUser(testUserId, []);
    assert.equal(result.success, true);
    assert.equal(result.count, 0);
  });
});
