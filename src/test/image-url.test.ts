import { describe, expect, it } from "vitest";
import { isResizableStorageImage, resizedImageUrl, responsiveImage } from "@/lib/imageUrl";

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1`;
const original = `${BASE}/object/public/product-images/abc/photo.jpg`;

describe("resized storage pictures", () => {
  it("asks the storage resizer for the requested width with the aspect ratio kept", () => {
    expect(resizedImageUrl(original, 480)).toBe(
      `${BASE}/render/image/public/product-images/abc/photo.jpg?width=480&resize=contain&quality=70`,
    );
  });

  it("keeps an existing query string on the original", () => {
    const url = resizedImageUrl(`${original}?v=2`, 240);
    expect(url).toContain("/render/image/public/product-images/abc/photo.jpg?");
    expect(new URL(url).searchParams.get("v")).toBe("2");
    expect(new URL(url).searchParams.get("width")).toBe("240");
  });

  it("leaves outside pictures, placeholders, GIFs and SVGs untouched", () => {
    expect(resizedImageUrl("https://example.com/a.jpg", 480)).toBe("https://example.com/a.jpg");
    expect(resizedImageUrl("/placeholder.svg", 480)).toBe("/placeholder.svg");
    expect(isResizableStorageImage(`${BASE}/object/public/ads/banner.gif`)).toBe(false);
    expect(isResizableStorageImage(`${BASE}/object/public/ads/logo.svg`)).toBe(false);
  });

  it("offers every candidate width and remembers the original for fallback", () => {
    const props = responsiveImage(original, [720, 240, 480], "50vw");
    expect(props.srcSet?.split(", ").map((part) => part.split(" ")[1])).toEqual(["240w", "480w", "720w"]);
    expect(props["data-original-src"]).toBe(original);
    expect(props.sizes).toBe("50vw");
  });
});
