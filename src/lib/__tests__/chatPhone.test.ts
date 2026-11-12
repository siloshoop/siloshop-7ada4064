import { describe, expect, it } from "vitest";
import { chatTextHasPhone } from "@/lib/chatPhone";

describe("chat phone blocking", () => {
  it("blocks Syrian and Turkish numbers in any common writing", () => {
    for (const t of ["0944 123 456", "٠٩٤٤١٢٣٤٥٦", "+963 944-123-456", "00963944123456", "رقمي 944123456", "05310818812", "+90 531 081 88 12", "اتصل 0 9 4 4 1 2 3 4 5 6"]) {
      expect(chatTextHasPhone(t), t).toBe(true);
    }
  });

  it("allows prices, order numbers and sizes", () => {
    for (const t of ["السعر 150000 ل.س", "السعر 2,500,000 ل.س", "طلبي SO-2610-001223 و INV-2610-001223", "الكمية 3 المقاس 42", "مرحبا"]) {
      expect(chatTextHasPhone(t), t).toBe(false);
    }
  });
});
