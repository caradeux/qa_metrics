import { describe, it, expect } from "vitest";
import { renderDailyAlert } from "../templates/daily-alert.js";

describe("renderDailyAlert", () => {
  const ctx = {
    testerName: "Juan Pérez",
    dayLabel: "lunes 13 de abril de 2026",
    missingAssignments: [
      {
        storyExternalId: "HU-342",
        storyTitle: "Validación de formulario",
        projectName: "Proyecto Alfa",
        status: "EXECUTION",
      },
      {
        storyExternalId: null,
        storyTitle: "Login SSO",
        projectName: "Proyecto Beta",
        status: "TEST_DESIGN",
      },
    ],
    appUrl: "https://qametrics.cl",
  };

  it("includes tester name, day label and subject with warning", () => {
    const { subject, html } = renderDailyAlert(ctx);
    expect(subject).toContain("No registraste movimientos");
    expect(subject).toContain("lunes 13 de abril de 2026");
    expect(html).toContain("Juan Pérez");
    expect(html).toContain("lunes 13 de abril de 2026");
  });

  it("lists each missing assignment with project and story label", () => {
    const { html } = renderDailyAlert(ctx);
    expect(html).toContain("HU-342 — Validación de formulario");
    expect(html).toContain("Login SSO");
    expect(html).toContain("Proyecto Alfa");
    expect(html).toContain("Proyecto Beta");
  });

  it("includes CTA link to mi-semana", () => {
    const { html } = renderDailyAlert(ctx);
    expect(html).toContain("https://qametrics.cl/mi-semana");
  });

  it("escapes HTML in tester and title", () => {
    const { html } = renderDailyAlert({
      ...ctx,
      testerName: "<script>x</script>",
      missingAssignments: [
        { storyExternalId: null, storyTitle: "<b>pwn</b>", projectName: "p", status: "EXECUTION" },
      ],
    });
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<b>pwn</b>");
  });
});
