import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/hooks/useActivityLog";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, Search, Shield, ShieldCheck, ShieldX, UserCog, Store, User, Ban, UserCheck } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface UserProfile {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: "customer" | "vendor";
  avatar_url: string | null;
  created_at: string | null;
  is_banned: boolean;
  banned_at: string | null;
  ban_reason: string | null;
}

interface UserRole {
  user_id: string;
  role: "customer" | "vendor" | "admin";
}

const ManageUsers = () => {
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [banReason, setBanReason] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      checkAdminRole();
    }
  }, [user]);

  const checkAdminRole = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (data) {
      setIsAdmin(true);
      fetchUsers();
    } else {
      toast({
        title: "غير مصرح",
        description: "هذه الصفحة مخصصة للمدراء فقط",
        variant: "destructive",
      });
      navigate("/");
    }
  };

  const fetchUsers = async () => {
    try {
      // Fetch all profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      setUsers(profilesData || []);

      // Fetch all user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      // Group roles by user_id
      const rolesMap: Record<string, string[]> = {};
      rolesData?.forEach((role: UserRole) => {
        if (!rolesMap[role.user_id]) {
          rolesMap[role.user_id] = [];
        }
        rolesMap[role.user_id].push(role.role);
      });

      setUserRoles(rolesMap);
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addRole = async (userId: string, role: "admin" | "vendor" | "customer") => {
    try {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role });

      if (error) throw error;

      toast({
        title: "تم بنجاح",
        description: `تم إضافة صلاحية ${getRoleLabel(role)}`,
      });

      fetchUsers();
    } catch (error: any) {
      if (error.code === "23505") {
        toast({
          title: "تنبيه",
          description: "هذه الصلاحية موجودة مسبقاً",
          variant: "destructive",
        });
      } else {
        toast({
          title: "خطأ",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  };

  const removeRole = async (userId: string, role: "admin" | "vendor" | "customer") => {
    if (userId === user?.id && role === "admin") {
      toast({
        title: "غير مسموح",
        description: "لا يمكنك إزالة صلاحية المدير من حسابك",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);

      if (error) throw error;

      toast({
        title: "تم بنجاح",
        description: `تم إزالة صلاحية ${getRoleLabel(role)}`,
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateProfileRole = async (userId: string, newRole: "customer" | "vendor") => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "تم بنجاح",
        description: `تم تحديث نوع الحساب إلى ${newRole === "vendor" ? "بائع" : "عميل"}`,
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const banUser = async (userId: string, reason: string) => {
    if (userId === user?.id) {
      toast({
        title: "غير مسموح",
        description: "لا يمكنك حظر نفسك",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_banned: true,
          banned_at: new Date().toISOString(),
          ban_reason: reason || null,
        })
        .eq("id", userId);

      if (error) throw error;

      // Send notification to banned user
      await supabase.from("notifications").insert({
        user_id: userId,
        title: "تم حظر حسابك",
        message: reason 
          ? `تم حظر حسابك بسبب: ${reason}. يرجى التواصل مع الدعم إذا كنت تعتقد أن هذا خطأ.`
          : "تم حظر حسابك. يرجى التواصل مع الدعم إذا كنت تعتقد أن هذا خطأ.",
        type: "warning",
      });

      // Log activity
      if (user) {
        await logActivity(user.id, "user_banned", { 
          banned_user_id: userId, 
          reason: reason || null 
        });
      }

      toast({
        title: "تم الحظر",
        description: "تم حظر المستخدم وإرسال إشعار له",
      });

      setBanReason("");
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const unbanUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_banned: false,
          banned_at: null,
          ban_reason: null,
        })
        .eq("id", userId);

      if (error) throw error;

      // Send notification to unbanned user
      await supabase.from("notifications").insert({
        user_id: userId,
        title: "تم إلغاء حظر حسابك",
        message: "تم إلغاء حظر حسابك ويمكنك الآن استخدام المنصة بشكل طبيعي.",
        type: "info",
      });

      // Log activity
      if (user) {
        await logActivity(user.id, "user_unbanned", { unbanned_user_id: userId });
      }

      toast({
        title: "تم إلغاء الحظر",
        description: "تم إلغاء حظر المستخدم وإرسال إشعار له",
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "مدير";
      case "vendor":
        return "بائع";
      case "customer":
        return "عميل";
      default:
        return role;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "vendor":
        return "default";
      case "customer":
        return "secondary";
      default:
        return "outline";
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !searchQuery ||
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.phone?.includes(searchQuery);

    const matchesRole =
      filterRole === "all" ||
      (filterRole === "admin" && userRoles[u.id]?.includes("admin")) ||
      (filterRole === "vendor" && u.role === "vendor") ||
      (filterRole === "customer" && u.role === "customer" && !userRoles[u.id]?.includes("admin")) ||
      (filterRole === "banned" && u.is_banned);

    return matchesSearch && matchesRole;
  });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-3xl font-bold">إدارة المستخدمين</h1>
              </div>
              <p className="text-muted-foreground">
                عرض وإدارة صلاحيات المستخدمين ({users.length} مستخدم)
              </p>
            </div>
          </div>

          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث بالاسم أو رقم الهاتف..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-10"
                  />
                </div>
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="فلترة حسب الدور" />
                  </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع المستخدمين</SelectItem>
                      <SelectItem value="admin">المدراء</SelectItem>
                      <SelectItem value="vendor">البائعون</SelectItem>
                      <SelectItem value="customer">العملاء</SelectItem>
                      <SelectItem value="banned">المحظورون</SelectItem>
                    </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {filteredUsers.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Users className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
                  <p className="text-muted-foreground">لا يوجد مستخدمون مطابقون للبحث</p>
                </CardContent>
              </Card>
            ) : (
              filteredUsers.map((userProfile) => (
                <Card key={userProfile.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-14 w-14">
                        <AvatarImage src={userProfile.avatar_url || undefined} />
                        <AvatarFallback className="text-lg">
                          {userProfile.full_name?.[0]?.toUpperCase() || "؟"}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="font-semibold text-lg">
                            {userProfile.full_name || "بدون اسم"}
                          </h3>
                          {userProfile.id === user?.id && (
                            <Badge variant="outline" className="text-xs">
                              أنت
                            </Badge>
                          )}
                          {userProfile.is_banned && (
                            <Badge variant="destructive" className="text-xs flex items-center gap-1">
                              <Ban className="h-3 w-3" />
                              محظور
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 mb-3">
                          {/* Profile Role Badge */}
                          <Badge
                            variant={userProfile.role === "vendor" ? "default" : "secondary"}
                            className="flex items-center gap-1"
                          >
                            {userProfile.role === "vendor" ? (
                              <Store className="h-3 w-3" />
                            ) : (
                              <User className="h-3 w-3" />
                            )}
                            {userProfile.role === "vendor" ? "بائع" : "عميل"}
                          </Badge>

                          {/* User Roles Badges */}
                          {userRoles[userProfile.id]?.map((role) => (
                            <Badge
                              key={role}
                              variant={getRoleBadgeVariant(role) as any}
                              className="flex items-center gap-1"
                            >
                              {role === "admin" && <ShieldCheck className="h-3 w-3" />}
                              {getRoleLabel(role)}
                              {!(userProfile.id === user?.id && role === "admin") && (
                                <button
                                  onClick={() => removeRole(userProfile.id, role as "admin" | "vendor" | "customer")}
                                  className="mr-1 hover:text-destructive-foreground"
                                >
                                  ×
                                </button>
                              )}
                            </Badge>
                          ))}
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          {userProfile.phone && <span>📱 {userProfile.phone}</span>}
                          {userProfile.created_at && (
                            <span>
                              انضم: {format(new Date(userProfile.created_at), "dd MMM yyyy", { locale: ar })}
                            </span>
                          )}
                          {userProfile.is_banned && userProfile.banned_at && (
                            <span className="text-destructive">
                              حُظر: {format(new Date(userProfile.banned_at), "dd MMM yyyy", { locale: ar })}
                            </span>
                          )}
                          {userProfile.is_banned && userProfile.ban_reason && (
                            <span className="text-destructive">
                              السبب: {userProfile.ban_reason}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {/* Toggle Profile Role */}
                        <Select
                          value={userProfile.role}
                          onValueChange={(value: "customer" | "vendor") =>
                            updateProfileRole(userProfile.id, value)
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="customer">عميل</SelectItem>
                            <SelectItem value="vendor">بائع</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Add Admin Role */}
                        {!userRoles[userProfile.id]?.includes("admin") && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Shield className="h-4 w-4 ml-2" />
                                جعله مدير
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>تأكيد منح صلاحية المدير</AlertDialogTitle>
                                <AlertDialogDescription>
                                  هل أنت متأكد من منح صلاحية المدير لـ{" "}
                                  <strong>{userProfile.full_name || "هذا المستخدم"}</strong>؟
                                  <br />
                                  سيتمكن من الوصول إلى جميع إعدادات النظام.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => addRole(userProfile.id, "admin")}
                                >
                                  تأكيد
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}

                        {/* Remove Admin Role */}
                        {userRoles[userProfile.id]?.includes("admin") &&
                          userProfile.id !== user?.id && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                  <ShieldX className="h-4 w-4 ml-2" />
                                  إزالة المدير
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>تأكيد إزالة صلاحية المدير</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    هل أنت متأكد من إزالة صلاحية المدير من{" "}
                                    <strong>{userProfile.full_name || "هذا المستخدم"}</strong>؟
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => removeRole(userProfile.id, "admin")}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    إزالة
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}

                        {/* Ban/Unban User */}
                        {userProfile.id !== user?.id && (
                          <>
                            {!userProfile.is_banned ? (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground">
                                    <Ban className="h-4 w-4 ml-2" />
                                    حظر
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>تأكيد حظر المستخدم</AlertDialogTitle>
                                    <AlertDialogDescription className="space-y-4">
                                      <p>
                                        هل أنت متأكد من حظر{" "}
                                        <strong>{userProfile.full_name || "هذا المستخدم"}</strong>؟
                                        <br />
                                        لن يتمكن من الوصول إلى حسابه.
                                      </p>
                                      <Input
                                        placeholder="سبب الحظر (اختياري)"
                                        value={banReason}
                                        onChange={(e) => setBanReason(e.target.value)}
                                      />
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setBanReason("")}>إلغاء</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => banUser(userProfile.id, banReason)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      حظر
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="text-green-600 border-green-600 hover:bg-green-600 hover:text-white">
                                    <UserCheck className="h-4 w-4 ml-2" />
                                    إلغاء الحظر
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>تأكيد إلغاء الحظر</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      هل أنت متأكد من إلغاء حظر{" "}
                                      <strong>{userProfile.full_name || "هذا المستخدم"}</strong>؟
                                      <br />
                                      سيتمكن من الوصول إلى حسابه مجدداً.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => unbanUser(userProfile.id)}
                                      className="bg-green-600 text-white hover:bg-green-700"
                                    >
                                      إلغاء الحظر
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ManageUsers;
