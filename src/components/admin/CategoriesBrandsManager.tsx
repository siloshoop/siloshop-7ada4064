import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Save } from "lucide-react";

interface Item {
  id: string;
  name: string;
  name_ar: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onChanged: () => void;
}

const useCrud = (table: "categories" | "brands") => {
  const { toast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from(table).select("id, name, name_ar").order("name_ar");
    setItems((data as any) || []);
    setLoading(false);
  };

  const create = async () => {
    if (!name.trim() || !nameAr.trim()) return;
    const { error } = await supabase.from(table).insert({ name: name.trim(), name_ar: nameAr.trim() });
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else {
      toast({ title: "تمت الإضافة" });
      setName(""); setNameAr("");
      load();
    }
  };

  const save = async (item: Item) => {
    const { error } = await supabase.from(table).update({ name: item.name, name_ar: item.name_ar }).eq("id", item.id);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else toast({ title: "تم الحفظ" });
  };

  const remove = async (id: string) => {
    if (!confirm("حذف؟")) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else { toast({ title: "تم الحذف" }); load(); }
  };

  return { items, setItems, loading, name, setName, nameAr, setNameAr, load, create, save, remove };
};

const CrudPanel = ({ table, onChanged }: { table: "categories" | "brands"; onChanged: () => void }) => {
  const c = useCrud(table);
  useEffect(() => { c.load(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
        <div className="space-y-1">
          <Label>الاسم (إنجليزي)</Label>
          <Input value={c.name} onChange={(e) => c.setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>الاسم (عربي)</Label>
          <Input value={c.nameAr} onChange={(e) => c.setNameAr(e.target.value)} />
        </div>
        <Button onClick={async () => { await c.create(); onChanged(); }}>
          <Plus className="h-4 w-4 ml-1" /> إضافة
        </Button>
      </div>

      {c.loading ? (
        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
      ) : (
        <div className="border rounded-md divide-y max-h-80 overflow-auto">
          {c.items.map((it, idx) => (
            <div key={it.id} className="flex items-center gap-2 p-2">
              <Input
                value={it.name}
                onChange={(e) => {
                  const next = [...c.items];
                  next[idx] = { ...it, name: e.target.value };
                  c.setItems(next);
                }}
              />
              <Input
                value={it.name_ar}
                onChange={(e) => {
                  const next = [...c.items];
                  next[idx] = { ...it, name_ar: e.target.value };
                  c.setItems(next);
                }}
              />
              <Button size="icon" variant="secondary" onClick={async () => { await c.save(it); onChanged(); }}>
                <Save className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="destructive" onClick={async () => { await c.remove(it.id); onChanged(); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {c.items.length === 0 && <p className="p-4 text-center text-muted-foreground text-sm">لا يوجد</p>}
        </div>
      )}
    </div>
  );
};

const CategoriesBrandsManager = ({ open, onOpenChange, onChanged }: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>إدارة الفئات والعلامات التجارية</DialogTitle>
      </DialogHeader>
      <Tabs defaultValue="categories">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="categories">الفئات</TabsTrigger>
          <TabsTrigger value="brands">العلامات التجارية</TabsTrigger>
        </TabsList>
        <TabsContent value="categories" className="pt-4">
          <CrudPanel table="categories" onChanged={onChanged} />
        </TabsContent>
        <TabsContent value="brands" className="pt-4">
          <CrudPanel table="brands" onChanged={onChanged} />
        </TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>
);

export default CategoriesBrandsManager;