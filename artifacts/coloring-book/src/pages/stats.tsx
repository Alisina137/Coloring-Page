import { useGetColoringStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Palette, Sparkles, Shapes } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

export function Stats() {
  const { data: stats, isLoading } = useGetColoringStats();

  const COLORS = ['hsl(200 90% 50%)', 'hsl(45 95% 55%)', 'hsl(120 70% 45%)', 'hsl(0 80% 60%)', 'hsl(280 65% 60%)'];

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="text-center space-y-4 mb-12">
        <h1 className="font-display text-4xl font-bold text-foreground">Coloring Stats</h1>
        <p className="text-muted-foreground">The magical numbers behind all the creations!</p>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse bg-muted/50 h-32 border-0 rounded-3xl" />
          ))}
        </div>
      ) : stats ? (
        <>
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="rounded-3xl border-2 border-primary/20 bg-primary/5">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="p-3 bg-primary text-primary-foreground rounded-2xl mb-4 rotate-3">
                  <Palette className="h-8 w-8" />
                </div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Total Pages</p>
                <p className="font-display text-5xl font-bold text-primary" data-testid="text-total-count">{stats.total}</p>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-2 border-secondary/30 bg-secondary/10">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="p-3 bg-secondary text-secondary-foreground rounded-2xl mb-4 -rotate-3">
                  <Sparkles className="h-8 w-8" />
                </div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Top Genre</p>
                <p className="font-display text-3xl font-bold text-foreground truncate w-full px-2" data-testid="text-top-genre">
                  {stats.byGenre.length > 0 ? stats.byGenre[0].label : "None yet"}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-2 border-accent/20 bg-accent/5">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="p-3 bg-accent text-accent-foreground rounded-2xl mb-4 rotate-6">
                  <Shapes className="h-8 w-8" />
                </div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Most Popular</p>
                <p className="font-display text-3xl font-bold text-foreground" data-testid="text-top-gender">
                  {stats.byGender.length > 0 ? stats.byGender[0].label : "None yet"}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2 mt-8">
            <Card className="rounded-3xl border border-border shadow-sm">
              <CardHeader>
                <CardTitle className="font-display text-2xl">By Theme</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  {stats.byGenre.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.byGenre} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="label" type="category" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }} width={100} />
                        <Tooltip 
                          cursor={{ fill: 'hsl(var(--muted))' }}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                          {stats.byGenre.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">Not enough data</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border border-border shadow-sm">
              <CardHeader>
                <CardTitle className="font-display text-2xl">By Audience</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  {stats.byGender.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.byGender}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="count"
                        >
                          {stats.byGender.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">Not enough data</div>
                  )}
                  {stats.byGender.length > 0 && (
                    <div className="flex justify-center gap-4 mt-4">
                      {stats.byGender.map((entry, index) => (
                        <div key={entry.label} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                          <span className="text-sm font-medium">{entry.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}