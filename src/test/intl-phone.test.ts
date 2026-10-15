import { describe, expect, it } from "vitest";
import { validateIntlPhone } from "@/lib/intlPhone";
import { ERROR_TOAST_MS, SUCCESS_TOAST_MS } from "@/hooks/use-toast";

describe("registration phone per country", () => {
  it("accepts valid Syrian mobiles with or without the leading 0", () => {
    expect(validateIntlPhone("SY", "944123456").e164).toBe("+963944123456");
    expect(validateIntlPhone("SY", "0944123456").e164).toBe("+963944123456");
  });
  it("rejects too short and too long Syrian numbers", () => {
    expect(validateIntlPhone("SY", "94412").error).toMatch(/قصير/);
    expect(validateIntlPhone("SY", "9441234567890").error).toMatch(/طويل/);
  });
  it("validates other countries by their own plan", () => {
    expect(validateIntlPhone("TR", "5321234567").e164).toBe("+905321234567");
    expect(validateIntlPhone("SA", "501234567").e164).toBe("+966501234567");
    expect(validateIntlPhone("DE", "15123456789").e164).toBe("+4915123456789");
    expect(validateIntlPhone("US", "2015550123").e164).toBe("+12015550123");
    expect(validateIntlPhone("TR", "1234567890").error).not.toBeNull();
  });
  it("requires a number", () => {
    expect(validateIntlPhone("SY", "").error).toBe("رقم الهاتف مطلوب");
  });
});

describe("toast timing", () => {
  it("success hides after 3s and errors stay longer", () => {
    expect(SUCCESS_TOAST_MS).toBe(3000);
    expect(ERROR_TOAST_MS).toBeGreaterThan(SUCCESS_TOAST_MS);
  });
});
