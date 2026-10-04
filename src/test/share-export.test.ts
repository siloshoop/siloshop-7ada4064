import { describe, it, expect, vi, beforeEach } from "vitest";
import { toPublicUrl, buildSocialShareUrl, shareContent } from "@/lib/share";
import { buildCsv, recordsToCsv, exportFile } from "@/lib/exportFile";
import { buildCompareShareUrl } from "@/lib/shareUrl";

const PROD = "https://www.siloshop.net";

describe("share utility", () => {
  it("never returns local or internal origins", () => {
    for (const u of [
      "https://localhost/compare?products=a,b",
      "http://127.0.0.1:8080/product/1",
      "http://192.168.1.4/store/x",
      "https://id-preview--abc.lovable.app/wishlist/shared/t",
      "/favorites",
    ]) {
      const out = toPublicUrl(u);
      expect(out.startsWith(PROD)).toBe(true);
      expect(out).not.toMatch(/localhost|127\.0\.0\.1|192\.168|lovable/);
    }
    expect(toPublicUrl("https://localhost/compare?products=a,b")).toBe(`${PROD}/compare?products=a,b`);
  });

  it("builds compare links with the production domain", () => {
    expect(buildCompareShareUrl(["id1", "id2"])).toBe(`${PROD}/compare?products=id1,id2`);
  });

  it("encodes Arabic text and public URL for every platform", () => {
    const url = "https://localhost/compare?products=a,b";
    for (const p of ["whatsapp", "twitter", "facebook", "telegram"] as const) {
      const href = buildSocialShareUrl(p, url, "مقارنة بين 2 منتجات");
      expect(href).toContain(encodeURIComponent(`${PROD}/compare?products=a,b`));
      expect(decodeURIComponent(href)).not.toContain("localhost");
      if (p !== "facebook") expect(decodeURIComponent(href)).toContain("مقارنة");
    }
  });

  it("falls back to clipboard and reports cancellation", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: write }, share: undefined });
    expect(await shareContent({ text: "مفضلتي", url: "/favorites" })).toBe("copied");
    expect(write).toHaveBeenCalledWith(`مفضلتي\n${PROD}/favorites`);

    const err = Object.assign(new Error("Share canceled"), { name: "AbortError" });
    Object.assign(navigator, { share: vi.fn().mockRejectedValue(err) });
    expect(await shareContent({ url: "/x" })).toBe("cancelled");
    Object.assign(navigator, { share: undefined });
  });
});

describe("export utility", () => {
  beforeEach(() => {
    (URL as any).createObjectURL = vi.fn(() => "blob:x");
    (URL as any).revokeObjectURL = vi.fn();
  });

  it("produces valid CSV with BOM, Arabic and escaping", () => {
    const csv = buildCsv(["المنتج", "السعر"], [['قميص "أزرق", قطن', 5000]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"قميص ""أزرق"", قطن",5000');
    expect(recordsToCsv([{ a: 1, b: "x\ny" }])).toBe('\uFEFFa,b\r\n1,"x\ny"');
  });

  it("performs a real download with correct content", async () => {
    let captured: Blob | null = null;
    (URL as any).createObjectURL = vi.fn((b: Blob) => ((captured = b), "blob:x"));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const r = await exportFile(buildCsv(["h"], [["قيمة"]]), "تقرير الطلبات.csv");
    expect(r).toBe("downloaded");
    expect(click).toHaveBeenCalled();
    expect(await captured!.text()).toContain("قيمة");
  });

  it("refuses empty files instead of reporting success", async () => {
    await expect(exportFile("", "empty.csv")).rejects.toThrow();
  });
});
