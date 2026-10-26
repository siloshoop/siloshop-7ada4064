import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen, waitFor, cleanup } from "@testing-library/react";
import { EMPTY_STORE, storeSettingsSchema, storeSettingsArgs } from "@/lib/storeSettings";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), toast: vi.fn(), saved: { store_name: "متجر محفوظ", store_description: "وصف سابق", city: "دمشق", address: "شارع الاختبار", contact_phone: "+963944123456" } as Record<string, any> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));
const testUser = { id: "seller-a" };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: testUser }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/lib/storeAssets", () => ({ resolveStoreAssetUrl: async () => null }));
vi.mock("@/components/ImageUploadField", () => ({ default: () => null }));
vi.mock("@/components/seller/SellerLayout", () => ({ default: ({ children, actions }: any) => <div>{actions}{children}</div> }));
import SellerStore from "@/pages/seller/SellerStore";
beforeEach(() => {
  cleanup(); vi.clearAllMocks();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  mocks.saved = { store_name: "متجر محفوظ", store_description: "وصف سابق", city: "دمشق", address: "شارع الاختبار", contact_phone: "+963944123456" };
  mocks.from.mockImplementation(() => {
    const chain: any = { select: vi.fn(() => chain), eq: vi.fn(() => chain), order: vi.fn(() => chain), limit: vi.fn(() => chain), maybeSingle: async () => ({ data: { ...mocks.saved }, error: null }) };
    return chain;
  });
  mocks.rpc.mockImplementation(async (_name, args) => { Object.entries(args._profile).forEach(([key, value]) => { mocks.saved[key.slice(1)] = value as string; }); mocks.saved.shipping_all_provinces = args._all_provinces; mocks.saved.shipping_provinces = args._provinces; return { error: null }; });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("seller store settings", () => {
  it("chooses specific provinces, saves and reads the same coverage back", async () => {
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><SellerStore /></MemoryRouter></QueryClientProvider>);
    await screen.findByDisplayValue("متجر محفوظ");
    fireEvent.click(screen.getByRole("radio", { name: "محافظات محددة" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /^دمشق$/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "حلب" }));
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("seller_update_store_settings", expect.objectContaining({ _all_provinces: false, _provinces: ["دمشق", "حلب"] })));
    expect(mocks.saved.shipping_all_provinces).toBe(false);
    expect(mocks.saved.shipping_provinces).toEqual(["دمشق", "حلب"]);
    await waitFor(() => expect(screen.getByRole("radio", { name: "محافظات محددة" })).toBeChecked());
    expect(screen.getByRole("checkbox", { name: /^دمشق$/ })).toBeChecked();
  });
  it("rejects an empty specific-province selection before saving", async () => {
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><SellerStore /></MemoryRouter></QueryClientProvider>);
    await screen.findByDisplayValue("متجر محفوظ");
    fireEvent.click(screen.getByRole("radio", { name: "محافظات محددة" }));
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "تحقق من محافظات الشحن" }));
  });
  it("requires a store name", () => { expect(storeSettingsSchema.safeParse(EMPTY_STORE).success).toBe(false); });
  it("normalizes Syrian Arabic digits to the validated international number", () => {
    const data = storeSettingsSchema.parse({ ...EMPTY_STORE, store_name: "متجري", contact_phone: "٠٩٤٤١٢٣٤٥٦" });
    expect(data.contact_phone).toBe("+963944123456");
  });
  it("rejects invalid phones and unsafe images", () => {
    expect(storeSettingsSchema.safeParse({ ...EMPTY_STORE, store_name: "متجري", contact_phone: "12" }).success).toBe(false);
    expect(storeSettingsSchema.safeParse({ ...EMPTY_STORE, store_name: "متجري", logo_url: "javascript:alert(1)" }).success).toBe(false);
  });
  it("sends empty cleared fields without seller identity or permission fields", () => {
    const args = storeSettingsArgs(storeSettingsSchema.parse({ ...EMPTY_STORE, store_name: "متجري" }));
    expect(args._address).toBe(""); expect(args._contact_phone).toBe("");
    expect(Object.keys(args)).not.toContain("_user_id"); expect(Object.keys(args)).not.toContain("_status");
  });
  it("loads existing data, saves through the existing RPC, and reads back without inserting duplicates", async () => {
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><SellerStore /></MemoryRouter></QueryClientProvider>);
    await screen.findByDisplayValue("متجر محفوظ");
    fireEvent.change(screen.getByLabelText("اسم المتجر"), { target: { value: "اسم محدث" } });
    fireEvent.change(screen.getByLabelText("المدينة"), { target: { value: "حلب" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("seller_update_store_settings", expect.objectContaining({ _profile: expect.objectContaining({ _store_name: "اسم محدث", _city: "حلب" }), _all_provinces: true, _provinces: [] })));
    await screen.findByDisplayValue("اسم محدث"); expect(mocks.saved.city).toBe("حلب");
    expect(mocks.from).toHaveBeenCalledTimes(2);
    expect(mocks.from.mock.results[0].value.eq).toHaveBeenCalledWith("user_id", "seller-a");
    expect(mocks.from.mock.results[0].value.eq).toHaveBeenCalledWith("status", "approved");
  });
  it("retains edits and reports a rejected save", async () => {
    mocks.rpc.mockResolvedValue({ error: new Error("غير مسموح") });
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><SellerStore /></MemoryRouter></QueryClientProvider>);
    await screen.findByDisplayValue("متجر محفوظ");
    fireEvent.change(screen.getByLabelText("اسم المتجر"), { target: { value: "غير محفوظ" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "تعذّر حفظ بيانات المتجر", variant: "destructive" })));
    expect(screen.getByLabelText("اسم المتجر")).toHaveValue("غير محفوظ"); expect(mocks.saved.store_name).toBe("متجر محفوظ");
  });
});