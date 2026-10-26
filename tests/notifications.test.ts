import test, { describe } from "node:test";
import assert from "node:assert";

// Fonctions pures ou utilitaires simulant la logique du cron
function formatOfficeMembers(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} est au bureau aujourd'hui.`;
  if (names.length === 2) return `${names[0]} et ${names[1]} sont au bureau aujourd'hui.`;
  if (names.length === 3) return `${names[0]}, ${names[1]} et ${names[2]} sont au bureau aujourd'hui.`;

  const othersCount = names.length - 3;
  return `${names[0]}, ${names[1]}, ${names[2]} et ${othersCount} autre${othersCount > 1 ? "s" : ""} sont au bureau (${names.length} personnes).`;
}

interface NotificationDecisionInput {
  isMonday: boolean;
  officeMembers: string[];
}

function computeDailyNotification(input: NotificationDecisionInput): {
  shouldSend: boolean;
  title?: string;
  body?: string;
} {
  const hasOffice = input.officeMembers.length > 0;
  const officeText = formatOfficeMembers(input.officeMembers);

  if (input.isMonday) {
    if (hasOffice) {
      return {
        shouldSend: true,
        title: "📅 Lundi : Planning & Présences",
        body: `Pensez à entrer vos présences de la semaine ! ${officeText}`,
      };
    }
    return {
      shouldSend: true,
      title: "📅 Planning de la semaine",
      body: "C'est lundi ! N'oubliez pas d'indiquer vos jours de présence pour la semaine.",
    };
  }

  // Mardi à Vendredi : seulement s'il y a des personnes au bureau !
  if (hasOffice) {
    return {
      shouldSend: true,
      title: "🏢 Présence au bureau aujourd'hui",
      body: officeText,
    };
  }

  return { shouldSend: false };
}

describe("Règles métier des notifications matinales (Push)", () => {
  test("Formatage du nom des collègues au bureau", () => {
    assert.strictEqual(formatOfficeMembers([]), "");
    assert.strictEqual(formatOfficeMembers(["Alice"]), "Alice est au bureau aujourd'hui.");
    assert.strictEqual(formatOfficeMembers(["Alice", "Bob"]), "Alice et Bob sont au bureau aujourd'hui.");
    assert.strictEqual(
      formatOfficeMembers(["Alice", "Bob", "Charlie"]),
      "Alice, Bob et Charlie sont au bureau aujourd'hui."
    );
    assert.strictEqual(
      formatOfficeMembers(["Alice", "Bob", "Charlie", "David"]),
      "Alice, Bob, Charlie et 1 autre sont au bureau (4 personnes)."
    );
    assert.strictEqual(
      formatOfficeMembers(["Alice", "Bob", "Charlie", "David", "Emma"]),
      "Alice, Bob, Charlie et 2 autres sont au bureau (5 personnes)."
    );
  });

  test("Mardi à Vendredi : Ne rien envoyer si personne n'est au bureau", () => {
    const result = computeDailyNotification({
      isMonday: false,
      officeMembers: [],
    });
    assert.strictEqual(result.shouldSend, false);
    assert.strictEqual(result.title, undefined);
  });

  test("Mardi à Vendredi : Envoyer la notification s'il y a du monde au bureau", () => {
    const result = computeDailyNotification({
      isMonday: false,
      officeMembers: ["Sophie", "Marc"],
    });
    assert.strictEqual(result.shouldSend, true);
    assert.strictEqual(result.title, "🏢 Présence au bureau aujourd'hui");
    assert.strictEqual(result.body, "Sophie et Marc sont au bureau aujourd'hui.");
  });

  test("Lundi : Toujours envoyer le rappel de planning de la semaine", () => {
    // Cas où personne n'est encore au bureau le lundi
    const resultNoOffice = computeDailyNotification({
      isMonday: true,
      officeMembers: [],
    });
    assert.strictEqual(resultNoOffice.shouldSend, true);
    assert.strictEqual(resultNoOffice.title, "📅 Planning de la semaine");
    assert.match(resultNoOffice.body!, /N'oubliez pas d'indiquer vos jours de présence/);

    // Cas où des collègues sont au bureau le lundi
    const resultWithOffice = computeDailyNotification({
      isMonday: true,
      officeMembers: ["Alexandre"],
    });
    assert.strictEqual(resultWithOffice.shouldSend, true);
    assert.match(resultWithOffice.body!, /Alexandre est au bureau/);
  });
});
