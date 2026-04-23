import { describe, it, expect, beforeAll } from "vitest";
import { API_URL, loginAs } from "./helpers/auth.js";
import JSZip from "jszip";

describe("PPTX endpoints — smoke test", () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await loginAs("admin@qametrics.com");
  });

  async function fetchPptx(endpoint: string): Promise<Buffer> {
    const r = await fetch(`${API_URL}/api/reports/${endpoint}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(r.status).toBe(200);
    const ab = await r.arrayBuffer();
    return Buffer.from(ab);
  }

  async function assertIsValidPptx(buf: Buffer) {
    expect(buf.byteLength).toBeGreaterThan(20_000); // un PPTX razonable pesa >20KB
    const zip = await JSZip.loadAsync(buf);
    const names = Object.keys(zip.files);
    expect(names).toContain("[Content_Types].xml");
    expect(names).toContain("ppt/presentation.xml");
    // Al menos 3 slides (portada + cierre + algo).
    const slides = names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
    expect(slides.length).toBeGreaterThanOrEqual(3);
  }

  it(
    "weekly-pptx genera un PPTX válido",
    async () => {
      const buf = await fetchPptx("weekly-pptx?weekStart=2026-04-13");
      await assertIsValidPptx(buf);
    },
    60_000,
  );

  it(
    "monthly-pptx genera un PPTX válido",
    async () => {
      const buf = await fetchPptx("monthly-pptx?month=2026-04");
      await assertIsValidPptx(buf);
    },
    60_000,
  );

  it(
    "yearly-pptx genera un PPTX válido",
    async () => {
      const buf = await fetchPptx("yearly-pptx?year=2026");
      await assertIsValidPptx(buf);
    },
    120_000,
  );
});
