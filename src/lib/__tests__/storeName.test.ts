import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { isStoreNameTakenError, normalizeStoreName, storeSaveErrorMessage, STORE_NAME_TAKEN_MESSAGE } from "@/lib/storeName";

describe("unique store names", () => {
  it("treats case, spacing and Arabic spelling variants as the same name", () => {
    expect(normalizeStoreName("  SILO  Shop ")).toBe(normalizeStoreName("silo shop"));
    expect(normalizeStoreName("مَتجر الأمــل")).toBe(normalizeStoreName("متجر الامل"));
    expect(normalizeStoreName("هدية")).toBe(normalizeStoreName("هديه"));
  });

  it("explains a rejected duplicate name in Arabic", () => {
    const err = { message: "store_name_taken", code: "23505" };
    expect(isStoreNameTakenError(err)).toBe(true);
    expect(storeSaveErrorMessage(err)).toBe(STORE_NAME_TAKEN_MESSAGE);
    expect(storeSaveErrorMessage({ message: "other" })).toBe("other");
  });
});
