import { describe, expect, it } from "vitest";
import { validateCouponDates } from "@/lib/couponDates";

describe("coupon creation dates", () => {
  it("preserves optional dates rather than inventing a start or expiry", () => {
    expect(validateCouponDates("", "")).toEqual({ starts_at: null, expires_at: null });
    expect(validateCouponDates("", "2026-10-16T20:30").starts_at).toBeNull();
  });
  it("accepts expiry strictly after start and converts local time to UTC once", () => {
    expect(validateCouponDates("2026-10-15T20:30", "2026-10-16T20:30")).toEqual({
      starts_at: new Date(2026, 9, 15, 20, 30).toISOString(),
      expires_at: new Date(2026, 9, 16, 20, 30).toISOString(),
    });
  });
  it("normalizes Arabic and Persian numerals without reversing month/day", () => {
    expect(validateCouponDates("٢٠٢٦-١٠-١٥T٢٠:٣٠", "۲۰۲۶-۱۰-۱۶T۲۰:۳۰"))
      .toEqual(validateCouponDates("2026-10-15T20:30", "2026-10-16T20:30"));
  });
  it("rejects expiry before start", () => {
    expect(() => validateCouponDates("2026-10-16T20:30", "2026-10-15T20:30")).toThrow();
  });
  it("rejects expiry equal to start", () => {
    expect(() => validateCouponDates("2026-10-15T20:30", "2026-10-15T20:30")).toThrow();
  });
  it("rejects invalid calendar dates rather than rolling them into another month", () => {
    expect(() => validateCouponDates("2026-02-30T12:00", "")).toThrow();
    expect(() => validateCouponDates("", "2026-10-15T25:00")).toThrow();
  });
  it("never guesses ambiguous localized slash-separated dates", () => {
    expect(() => validateCouponDates("15/10/2026 20:30", "")).toThrow();
  });
});