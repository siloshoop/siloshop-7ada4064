import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SellerProductFacts from "@/components/seller/SellerProductFacts";

const features = [
  { title: "الخامة", value: "قطن" },
  { title: "اللون", value: "أبيض" },
  { title: "النقشة", value: "حيوانية" },
  { title: "بلد المنشأ", value: "تركيا" },
  { title: "Package", value: "2 pieces" },
];

describe("SellerProductFacts", () => {
  it("shows the saved size in the seller list", () => {
    render(<SellerProductFacts features={[]} length={220} width={160} />);
    expect(screen.getByText("220 × 160 سم")).toBeInTheDocument();
  });

  it("shows the first three features and reveals the rest on request", () => {
    render(<SellerProductFacts features={features} length={null} width={null} />);
    expect(screen.getByText("قطن")).toBeInTheDocument();
    expect(screen.queryByText("تركيا")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "+2 ميزات أخرى" }));
    expect(screen.getByText("تركيا")).toBeInTheDocument();
    expect(screen.getByText("2 pieces")).toBeInTheDocument();
  });

  it("says when nothing is saved", () => {
    render(<SellerProductFacts features={null} length={null} width={null} />);
    expect(screen.getByText("لا يوجد مقاس أو ميزات محفوظة")).toBeInTheDocument();
  });
});
