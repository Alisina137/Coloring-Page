import { useGetProfiles, useGetColoringStats, useGetColoringHistory, useGetProfileBadges } from "@workspace/api-client-react";
import { Loader2, BarChart2, Trophy, BookOpen, Palette, Star, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const BADGE_DEFINITIONS: Record<string, { emoji: string; label: string; description: string }> = {
  first_page: { emoji: "🌟", label: "First Page!", description: "Created your very first coloring page" },
  page_5: { emoji: "🎨", label: "Colorful 5", description: "Created 5 coloring pages" },
  page_10: { emoji: "🏆", label: "Artist 10", description: "Created 10 coloring pages" },
  page_25: { emoji: "👑", label: "Master Artist", description: "Created 25 coloring pages" },
};

function ProfileCard({ profile }: { profile: { id: number; name: string; avatarEmoji: string; ageGroup: string; totalPages: number; totalMinutes: number; currentDifficulty: number } }) {
  const { data: badges = [] } = useGetProfileBadges(profile.id);

  const nextMilestone = profile.totalPages < 1 ? 1 : profile.totalPages < 5 ? 5 : profile.totalPages < 10 ? 10 : 25;
  const prevMilestone = nextMilestone === 1 ? 0 : nextMilestone === 5 ? 1 : nextMilestone === 10 ? 5 : 10;
  const progress = nextMilestone <= profile.totalPages ? 100 : Math.round(((profile.totalPages - prevMilestone) / (nextMilestone - prevMilestone)) * 100);

  return (
    <div className="bg-card rounded-2xl border-2 border-border p-5 shadow-md space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-4xl">{profile.avatarEmoji}</span>
        <div className="flex-1">
          <p className="font-display font-bold text-lg">{profile.name}</p>
          <p className="text-xs text-muted-foreground">Age: {profile.ageGroup} · Difficulty Lv.{profile.currentDifficulty}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: Palette, label: "Pages", value: profile.totalPages, color: "text-primary" },
          { icon: Star, label: "Badges", value: badges.length, color: "text-yellow-500" },
          { icon: TrendingUp, label: "Minutes", value: profile.totalMinutes, color: "text-green-500" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-muted/40 rounded-xl p-3 text-center">
            <Icon className={`h-5 w-5 mx-auto mb-1 ${color}`} />
            <p className="font-bold text-lg">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Progress to next badge</span>
          <span>{profile.totalPages}/{nextMilestone} pages</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {badges.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Earned Badges</p>
          <div className="flex flex-wrap gap-2">
            {badges.map(key => {
              const def = BADGE_DEFINITIONS[key];
              return def ? (
                <div key={key} title={def.description} className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1">
                  <span>{def.emoji}</span><span>{def.label}</span>
                </div>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function Dashboard() {
  const { data: profiles = [], isLoading: profilesLoading } = useGetProfiles();
  const { data: stats } = useGetColoringStats();
  const { data: history = [] } = useGetColoringHistory();

  return (
    <div className="max-w-3xl mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-2">
          <BarChart2 className="h-8 w-8 text-primary" />Parent Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">Track your children's creative progress</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Pages", value: stats?.total ?? 0, icon: Palette, color: "bg-primary/10 text-primary" },
          { label: "Profiles", value: profiles.length, icon: BookOpen, color: "bg-secondary/30 text-secondary-foreground" },
          { label: "This Week", value: history.filter(h => new Date(h.createdAt) > new Date(Date.now() - 7 * 86400000)).length, icon: TrendingUp, color: "bg-green-100 text-green-700" },
          { label: "Genres Tried", value: stats ? new Set(stats.byGenre.map(g => g.label)).size : 0, icon: Star, color: "bg-yellow-100 text-yellow-700" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`rounded-2xl p-4 ${color.split(" ")[0]} border border-border text-center shadow-sm`}>
            <Icon className={`h-6 w-6 mx-auto mb-1 ${color.split(" ")[1]}`} />
            <p className="font-bold text-2xl">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="font-display font-bold text-xl">Child Profiles</h2>
        {profilesLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : profiles.length === 0 ? (
          <div className="bg-card rounded-2xl border-2 border-dashed border-border p-8 text-center text-muted-foreground">
            No profiles yet — <a href="/profiles" className="text-primary underline">create one</a> to track progress
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {profiles.map(p => <ProfileCard key={p.id} profile={p} />)}
          </div>
        )}
      </div>

      {stats && stats.byGenre.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display font-bold text-xl">Top Genres</h2>
          <div className="bg-card rounded-2xl border-2 border-border p-5 space-y-3">
            {stats.byGenre.slice(0, 5).map(g => (
              <div key={g.label} className="flex items-center gap-3">
                <span className="text-sm font-medium w-36 truncate">{g.label}</span>
                <Progress value={Math.round((g.count / (stats.total || 1)) * 100)} className="flex-1 h-3" />
                <span className="text-sm text-muted-foreground w-8 text-right">{g.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
