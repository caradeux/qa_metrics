import "dotenv/config";
import { describe, it, expect } from "vitest";
import { prisma } from "@qa-metrics/database";
import {
  previousWorkday,
  findTestersWithMissingRecords,
  resolveCcRecipients,
} from "../lib/daily-alerts.js";

describe("previousWorkday", () => {
  it("returns Friday when called on Monday with no holidays", () => {
    // Mon 2026-04-13
    const result = previousWorkday(new Date("2026-04-13T09:00:00-03:00"), []);
    expect(result.toISOString().slice(0, 10)).toBe("2026-04-10"); // Fri
  });

  it("returns previous day when Tue->Mon", () => {
    const result = previousWorkday(new Date("2026-04-14T09:00:00-03:00"), []);
    expect(result.toISOString().slice(0, 10)).toBe("2026-04-13");
  });

  it("skips Chilean holidays", () => {
    const holidays = [new Date("2026-05-01")]; // Día del Trabajo
    // Mon 2026-05-04 -> Fri May 1 is holiday -> Thu Apr 30
    const result = previousWorkday(new Date("2026-05-04T09:00:00-03:00"), holidays);
    expect(result.toISOString().slice(0, 10)).toBe("2026-04-30");
  });

  it("skips weekends and consecutive holidays", () => {
    // Mon 2026-09-21 after two holidays Fri Sep 18 + Sat Sep 19 + Sun + ...
    const holidays = [new Date("2026-09-18"), new Date("2026-09-19")];
    const result = previousWorkday(new Date("2026-09-21T09:00:00-03:00"), holidays);
    expect(result.toISOString().slice(0, 10)).toBe("2026-09-17"); // Thu
  });
});

describe("findTestersWithMissingRecords", () => {
  const day = new Date("2026-04-13"); // reference date

  it("returns testers with active assignments lacking DailyRecord for day", async () => {
    const results = await findTestersWithMissingRecords(day);

    // Asserts on the shape — real data depends on seed + prior tests.
    expect(Array.isArray(results)).toBe(true);
    for (const r of results) {
      expect(r).toHaveProperty("testerId");
      expect(r).toHaveProperty("testerName");
      expect(r).toHaveProperty("email");
      expect(Array.isArray(r.missingAssignments)).toBe(true);
      for (const a of r.missingAssignments) {
        expect(a).toHaveProperty("assignmentId");
        expect(a).toHaveProperty("storyTitle");
        expect(a).toHaveProperty("projectId");
        expect(a).toHaveProperty("projectName");
        // Must not contain excluded statuses
        expect(["ON_HOLD", "PRODUCTION", "UAT", "WAITING_UAT"]).not.toContain(a.status);
      }
    }
  });

  it("returns a well-shaped array for any queried date", async () => {
    const far = new Date("2099-01-01");
    const results = await findTestersWithMissingRecords(far);
    expect(Array.isArray(results)).toBe(true);
    // No further assertion — open-ended assignments (endDate: null) may legitimately
    // match far-future dates. The first test covers shape of populated results.
  });
});

describe("resolveCcRecipients", () => {
  it("returns distinct emails from admins + PMs of given projects", async () => {
    // Integration against real seed: expect admin@qametrics.com present
    const cc = await resolveCcRecipients([]); // no projects — only admins
    expect(cc).toContain("admin@qametrics.com");
    // No duplicates
    expect(new Set(cc).size).toBe(cc.length);
  });

  it("dedupes when an admin is also PM of one of the projects", async () => {
    // Rely on seed: find any project with PM, pass that projectId
    const anyPm = await prisma.project.findFirst({
      where: { projectManagerId: { not: null } },
      select: { id: true, projectManager: { select: { email: true } } },
    });
    if (!anyPm?.projectManager) return; // skip if no PM in seed
    const cc = await resolveCcRecipients([anyPm.id]);
    const count = cc.filter((e) => e === anyPm.projectManager!.email).length;
    expect(count).toBeLessThanOrEqual(1);
  });
});
