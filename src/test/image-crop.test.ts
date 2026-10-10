import { describe, expect, it } from "vitest";
import { fitRectangle, originalDimensions, validateCropDimensions } from "@/lib/imageCrop";
import { validateImageFile } from "@/lib/uploadErrors";

describe("selected image dimensions", () => {
  it("accepts 8000 per side as a maximum, not a mandatory size", () => {
    expect(validateCropDimensions(8000, 8000)).toBeNull();
    expect(validateCropDimensions(8001, 4000)).not.toBeNull();
    expect(validateCropDimensions(320, 640)).toBeNull();
    expect(validateCropDimensions(0, 500)).not.toBeNull();
    expect(validateCropDimensions(500.5, 500)).not.toBeNull();
  });
  it("keeps original non-square dimensions without upscaling", () => {
    expect(originalDimensions(600, 1200)).toEqual({ width: 600, height: 1200 });
    expect(originalDimensions(12000, 6000)).toEqual({ width: 8000, height: 4000 });
  });
  it("fits the entire source without cropping or stretching", () => {
    expect(fitRectangle(1200, 600, 600, 600)).toEqual({ x: 0, y: 150, width: 600, height: 300 });
  });
  it("allows high-resolution product files without changing other upload limits", () => {
    const file = new File([new Uint8Array(6 * 1024 * 1024)], "photo.jpg", { type: "image/jpeg" });
    expect(validateImageFile(file, "product")).toBeNull();
    expect(validateImageFile(file, "logo")).not.toBeNull();
  });
});