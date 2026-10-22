import { beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const mocks = vi.hoisted(() => ({ saved: [] as Record<string, unknown>[], rpc: vi.fn(), toast: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc, from: (table: string) => {
  const chain: any = { select: () => chain, order: () => chain, eq: () => chain, limit: () => chain,
    insert: async (payload: Record<string, unknown>) => { mocks.saved.push({ ...payload, id: 'saved-category' }); return {error:null}; },
    then: (resolve: any) => resolve({data:table === 'categories' ? mocks.saved : [],error:null}) };
  return chain;
} } }));
vi.mock("@/hooks/use-toast", () => ({useToast:()=>({toast:mocks.toast})}));
vi.mock("@/lib/auditLog", () => ({logAdminAction:vi.fn()}));
vi.mock("@/lib/activationSync", () => ({broadcastActivationChange:vi.fn()}));
vi.mock("@/components/admin/AdminLayout", () => ({default:({children,actions}:any)=><div>{actions}{children}</div>}));
vi.mock("@/components/ImageUploadField", () => ({default:()=>null}));
import ManageCategories from "@/pages/admin/ManageCategories";
beforeEach(() => {cleanup();vi.clearAllMocks();mocks.saved=[];});
it("saves a new Arabic-only category with selected icon and palette and reads it back", async () => {
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><ManageCategories /></MemoryRouter></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button',{name:'إضافة فئة جديدة'}));
  fireEvent.change(screen.getByLabelText('الاسم بالعربية'),{target:{value:'فئة الاختبار'}});
  fireEvent.click(screen.getByRole('button',{name:'Laptop'}));
  fireEvent.click(screen.getByRole('button',{name:'sky'}));
  fireEvent.click(screen.getByRole('button',{name:'حفظ'}));
  await waitFor(()=>expect(mocks.saved).toHaveLength(1));
  expect(mocks.saved[0]).toMatchObject({name:'فئة الاختبار',name_ar:'فئة الاختبار',icon:'Laptop',color:'sky',is_active:true,image_url:null});
  await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getAllByText('فئة الاختبار').length).toBeGreaterThan(0);
});