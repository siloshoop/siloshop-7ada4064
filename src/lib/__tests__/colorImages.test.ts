import { beforeEach, describe, expect, it, vi } from "vitest";
import { galleryImages } from "@/lib/productGallery";

const writes: { op: string; payload?: any }[] = [];
vi.mock("@/integrations/supabase/client", () => {
  const table = () => ({
    select: () => ({ eq: async () => ({ data: [], error: null }) }),
    insert: async (payload: any) => { writes.push({ op: "insert", payload }); return { error: null }; },
    update: (payload: any) => ({ eq: async () => { writes.push({ op: "update", payload }); return { error: null }; } }),
    delete: () => ({ in: async () => ({ error: null }) }),
  });
  return { supabase: { from: table } };
});

import { syncColorSizeVariants } from "@/lib/productVariantsSync";

describe("color pictures", () => {
  beforeEach(() => { writes.length = 0; });

  it("saves each color's picture on every size of that color", async () => {
    await syncColorSizeVariants(
      "p1",
      [
        { color: "وردي", size: "M", stock_quantity: "3", price: "" },
        { color: "وردي", size: "L", stock_quantity: "2", price: "" },
        { color: "أزرق", size: "M", stock_quantity: "1", price: "" },
      ],
      "size",
      { "وردي": "https://x/pink.jpg" },
    );
    expect(writes.map((w) => w.payload.image_url)).toEqual(["https://x/pink.jpg", "https://x/pink.jpg", null]);
  });

  it("shows the chosen color picture first in the gallery without repeating it", () => {
    expect(galleryImages("b.jpg", ["a.jpg", "b.jpg"], "a.jpg")).toEqual(["b.jpg", "a.jpg"]);
    expect(galleryImages(null, [], "main.jpg")).toEqual(["main.jpg"]);
  });
});
