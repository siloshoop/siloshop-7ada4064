import { describe, expect, it } from "vitest";
import {
  SYRIAN_MOBILE_MAX_DIGITS,
  isSyrianMobile,
  phoneDigits,
  phoneError,
  sanitizePhoneInput,
} from "@/lib/phone";

describe("Syrian mobile number rule", () => {
  it("accepts a 10 digit number that starts with 09", () => {
    expect(phoneError("0944123456")).toBeNull();
    expect(isSyrianMobile("0944123456")).toBe(true);
    expect(phoneError("09 441 234 56")).toBeNull();
    expect(phoneError("09-44123456")).toBeNull();
  });

  it("rejects a number that is too short or does not start with 09", () => {
    expect(phoneError("094412345")).toMatch(/10 أرقام/);
    expect(phoneError("0844123456")).toMatch(/يبدأ بـ 09/);
    expect(phoneError("1944123456")).toMatch(/يبدأ بـ 09/);
    expect(phoneError("09441234567")).toMatch(/ألا يتجاوز 10 أرقام/);
    expect(phoneError("09635287499888887")).toMatch(/ألا يتجاوز 10 أرقام/);
  });

  it("asks for the number when nothing was entered", () => {
    expect(phoneError("")).toBe("رقم الهاتف مطلوب");
    expect(phoneError("   ")).toBe("رقم الهاتف مطلوب");
    expect(phoneError("abc")).toBe("رقم الهاتف مطلوب");
  });

  it("keeps digits only, so letters can never reach the field", () => {
    expect(sanitizePhoneInput("ab09c44d123456")).toBe("0944123456");
    expect(sanitizePhoneInput("0944123456x")).toBe("0944123456");
    expect(sanitizePhoneInput("0944-123 456")).toBe("0944123456");
    expect(sanitizePhoneInput("")).toBe("");
  });

  it("reads Arabic-Indic digits typed from an Arabic keyboard", () => {
    expect(phoneDigits("٠٩٤٤١٢٣٤٥٦")).toBe("0944123456");
    expect(phoneDigits("۰۹۴۴۱۲۳۴۵۶")).toBe("0944123456");
    expect(isSyrianMobile("٠٩٤٤١٢٣٤٥٦")).toBe(true);
  });

  it("caps the field at ten digits", () => {
    expect(SYRIAN_MOBILE_MAX_DIGITS).toBe(10);
    expect(phoneDigits("0944123456789012345")).toHaveLength(19);
    expect(phoneError(phoneDigits("0944123456789012345"))).toMatch(/ألا يتجاوز 10 أرقام/);
  });
});
