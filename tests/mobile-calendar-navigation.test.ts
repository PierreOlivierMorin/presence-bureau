import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  formatDateKey,
  getMonday,
  navigateDate,
  getWeekDays,
  getDayPresenceBreakdown,
  toggleRowExpansion,
  TeamMember,
  StatusType,
} from "../src/lib/calendar-utils.js";

describe("Mobile Calendar Navigation & Row Expansion Unit Tests", () => {
  describe("formatDateKey", () => {
    test("formats date with leading zeros for month and day", () => {
      const date = new Date(2026, 4, 3); // May 3, 2026
      assert.equal(formatDateKey(date), "2026-05-03");
    });

    test("formats end of year date correctly", () => {
      const date = new Date(2026, 11, 31); // Dec 31, 2026
      assert.equal(formatDateKey(date), "2026-12-31");
    });

    test("formats beginning of year date correctly", () => {
      const date = new Date(2026, 0, 1); // Jan 1, 2026
      assert.equal(formatDateKey(date), "2026-01-01");
    });
  });

  describe("getMonday", () => {
    test("returns the same date when given a Monday", () => {
      // 2026-09-21 is a Monday
      const monday = new Date(2026, 8, 21);
      const res = getMonday(monday);
      assert.equal(formatDateKey(res), "2026-09-21");
    });

    test("returns previous Monday when given a Wednesday", () => {
      // 2026-09-23 is Wednesday -> Monday is 2026-09-21
      const wednesday = new Date(2026, 8, 23);
      const res = getMonday(wednesday);
      assert.equal(formatDateKey(res), "2026-09-21");
    });

    test("returns previous Monday when given a Sunday", () => {
      // 2026-09-27 is Sunday -> Monday is 2026-09-21
      const sunday = new Date(2026, 8, 27);
      const res = getMonday(sunday);
      assert.equal(formatDateKey(res), "2026-09-21");
    });

    test("handles month boundaries correctly", () => {
      // 2026-10-01 is Thursday -> Monday is 2026-09-28
      const date = new Date(2026, 9, 1);
      const res = getMonday(date);
      assert.equal(formatDateKey(res), "2026-09-28");
    });
  });

  describe("navigateDate - Mode Semaine (Week View)", () => {
    test("navigating NEXT in week mode jumps exactly 7 days (next week)", () => {
      const currentWeekStart = new Date("2026-09-21T00:00:00");
      const currentDateKey = "2026-09-23"; // Mercredi

      const result = navigateDate({
        currentDateKey,
        currentWeekStart,
        mode: "week",
        direction: "next",
      });

      assert.equal(result.newDateKey, "2026-09-30"); // Mercredi suivant (+7j)
      assert.equal(formatDateKey(result.newWeekStart), "2026-09-28"); // Lundi suivant (+7j)
    });

    test("navigating PREV in week mode jumps exactly 7 days back (previous week)", () => {
      const currentWeekStart = new Date("2026-09-21T00:00:00");
      const currentDateKey = "2026-09-23"; // Mercredi

      const result = navigateDate({
        currentDateKey,
        currentWeekStart,
        mode: "week",
        direction: "prev",
      });

      assert.equal(result.newDateKey, "2026-09-16"); // Mercredi précédent (-7j)
      assert.equal(formatDateKey(result.newWeekStart), "2026-09-14"); // Lundi précédent (-7j)
    });

    test("navigating multiple weeks consecutive forwards and backwards maintains consistency", () => {
      let weekStart = new Date("2026-09-21T00:00:00");
      let dateKey = "2026-09-22";

      // 3 weeks forward
      for (let i = 0; i < 3; i++) {
        const res = navigateDate({
          currentDateKey: dateKey,
          currentWeekStart: weekStart,
          mode: "week",
          direction: "next",
        });
        weekStart = res.newWeekStart;
        dateKey = res.newDateKey;
      }
      assert.equal(dateKey, "2026-10-13"); // +21 days
      assert.equal(formatDateKey(weekStart), "2026-10-12");

      // 3 weeks back
      for (let i = 0; i < 3; i++) {
        const res = navigateDate({
          currentDateKey: dateKey,
          currentWeekStart: weekStart,
          mode: "week",
          direction: "prev",
        });
        weekStart = res.newWeekStart;
        dateKey = res.newDateKey;
      }
      assert.equal(dateKey, "2026-09-22");
      assert.equal(formatDateKey(weekStart), "2026-09-21");
    });
  });

  describe("navigateDate - Mode Jour (Day View)", () => {
    test("navigating NEXT in day mode advances exactly 1 day", () => {
      const currentWeekStart = new Date("2026-09-21T00:00:00");
      const currentDateKey = "2026-09-23"; // Mercredi

      const result = navigateDate({
        currentDateKey,
        currentWeekStart,
        mode: "day",
        direction: "next",
      });

      assert.equal(result.newDateKey, "2026-09-24"); // Jeudi (+1j)
      assert.equal(formatDateKey(result.newWeekStart), "2026-09-21"); // Same week
    });

    test("navigating PREV in day mode goes back exactly 1 day", () => {
      const currentWeekStart = new Date("2026-09-21T00:00:00");
      const currentDateKey = "2026-09-23"; // Mercredi

      const result = navigateDate({
        currentDateKey,
        currentWeekStart,
        mode: "day",
        direction: "prev",
      });

      assert.equal(result.newDateKey, "2026-09-22"); // Mardi (-1j)
      assert.equal(formatDateKey(result.newWeekStart), "2026-09-21"); // Same week
    });

    test("navigating NEXT in day mode across week boundary (Sunday to Monday) updates weekStart", () => {
      const currentWeekStart = new Date("2026-09-21T00:00:00");
      const currentDateKey = "2026-09-27"; // Dimanche

      const result = navigateDate({
        currentDateKey,
        currentWeekStart,
        mode: "day",
        direction: "next",
      });

      assert.equal(result.newDateKey, "2026-09-28"); // Lundi (+1j)
      assert.equal(formatDateKey(result.newWeekStart), "2026-09-28"); // New week
    });

    test("navigating PREV in day mode across week boundary (Monday to Sunday) updates weekStart", () => {
      const currentWeekStart = new Date("2026-09-21T00:00:00");
      const currentDateKey = "2026-09-21"; // Lundi

      const result = navigateDate({
        currentDateKey,
        currentWeekStart,
        mode: "day",
        direction: "prev",
      });

      assert.equal(result.newDateKey, "2026-09-20"); // Dimanche (-1j)
      assert.equal(formatDateKey(result.newWeekStart), "2026-09-14"); // Previous Monday
    });
  });

  describe("getDayPresenceBreakdown", () => {
    const mockMembers: TeamMember[] = [
      { id: "u1", firstName: "Frédérique", lastName: "Bonenfant" },
      { id: "u2", firstName: "Allyne", lastName: "Fernandes" },
      { id: "u3", firstName: "Marc", lastName: "Tremblay" },
      { id: "u4", firstName: "Sophie", lastName: "Lavoie" },
    ];

    test("correctly identifies full day office presence", () => {
      const presencesMap: Record<string, Record<string, { am: StatusType; pm: StatusType }>> = {
        "2026-09-23": {
          u1: { am: "OFFICE", pm: "OFFICE" },
        },
      };

      const breakdown = getDayPresenceBreakdown(mockMembers, presencesMap, "2026-09-23");

      assert.equal(breakdown.atOffice.length, 1);
      assert.equal(breakdown.atOffice[0].member.id, "u1");
      assert.equal(breakdown.atOffice[0].period, "all");
      assert.equal(breakdown.notSet.length, 3);
    });

    test("correctly identifies half-day morning (AM) office presence", () => {
      const presencesMap: Record<string, Record<string, { am: StatusType; pm: StatusType }>> = {
        "2026-09-23": {
          u1: { am: "OFFICE", pm: "REMOTE" },
        },
      };

      const breakdown = getDayPresenceBreakdown(mockMembers, presencesMap, "2026-09-23");

      assert.equal(breakdown.atOffice.length, 1);
      assert.equal(breakdown.atOffice[0].member.id, "u1");
      assert.equal(breakdown.atOffice[0].period, "am");

      assert.equal(breakdown.atRemote.length, 1);
      assert.equal(breakdown.atRemote[0].member.id, "u1");
      assert.equal(breakdown.atRemote[0].period, "pm");
    });

    test("correctly identifies half-day afternoon (PM) office presence", () => {
      const presencesMap: Record<string, Record<string, { am: StatusType; pm: StatusType }>> = {
        "2026-09-23": {
          u2: { am: "NONE", pm: "OFFICE" },
        },
      };

      const breakdown = getDayPresenceBreakdown(mockMembers, presencesMap, "2026-09-23");

      assert.equal(breakdown.atOffice.length, 1);
      assert.equal(breakdown.atOffice[0].member.id, "u2");
      assert.equal(breakdown.atOffice[0].period, "pm");
    });

    test("returns empty atOffice when all members are remote, absent or not set", () => {
      const presencesMap: Record<string, Record<string, { am: StatusType; pm: StatusType }>> = {
        "2026-09-23": {
          u1: { am: "REMOTE", pm: "REMOTE" },
          u2: { am: "ABSENT", pm: "ABSENT" },
        },
      };

      const breakdown = getDayPresenceBreakdown(mockMembers, presencesMap, "2026-09-23");

      assert.equal(breakdown.atOffice.length, 0);
      assert.equal(breakdown.atRemote.length, 1);
      assert.equal(breakdown.atAbsent.length, 1);
      assert.equal(breakdown.notSet.length, 2);
    });

    test("aggregates multiple colleagues at the office", () => {
      const presencesMap: Record<string, Record<string, { am: StatusType; pm: StatusType }>> = {
        "2026-09-23": {
          u1: { am: "OFFICE", pm: "OFFICE" },
          u2: { am: "OFFICE", pm: "REMOTE" },
          u3: { am: "REMOTE", pm: "OFFICE" },
          u4: { am: "ABSENT", pm: "ABSENT" },
        },
      };

      const breakdown = getDayPresenceBreakdown(mockMembers, presencesMap, "2026-09-23");

      assert.equal(breakdown.atOffice.length, 3);
      const names = breakdown.atOffice.map((o) => o.member.firstName);
      assert.ok(names.includes("Frédérique"));
      assert.ok(names.includes("Allyne"));
      assert.ok(names.includes("Marc"));
    });

    test("correctly identifies diner slot presence and combinations (AM, Dîner, PM)", () => {
      const presencesMap: Record<
        string,
        Record<string, { am: StatusType; diner?: StatusType; pm: StatusType }>
      > = {
        "2026-09-23": {
          u1: { am: "NONE", diner: "OFFICE", pm: "NONE" },
          u2: { am: "OFFICE", diner: "OFFICE", pm: "REMOTE" },
          u3: { am: "REMOTE", diner: "OFFICE", pm: "OFFICE" },
          u4: { am: "OFFICE", diner: "OFFICE", pm: "OFFICE" },
        },
      };

      const breakdown = getDayPresenceBreakdown(mockMembers, presencesMap, "2026-09-23");

      assert.equal(breakdown.atOffice.length, 4);
      assert.equal(breakdown.atOffice.find((o) => o.member.id === "u1")?.period, "diner");
      assert.equal(breakdown.atOffice.find((o) => o.member.id === "u2")?.period, "am+diner");
      assert.equal(breakdown.atOffice.find((o) => o.member.id === "u3")?.period, "diner+pm");
      assert.equal(breakdown.atOffice.find((o) => o.member.id === "u4")?.period, "all");
    });
  });

  describe("toggleRowExpansion (Week View Row Expand/Collapse)", () => {
    test("expanding a collapsed row marks it expanded (true)", () => {
      const initial: Record<string, boolean> = {};
      const result = toggleRowExpansion(initial, "2026-09-22");
      assert.equal(result["2026-09-22"], true);
    });

    test("clicking an expanded row collapses it back (false)", () => {
      const initial: Record<string, boolean> = { "2026-09-22": true };
      const result = toggleRowExpansion(initial, "2026-09-22");
      assert.equal(result["2026-09-22"], false);
    });

    test("expanding one day does not modify other days states", () => {
      const initial: Record<string, boolean> = {
        "2026-09-21": true,
        "2026-09-22": false,
      };
      const result = toggleRowExpansion(initial, "2026-09-23");
      assert.equal(result["2026-09-21"], true);
      assert.equal(result["2026-09-22"], false);
      assert.equal(result["2026-09-23"], true);
    });

    test("supports multiple days expanded simultaneously", () => {
      let state: Record<string, boolean> = {};
      state = toggleRowExpansion(state, "2026-09-21");
      state = toggleRowExpansion(state, "2026-09-22");
      state = toggleRowExpansion(state, "2026-09-23");

      assert.equal(state["2026-09-21"], true);
      assert.equal(state["2026-09-22"], true);
      assert.equal(state["2026-09-23"], true);
    });
  });

  describe("getWeekDays (Week View 5 Days Slice)", () => {
    test("generates 7 days from Monday to Sunday", () => {
      const weekStart = new Date("2026-09-21T00:00:00");
      const days = getWeekDays(weekStart, "2026-09-24", "2026-09-23");

      assert.equal(days.length, 7);
      assert.equal(days[0].dayName, "LUN");
      assert.equal(days[0].dayNumber, 21);
      assert.equal(days[6].dayName, "DIM");
      assert.equal(days[6].dayNumber, 27);

      // Verify slice(0, 5) represents Monday to Friday
      const workDays = days.slice(0, 5);
      assert.equal(workDays.length, 5);
      assert.equal(workDays[0].dayName, "LUN");
      assert.equal(workDays[4].dayName, "VEN");
      assert.equal(workDays[4].dayNumber, 25);
    });

    test("correctly flags isSelected and isToday", () => {
      const weekStart = new Date("2026-09-21T00:00:00");
      const days = getWeekDays(weekStart, "2026-09-24", "2026-09-23");

      const wednesday = days.find((d) => d.dateKey === "2026-09-23");
      assert.ok(wednesday);
      assert.equal(wednesday.isSelected, true);
      assert.equal(wednesday.isToday, false);

      const thursday = days.find((d) => d.dateKey === "2026-09-24");
      assert.ok(thursday);
      assert.equal(thursday.isSelected, false);
      assert.equal(thursday.isToday, true);
    });
  });
});
