import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the resend module before importing the mailer
const mockSend = vi.fn();
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

describe("mailer", () => {
  beforeEach(() => {
    mockSend.mockReset();
    process.env.RESEND_API_KEY = "re_test";
    process.env.ALERT_FROM_EMAIL = "test@qametrics.cl";
  });

  it("forwards to/cc/subject/html/replyTo to resend", async () => {
    mockSend.mockResolvedValue({ data: { id: "abc" }, error: null });
    const { sendMail } = await import("../lib/mailer.js");

    await sendMail({
      to: "juan@example.com",
      cc: ["admin@example.com"],
      subject: "Hola",
      html: "<p>test</p>",
      replyTo: "reply@example.com",
    });

    expect(mockSend).toHaveBeenCalledWith({
      from: "test@qametrics.cl",
      to: ["juan@example.com"],
      cc: ["admin@example.com"],
      subject: "Hola",
      html: "<p>test</p>",
      replyTo: "reply@example.com",
    });
  });

  it("throws on resend error", async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: "bad key" } });
    const { sendMail } = await import("../lib/mailer.js");
    await expect(
      sendMail({ to: "a@b.com", subject: "x", html: "y" }),
    ).rejects.toThrow("bad key");
  });
});
