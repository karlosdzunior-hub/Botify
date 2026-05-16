import { Layout } from "@/components/layout";
import { useGetAdminStats, useListAdminUsers } from "@workspace/api-client-react";
import { Users, Bot, Zap, Coins, Activity, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function AdminPage() {
  const { data: stats, isLoading: statsLoading } = useGetAdminStats();
  const { data: users = [], isLoading: usersLoading } = useListAdminUsers();

  return (
    <Layout title="Admin Panel">
      <div className="p-4 space-y-6">
        
        {statsLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border border-border/50 p-4 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="w-4 h-4" />
                <span className="text-xs font-medium uppercase">Total Users</span>
              </div>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <div className="text-xs text-green-500">{stats.activeUsers} active (30d)</div>
            </div>
            
            <div className="bg-card border border-border/50 p-4 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Bot className="w-4 h-4" />
                <span className="text-xs font-medium uppercase">Total Bots</span>
              </div>
              <div className="text-2xl font-bold">{stats.totalBots}</div>
              <div className="text-xs text-blue-500">{stats.runningBots} running</div>
            </div>

            <div className="bg-card border border-border/50 p-4 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Zap className="w-4 h-4" />
                <span className="text-xs font-medium uppercase">Generations</span>
              </div>
              <div className="text-2xl font-bold">{stats.totalGenerations}</div>
            </div>

            <div className="bg-card border border-border/50 p-4 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Coins className="w-4 h-4" />
                <span className="text-xs font-medium uppercase">Revenue</span>
              </div>
              <div className="text-2xl font-bold">{stats.totalRevenue}</div>
            </div>
          </div>
        ) : null}

        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Recent Users
          </h2>
          
          {usersLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {users.map(user => (
                <div key={user.id} className="bg-card border border-border/50 rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">
                      {user.firstName || user.username || 'User'} 
                      {user.username && <span className="text-muted-foreground font-normal ml-1">@{user.username}</span>}
                    </span>
                    <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">{user.plan}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>ID: {user.telegramId}</span>
                    <span>{user.credits} credits</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Joined: {format(new Date(user.createdAt), 'MMM d, yyyy')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
}
