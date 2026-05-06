import { useState, useCallback } from "react";
import {
  useGenerateColoringPage,
  useGetColoringHistory,
  useGetProfiles,
  useGetColorGuide,
  getGetColorGuideQueryOptions,
  getGetColoringHistoryQueryKey,
  getGetColoringStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Download, Wand2, RefreshCcw, Palette, ListChecks, X } from "lucide-react";
import jsPDF from "jspdf";

const GENRES = [
  "Animals", "Fantasy", "Cars & Vehicles", "Sports", "Nature & Landscapes",
  "Dinosaurs", "Space & Planets", "Princess & Fairy Tales", "Superheroes",
  "Farm Life", "Ocean & Sea Creatures", "Jungle Adventure", "Robots & Sci-Fi",
  "Holiday Themes", "Myths & Legends", "School & Education Scenes",
  "Food & Sweets", "Transportation", "Cute Cartoon Characters", "Daily Life Scenes"
];

const BADGE_DEFINITIONS: Record<string, { emoji: string; label: string; requiredPages: number }> = {
  first_page: { emoji: "🌟", label: "First Page!", requiredPages: 1 },
  page_5: { emoji: "🎨", label: "Colorful 5", requiredPages: 5 },
  page_10: { emoji: "🏆", label: "Artist 10", requiredPages: 10 },
  page_25: { emoji: "👑", label: "Master Artist", requiredPages: 25 },
};

function checkNewBadge(totalPages: number): string | null {
  const milestones = [1, 5, 10, 25];
  const keys = ["first_page", "page_5", "page_10", "page_25"];
  for (let i = milestones.length - 1; i >= 0; i--) {
    if (totalPages === milestones[i]) return keys[i];
  }
  return null;
}

function downloadFromCanvas(src: string, filter: string, filename: string) {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext("2d")!;
    ctx.filter = filter;
    ctx.drawImage(img, 0, 0);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = filename; a.click();
  };
  img.src = src;
}

async function downloadPDF(imageData: string, genre: string) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.text(`${genre} Coloring Page`, 20, 20);
  const img = new Image();
  img.src = `data:image/png;base64,${imageData}`;
  await new Promise<void>(r => { img.onload = () => r(); });
  const canvas = document.createElement("canvas");
  canvas.width = img.width; canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.filter = "grayscale(1) contrast(1.4)";
  ctx.drawImage(img, 0, 0);
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 15, 30, 180, 180);
  pdf.save(`coloring-${genre.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`);
}

export function Home() {
  const [gender, setGender] = useState<"Boy" | "Girl" | "Neutral">("Neutral");
  const [ageGroup, setAgeGroup] = useState<"3-5" | "6-8" | "9+">("6-8");
  const [genre, setGenre] = useState<string>("Animals");
  const [description, setDescription] = useState("");
  const [profileId, setProfileId] = useState<number | null>(null);
  const [result, setResult] = useState<{ id: number; src: string; genre: string } | null>(null);
  const [showColored, setShowColored] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [newBadge, setNewBadge] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { data: profiles = [] } = useGetProfiles();
  const { data: history = [] } = useGetColoringHistory();
  const guideId = result?.id ?? 0;
  const guideQueryOptions = getGetColorGuideQueryOptions(guideId);
  const { data: guide, isLoading: guideLoading } = useGetColorGuide(guideId, {
    query: { ...guideQueryOptions, enabled: showGuide && guideId > 0 },
  });

  const generateMutation = useGenerateColoringPage({
    mutation: {
      onSuccess: (data) => {
        setResult({ id: data.id, src: `data:image/png;base64,${data.imageData}`, genre: data.genre });
        setShowColored(false);
        setShowGuide(false);
        queryClient.invalidateQueries({ queryKey: getGetColoringHistoryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetColoringStatsQueryKey() });
        const total = history.length + 1;
        const badge = checkNewBadge(total);
        if (badge) { setNewBadge(badge); setTimeout(() => setNewBadge(null), 4000); }
      }
    }
  });

  const handleGenerate = () => {
    generateMutation.mutate({ data: { gender, genre, ageGroup, description: description.trim() || null, profileId } });
  };

  const handleDownloadBW = useCallback(() => {
    if (!result) return;
    downloadFromCanvas(result.src, "grayscale(1) contrast(1.4)", `coloring-${result.genre.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-bw.png`);
  }, [result]);

  const handleDownloadColored = useCallback(() => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.src;
    a.download = `coloring-${result.genre.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-colored.png`;
    a.click();
  }, [result]);

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Badge pop-up */}
      {newBadge && BADGE_DEFINITIONS[newBadge] && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in zoom-in-75 duration-300">
          <div className="bg-yellow-400 text-yellow-900 rounded-2xl px-6 py-4 shadow-2xl text-center space-y-1 border-4 border-yellow-300">
            <p className="text-4xl">{BADGE_DEFINITIONS[newBadge].emoji}</p>
            <p className="font-display font-bold text-lg">Badge Earned!</p>
            <p className="font-semibold">{BADGE_DEFINITIONS[newBadge].label}</p>
          </div>
        </div>
      )}

      <div className="text-center space-y-2">
        <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground drop-shadow-sm">
          Dream It. <span className="text-primary">Draw It.</span>{" "}
          <span className="text-secondary-foreground bg-secondary px-2 py-1 rounded-xl -rotate-2 inline-block">Color It!</span>
        </h1>
        <p className="text-lg text-muted-foreground">Choose a theme and let our magic crayons draw a brand new coloring page!</p>
      </div>

      {/* Controls */}
      <div className="bg-card p-6 rounded-3xl border-2 border-primary/20 shadow-xl space-y-5">
        {/* Profile selector */}
        {profiles.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-muted-foreground">Coloring as</Label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setProfileId(null)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${profileId === null ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}
              >
                Guest
              </button>
              {profiles.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setProfileId(p.id); setAgeGroup(p.ageGroup as any); }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${profileId === p.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}
                >
                  {p.avatarEmoji} {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label className="text-base font-display font-semibold text-primary">Who is coloring?</Label>
            <RadioGroup value={gender} onValueChange={v => setGender(v as any)} className="flex gap-4">
              {["Boy", "Girl", "Neutral"].map(g => (
                <div key={g} className="flex items-center space-x-2">
                  <RadioGroupItem value={g} id={`gender-${g}`} />
                  <Label htmlFor={`gender-${g}`} className="cursor-pointer">{g}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label className="text-base font-display font-semibold text-primary">Age / difficulty</Label>
            <RadioGroup value={ageGroup} onValueChange={v => setAgeGroup(v as any)} className="flex gap-4 flex-wrap">
              {(["3-5", "6-8", "9+"] as const).map(age => (
                <div key={age} className="flex items-center space-x-2">
                  <RadioGroupItem value={age} id={`age-${age}`} />
                  <Label htmlFor={`age-${age}`} className="cursor-pointer">
                    {age === "3-5" ? "3–5 (easy)" : age === "6-8" ? "6–8 (medium)" : "9+ (hard)"}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-base font-display font-semibold text-accent">What should we draw?</Label>
          <Select value={genre} onValueChange={setGenre}>
            <SelectTrigger className="h-12 text-base rounded-xl border-accent/30 bg-accent/5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {GENRES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-base font-display font-semibold text-accent">
            Describe it yourself <span className="text-muted-foreground font-normal text-sm">(optional)</span>
          </Label>
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. a dragon flying over a castle with a rainbow in the background..."
            className="rounded-xl resize-none border-accent/30 bg-accent/5 min-h-[70px]"
          />
        </div>

        <Button size="lg" className="w-full h-14 text-lg rounded-2xl font-bold shadow-lg transition-transform hover:-translate-y-1 active:translate-y-0"
          onClick={handleGenerate} disabled={generateMutation.isPending}>
          {generateMutation.isPending
            ? <><Loader2 className="mr-2 h-6 w-6 animate-spin" />Drawing Magic…</>
            : <><Wand2 className="mr-2 h-6 w-6" />Generate Page!</>}
        </Button>
      </div>

      {/* Error */}
      {generateMutation.isError && !generateMutation.isPending && (
        <div className="bg-destructive/10 rounded-2xl border-2 border-destructive/30 p-5 flex items-start gap-3">
          <span className="text-2xl">😬</span>
          <div>
            <p className="font-display font-bold text-destructive">Couldn't generate the page</p>
            <p className="text-sm text-muted-foreground mt-1">
              {(generateMutation.error as any)?.message?.includes("403") || (generateMutation.error as any)?.status === 403
                ? "The AI image service has reached its monthly limit. Please try again later or upgrade the plan."
                : "Something went wrong. Please check your connection and try again."}
            </p>
          </div>
        </div>
      )}

      {/* Loading */}
      {generateMutation.isPending && (
        <div className="bg-card rounded-3xl border-2 border-dashed border-border min-h-[240px] flex flex-col items-center justify-center gap-4 shadow-inner animate-pulse">
          <div className="w-20 h-20 relative">
            <div className="absolute inset-0 border-4 border-primary rounded-full animate-[spin_3s_linear_infinite] border-t-transparent" />
            <div className="absolute inset-2 border-4 border-secondary rounded-full animate-[spin_2s_linear_infinite_reverse] border-b-transparent" />
            <div className="absolute inset-4 border-4 border-accent rounded-full animate-[spin_1.5s_linear_infinite] border-l-transparent" />
          </div>
          <p className="font-display text-xl text-primary font-medium">Sharpening crayons…</p>
          <p className="text-sm text-muted-foreground">Takes about 15–30 seconds</p>
        </div>
      )}

      {/* Results */}
      {!generateMutation.isPending && result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-display font-bold text-lg">Your pages are ready!</p>
            <Button size="sm" variant="ghost" onClick={handleGenerate}>
              <RefreshCcw className="mr-2 h-4 w-4" />Try Again
            </Button>
          </div>

          {/* Two image cards */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-3 bg-card rounded-2xl border-2 border-border p-4 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display font-bold text-sm">Coloring Page</p>
                  <p className="text-xs text-muted-foreground">Print &amp; color this one</p>
                </div>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-700">B&amp;W</span>
              </div>
              <div className="rounded-xl overflow-hidden bg-white border border-border">
                <img src={result.src} alt="Coloring page" className="w-full object-contain" style={{ filter: "grayscale(1) contrast(1.4)" }} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 rounded-xl font-semibold border-2" onClick={handleDownloadBW}>
                  <Download className="mr-1 h-4 w-4" />PNG
                </Button>
                <Button size="sm" variant="outline" className="flex-1 rounded-xl font-semibold border-2" onClick={() => downloadPDF(result.src.replace("data:image/png;base64,", ""), result.genre)}>
                  <Download className="mr-1 h-4 w-4" />PDF
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-3 bg-card rounded-2xl border-2 border-border p-4 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display font-bold text-sm">Color Hint</p>
                  <p className="text-xs text-muted-foreground">Peek at the colors 🎨</p>
                </div>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-purple-100 text-purple-700">Blurred</span>
              </div>
              <div className="rounded-xl overflow-hidden bg-white border border-border cursor-pointer relative group" onClick={() => setShowColored(v => !v)}>
                <img src={result.src} alt="Color hint" className="w-full object-contain transition-all duration-300"
                  style={{ filter: showColored ? "saturate(1.4)" : "blur(10px) saturate(1.4)" }} />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <span className="bg-black/50 text-white text-xs px-3 py-1 rounded-full">
                    {showColored ? "Click to blur" : "Click to reveal!"}
                  </span>
                </div>
              </div>
              <Button size="sm" className="w-full rounded-xl font-bold bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleDownloadColored}>
                <Download className="mr-2 h-4 w-4" />Download Full Color
              </Button>
            </div>
          </div>

          {/* Color Guide */}
          <div className="bg-card rounded-2xl border-2 border-border p-4 shadow-sm">
            <button
              className="w-full flex items-center justify-between font-display font-bold text-sm"
              onClick={() => setShowGuide(v => !v)}
            >
              <span className="flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary" />Step-by-Step Color Guide</span>
              {showGuide ? <X className="h-4 w-4" /> : <span className="text-xs text-muted-foreground font-normal">Click to show</span>}
            </button>
            {showGuide && (
              <div className="mt-3 space-y-2">
                {guideLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" />Generating guide…</div>
                ) : guide ? (
                  <ol className="space-y-2">
                    {guide.steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm">
                        <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                        <span>{step.replace(/^Step \d+:\s*/i, "")}</span>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!generateMutation.isPending && !result && (
        <div className="bg-card rounded-3xl border-2 border-dashed border-border min-h-[200px] flex items-center justify-center shadow-inner">
          <div className="text-center p-8 space-y-3 opacity-50">
            <div className="w-24 h-24 mx-auto bg-muted rounded-full flex items-center justify-center">
              <Palette className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-base font-medium text-muted-foreground">Your pages will appear here!</p>
          </div>
        </div>
      )}
    </div>
  );
}
