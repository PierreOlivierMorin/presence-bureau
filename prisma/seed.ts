import { PrismaClient, Role, PresenceStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Début du seed...");

  // 1. Création ou mise à jour des équipes
  const teamAlpha = await prisma.team.upsert({
    where: { name: "Équipe Alpha" },
    update: {},
    create: { name: "Équipe Alpha" },
  });

  const teamBeta = await prisma.team.upsert({
    where: { name: "Équipe Beta" },
    update: {},
    create: { name: "Équipe Beta" },
  });

  console.log(`✅ Équipes prêtes : ${teamAlpha.name}, ${teamBeta.name}`);

  // 2. Hash du mot de passe
  const adminPassword = await bcrypt.hash("Admin123!", 10);
  const userPassword = await bcrypt.hash("User123!", 10);

  // 3. Création ou mise à jour des utilisateurs initiaux
  const elisabeth = await prisma.user.upsert({
    where: { email: "admin@bureau.local" },
    update: {
      firstName: "Élisabeth",
      lastName: "Sirois",
      passwordHash: adminPassword,
      role: Role.ADMIN,
      emailVerified: true,
      teamId: teamAlpha.id,
    },
    create: {
      email: "admin@bureau.local",
      firstName: "Élisabeth",
      lastName: "Sirois",
      passwordHash: adminPassword,
      role: Role.ADMIN,
      emailVerified: true,
      teamId: teamAlpha.id,
    },
  });

  const frederique = await prisma.user.upsert({
    where: { email: "frederique@bureau.local" },
    update: {
      firstName: "Frédérique",
      lastName: "Bonenfant",
      passwordHash: userPassword,
      role: Role.USER,
      emailVerified: true,
      teamId: teamAlpha.id,
    },
    create: {
      email: "frederique@bureau.local",
      firstName: "Frédérique",
      lastName: "Bonenfant",
      passwordHash: userPassword,
      role: Role.USER,
      emailVerified: true,
      teamId: teamAlpha.id,
    },
  });

  const allyne = await prisma.user.upsert({
    where: { email: "allyne@bureau.local" },
    update: {
      firstName: "Allyne",
      lastName: "Fernandes",
      passwordHash: userPassword,
      role: Role.USER,
      emailVerified: true,
      teamId: teamAlpha.id,
    },
    create: {
      email: "allyne@bureau.local",
      firstName: "Allyne",
      lastName: "Fernandes",
      passwordHash: userPassword,
      role: Role.USER,
      emailVerified: true,
      teamId: teamAlpha.id,
    },
  });

  const marc = await prisma.user.upsert({
    where: { email: "marc@bureau.local" },
    update: {
      firstName: "Marc",
      lastName: "Tremblay",
      passwordHash: userPassword,
      role: Role.USER,
      emailVerified: true,
      teamId: teamBeta.id,
    },
    create: {
      email: "marc@bureau.local",
      firstName: "Marc",
      lastName: "Tremblay",
      passwordHash: userPassword,
      role: Role.USER,
      emailVerified: true,
      teamId: teamBeta.id,
    },
  });

  console.log("✅ Utilisateurs prêts :");
  console.log(` - ${elisabeth.firstName} ${elisabeth.lastName} (ADMIN, ${teamAlpha.name})`);
  console.log(` - ${frederique.firstName} ${frederique.lastName} (USER, ${teamAlpha.name})`);
  console.log(` - ${allyne.firstName} ${allyne.lastName} (USER, ${teamAlpha.name})`);
  console.log(` - ${marc.firstName} ${marc.lastName} (USER, ${teamBeta.name})`);

  // 4. Données de présences de test pour le mois en cours
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const todayKey = `${year}-${month}-${day}`;

  await prisma.presence.upsert({
    where: {
      date_userId: {
        date: todayKey,
        userId: elisabeth.id,
      },
    },
    update: {
      amStatus: PresenceStatus.OFFICE,
      pmStatus: PresenceStatus.OFFICE,
    },
    create: {
      date: todayKey,
      userId: elisabeth.id,
      amStatus: PresenceStatus.OFFICE,
      pmStatus: PresenceStatus.OFFICE,
    },
  });

  await prisma.presence.upsert({
    where: {
      date_userId: {
        date: todayKey,
        userId: frederique.id,
      },
    },
    update: {
      amStatus: PresenceStatus.REMOTE,
      pmStatus: PresenceStatus.OFFICE,
    },
    create: {
      date: todayKey,
      userId: frederique.id,
      amStatus: PresenceStatus.REMOTE,
      pmStatus: PresenceStatus.OFFICE,
    },
  });

  await prisma.presence.upsert({
    where: {
      date_userId: {
        date: todayKey,
        userId: allyne.id,
      },
    },
    update: {
      amStatus: PresenceStatus.OFFICE,
      pmStatus: PresenceStatus.REMOTE,
    },
    create: {
      date: todayKey,
      userId: allyne.id,
      amStatus: PresenceStatus.OFFICE,
      pmStatus: PresenceStatus.REMOTE,
    },
  });

  console.log(`✅ Présences de test synchronisées pour la date ${todayKey}`);
  console.log("🎉 Seed terminé avec succès !");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });