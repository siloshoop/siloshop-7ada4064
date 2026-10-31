import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), toast: vi.fn(), signOut: vi.fn(async () => ({ error: null })) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: mocks.invoke }, auth: { signOut: mocks.signOut } } }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
import DeleteStoreCard from "@/components/seller/DeleteStoreCard";
import DeleteAccountCard from "@/components/account/DeleteAccountCard";
import { requestSellerDeletion } from "@/lib/sellerDeletion";
beforeEach(() => { cleanup(); vi.clearAllMocks(); });
afterEach(cleanup);
const mount = (account = false) => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter>{account ? <DeleteAccountCard email="isolated@example.test" /> : <DeleteStoreCard />}</MemoryRouter></QueryClientProvider>);
it("cancelling store confirmation makes no destructive request", async () => {
  mount(); fireEvent.click(screen.getByRole("button", { name: "حذف المتجر" })); fireEvent.click(screen.getByRole("button", { name: "إلغاء" }));
  expect(mocks.invoke).not.toHaveBeenCalled();
});
it("store deletion requires both password and exact confirmation", async () => {
  mount(); fireEvent.click(screen.getByRole("button", { name: "حذف المتجر" }));
  fireEvent.change(screen.getByLabelText("كلمة المرور"), { target: { value: "isolated-password" } });
  fireEvent.change(screen.getByLabelText("اكتب «حذف»"), { target: { value: "wrong" } });
  fireEvent.click(screen.getByRole("button", { name: "حذف نهائي" })); expect(mocks.invoke).not.toHaveBeenCalled();
  mocks.invoke.mockResolvedValue({ data: { success: true }, error: null });
  fireEvent.change(screen.getByLabelText("اكتب «حذف»"), { target: { value: "حذف" } }); fireEvent.click(screen.getByRole("button", { name: "حذف نهائي" }));
  await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("delete-own-store", { body: { password: "isolated-password", confirmation: "حذف" } }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "تم حذف المتجر" })));
  expect(mocks.signOut).not.toHaveBeenCalled();
});
it("account success signs out only after confirmed successful deletion", async () => {
  mocks.invoke.mockResolvedValue({ data: { success: true }, error: null }); mount(true);
  fireEvent.click(screen.getByRole("button", { name: "حذف حسابي" }));
  fireEvent.change(screen.getByLabelText("كلمة المرور"), { target: { value: "isolated-password" } });
  fireEvent.change(screen.getByLabelText("اكتب «حذف»"), { target: { value: "حذف" } }); fireEvent.click(screen.getByRole("button", { name: "حذف نهائي" }));
  await waitFor(() => expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" }));
  expect(mocks.invoke).toHaveBeenCalledWith("delete-own-account", { body: { password: "isolated-password", confirmation: "حذف" } });
});
it("non-2xx response preserves meaningful retention error instead of generic failure", async () => {
  mocks.invoke.mockResolvedValue({ data: null, error: { context: new Response(JSON.stringify({ error: "retention_review_required" }), { status: 409 }) } });
  await expect(requestSellerDeletion("account", "isolated-password", "حذف")).rejects.toThrow("سياسة الاحتفاظ القانونية");
  expect(mocks.signOut).not.toHaveBeenCalled();
});