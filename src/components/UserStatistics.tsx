import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, UserX, UserPlus, TrendingUp, Calendar } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";

interface UserStats {
  total: number;
  active: number;
  banned: number;
  customers: number;
  vendors: number;
  newThisWeek: number;
  newThisMonth: number;
}

interface DailyStats {
  date: string;
  count: number;
}

const UserStatistics = () => {
  const [stats, setStats] = useState<UserStats>({
    total: 0,
    active: 0,
    banned: 0,
    customers: 0,
    vendors: 0,
    newThisWeek: 0,
    newThisMonth: 0,
  });
  const [dailyRegistrations, setDailyRegistrations] = useState<DailyStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch all profiles
        const { data: profiles, error } = await supabase
          .from("profiles")
          .select("id, role, is_banned, created_at");

        if (error) throw error;

        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const total = profiles?.length || 0;
        const banned = profiles?.filter(p => p.is_banned).length || 0;
        const active = total - banned;
        const customers = profiles?.filter(p => p.role === "customer").length || 0;
        const vendors = profiles?.filter(p => p.role === "vendor").length || 0;
        const newThisWeek = profiles?.filter(p => new Date(p.created_at) >= weekAgo).length || 0;
        const newThisMonth = profiles?.filter(p => new Date(p.created_at) >= monthAgo).length || 0;

        setStats({
          total,
          active,
          banned,
          customers,
          vendors,
          newThisWeek,
          newThisMonth,
        });

        // Calculate daily registrations for the last 7 days
        const dailyData: { [key: string]: number } = {};
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          const dateStr = date.toLocaleDateString('ar-SY', { weekday: 'short' });
          dailyData[dateStr] = 0;
        }

        profiles?.forEach(p => {
          const createdAt = new Date(p.created_at);
          if (createdAt >= weekAgo) {
            const dateStr = createdAt.toLocaleDateString('ar-SY', { weekday: 'short' });
            if (dailyData[dateStr] !== undefined) {
              dailyData[dateStr]++;
            }
          }
        });

        setDailyRegistrations(
          Object.entries(dailyData).map(([date, count]) => ({ date, count }))
        );
      } catch (error) {
        console.error("Error fetching user stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const pieData = [
    { name: "نشط", value: stats.active, color: "hsl(var(--primary))" },
    { name: "محظور", value: stats.banned, color: "hsl(var(--destructive))" },
  ];

  const roleData = [
    { name: "عملاء", value: stats.customers, color: "hsl(var(--primary))" },
    { name: "بائعين", value: stats.vendors, color: "hsl(var(--secondary))" },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded w-24"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-16"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-r-4 border-r-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المستخدمين</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.customers} عميل • {stats.vendors} بائع
            </p>
          </CardContent>
        </Card>

        <Card className="border-r-4 border-r-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">المستخدمين النشطين</CardTitle>
            <UserCheck className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.active}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? ((stats.active / stats.total) * 100).toFixed(1) : 0}% من الإجمالي
            </p>
          </CardContent>
        </Card>

        <Card className="border-r-4 border-r-destructive">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">المستخدمين المحظورين</CardTitle>
            <UserX className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.banned}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? ((stats.banned / stats.total) * 100).toFixed(1) : 0}% من الإجمالي
            </p>
          </CardContent>
        </Card>

        <Card className="border-r-4 border-r-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">التسجيلات الجديدة</CardTitle>
            <UserPlus className="h-4 w-4 text-info" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-info">{stats.newThisWeek}</div>
            <p className="text-xs text-muted-foreground">
              هذا الأسبوع • {stats.newThisMonth} هذا الشهر
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              حالة المستخدمين
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* User Roles Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              أنواع المستخدمين
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={roleData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {roleData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Daily Registrations Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              التسجيلات اليومية (آخر 7 أيام)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyRegistrations}>
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserStatistics;
