import { useState, useCallback, useMemo } from "react";
import {
  useGenerateColoringPage,
  useColorizeColoringPage,
  useGetColoringHistory,
  useGetProfiles,
  useGetColorGuide,
  getGetColorGuideQueryOptions,
  getGetColoringHistoryQueryKey,
  getGetColoringStatsQueryKey,
} from "@workspace/api-client-react";
import type { GenerateColoringPageBody } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Loader2, Download, Wand2, RefreshCcw, Palette,
  ListChecks, X, ChevronDown, ChevronUp, Eye, EyeOff, Sparkles,
} from "lucide-react";
import jsPDF from "jspdf";

// ─── Types ───────────────────────────────────────────────────────────────────

type ResultItem = {
  id: number;
  src: string;
  coloredSrc: string | null;
  genre: string;
  seed: number;
  originalBody: GenerateColoringPageBody;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_CARDS = [
  { value: "Animals",               label: "Animals",     emoji: "🐘" },
  { value: "Dinosaurs",             label: "Dinosaurs",   emoji: "🦕" },
  { value: "Cars & Vehicles",       label: "Vehicles",    emoji: "🚗" },
  { value: "Fantasy",               label: "Fantasy",     emoji: "🐉" },
  { value: "Space & Planets",       label: "Space",       emoji: "🚀" },
  { value: "Ocean & Sea Creatures", label: "Ocean",       emoji: "🐠" },
  { value: "Farm Life",             label: "Farm",        emoji: "🐄" },
  { value: "Princess & Fairy Tales",label: "Princesses",  emoji: "👸" },
  { value: "Superheroes",           label: "Superheroes", emoji: "🦸" },
];

const ART_STYLES = [
  { value: "cute cartoon",  label: "Cute Cartoon", emoji: "😊" },
  { value: "realistic",     label: "Realistic",    emoji: "🎨" },
  { value: "kawaii",        label: "Kawaii",        emoji: "🌸" },
  { value: "fantasy",       label: "Fantasy",       emoji: "✨" },
  { value: "educational",   label: "Educational",   emoji: "📚" },
];

const BACKGROUNDS: { value: "none" | "simple" | "detailed"; label: string; desc: string }[] = [
  { value: "none",     label: "None",     desc: "Subject only" },
  { value: "simple",   label: "Simple",   desc: "Minimal scene" },
  { value: "detailed", label: "Detailed", desc: "Full scene" },
];

const LINE_THICKNESSES: { value: "thick" | "medium" | "thin"; label: string; emoji: string }[] = [
  { value: "thick",  label: "Thick",  emoji: "━" },
  { value: "medium", label: "Medium", emoji: "─" },
  { value: "thin",   label: "Thin",   emoji: "╌" },
];

const QUALITY_OPTIONS: { value: "fast" | "balanced" | "premium"; label: string; desc: string; emoji: string }[] = [
  { value: "fast",     label: "Fast",     desc: "~15s",  emoji: "⚡" },
  { value: "balanced", label: "Balanced", desc: "~30s",  emoji: "⚖️" },
  { value: "premium",  label: "Premium",  desc: "~60s",  emoji: "💎" },
];

const VARIATION_OPTIONS = [1, 2, 4] as const;

const BADGE_DEFINITIONS: Record<string, { emoji: string; label: string; requiredPages: number }> = {
  first_page: { emoji: "🌟", label: "First Page!",    requiredPages: 1  },
  page_5:     { emoji: "🎨", label: "Colorful 5",     requiredPages: 5  },
  page_10:    { emoji: "🏆", label: "Artist 10",      requiredPages: 10 },
  page_25:    { emoji: "👑", label: "Master Artist",  requiredPages: 25 },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  pdf.setFontSize(18); pdf.setFont("helvetica", "bold");
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

// ─── Sub-components ──────────────────────────────────────────────────────────

function PillButton({ label, emoji, desc, selected, onClick }: {
  label: string; emoji?: string; desc?: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center px-3 py-2 rounded-xl border-2 text-sm font-semibold transition-all
        ${selected
          ? "border-primary bg-primary/10 text-primary shadow-sm"
          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground bg-card"}`}
    >
      {emoji && <span className="text-base">{emoji}</span>}
      <span>{label}</span>
      {desc && <span className="text-[10px] font-normal opacity-60">{desc}</span>}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Home() {
  // Form state
  const [gender, setGender] = useState<"Boy" | "Girl" | "Neutral">("Neutral");
  const [ageGroup, setAgeGroup] = useState<"3-5" | "6-8" | "9+">("6-8");
  const [genre, setGenre] = useState<string>("Animals");
  const [description, setDescription] = useState("");
  const [artStyle, setArtStyle] = useState("cute cartoon");
  const [background, setBackground] = useState<"none" | "simple" | "detailed">("simple");
  const [lineThickness, setLineThickness] = useState<"thick" | "medium" | "thin">("thick");
  const [quality, setQuality] = useState<"fast" | "balanced" | "premium">("balanced");
  const [variations, setVariations] = useState<1 | 2 | 4>(1);
  const [characterName, setCharacterName] = useState("");
  const [profileId, setProfileId] = useState<number | null>(null);

  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showColored, setShowColored] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [newBadge, setNewBadge] = useState<string | null>(null);
  const [colorizingIds, setColorizingIds] = useState<Set<number>>(new Set());
  const [colorizeErrors, setColorizeErrors] = useState<Record<number, string>>({});

  // Result state
  const [results, setResults] = useState<ResultItem[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [genProgress, setGenProgress] = useState(0);

  const queryClient = useQueryClient();
  const { data: profiles = [] } = useGetProfiles();
  const { data: history = [] } = useGetColoringHistory();

  const selectedResult = results[selectedIdx] ?? null;
  const guideId = selectedResult?.id ?? 0;
  const guideQueryOptions = getGetColorGuideQueryOptions(guideId);
  const { data: guide, isLoading: guideLoading } = useGetColorGuide(guideId, {
    query: { ...guideQueryOptions, enabled: showGuide && guideId > 0 },
  });

  const generateMutation = useGenerateColoringPage();
  const colorizeMutation = useColorizeColoringPage();

  // Enhanced prompt preview (client-side, no API call)
  const previewPrompt = useMemo(() => {
    const cat = CATEGORY_CARDS.find(c => c.value === genre);
    const parts: string[] = [];
    parts.push(`${cat?.emoji ?? ""} ${cat?.label ?? genre} scene`);
    parts.push(`${artStyle} style`);
    if (description.trim()) parts.push(`"${description.trim()}"`);
    if (characterName.trim()) parts.push(`character named ${characterName.trim()}`);
    const ageLabel = ageGroup === "3-5" ? "simple (3–5 yrs)" : ageGroup === "6-8" ? "medium (6–8 yrs)" : "detailed (9+ yrs)";
    parts.push(ageLabel);
    parts.push(`${lineThickness} lines`);
    parts.push(`${background} background`);
    const gLabel = gender === "Neutral" ? "" : `${gender === "Boy" ? "boy" : "girl"}-friendly, `;
    return `${gLabel}${parts.join(" · ")}`;
  }, [genre, artStyle, description, characterName, ageGroup, lineThickness, background, gender]);

  const handleGenerate = useCallback(async () => {
    setGenerateError(null);
    setResults([]);
    setSelectedIdx(0);
    setShowColored(false);
    setShowGuide(false);
    setIsGenerating(true);
    setGenProgress(0);
    setColorizingIds(new Set());
    setColorizeErrors({});

    const body: GenerateColoringPageBody = {
      gender,
      genre,
      ageGroup,
      description: description.trim() || null,
      profileId,
      artStyle,
      background,
      lineThickness,
      quality,
      characterName: characterName.trim() || null,
    };

    const newResults: ResultItem[] = [];
    try {
      for (let i = 0; i < variations; i++) {
        const data = await generateMutation.mutateAsync({ data: body });
        const item: ResultItem = {
          id: data.id,
          src: `data:image/png;base64,${data.imageData}`,
          coloredSrc: null,
          genre: data.genre,
          seed: data.seed ?? 0,
          originalBody: body,
        };
        newResults.push(item);
        setResults([...newResults]);
        setGenProgress(i + 1);
      }
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? "";
      setGenerateError(
        msg.includes("403") || msg.includes("quota") || msg.includes("billing")
          ? "The AI image service has reached its limit. Please try again later."
          : "Something went wrong. Please check your connection and try again."
      );
    } finally {
      setIsGenerating(false);
      queryClient.invalidateQueries({ queryKey: getGetColoringHistoryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetColoringStatsQueryKey() });
      const total = history.length + newResults.length;
      const badge = checkNewBadge(total);
      if (badge) { setNewBadge(badge); setTimeout(() => setNewBadge(null), 4000); }
    }
  }, [gender, genre, ageGroup, description, profileId, artStyle, background, lineThickness, quality, variations, characterName, history.length]);

  const handleColorize = useCallback(async () => {
    if (!selectedResult) return;
    const itemId = selectedResult.id;
    setColorizeErrors(prev => { const n = { ...prev }; delete n[itemId]; return n; });
    setColorizingIds(prev => new Set(prev).add(itemId));
    try {
      const { gender: g, genre: ge, ageGroup: ag, description: d, artStyle: as_, background: bg, characterName: cn, quality: q } = selectedResult.originalBody;
      const data = await colorizeMutation.mutateAsync({
        id: itemId,
        data: {
          gender: g,
          genre: ge,
          ageGroup: ag,
          description: d ?? null,
          artStyle: as_ ?? null,
          background: bg ?? null,
          characterName: cn ?? null,
          quality: q ?? null,
          seed: selectedResult.seed,
        },
      });
      setResults(prev =>
        prev.map(r =>
          r.id === data.id
            ? { ...r, coloredSrc: `data:image/png;base64,${data.coloredImageData}` }
            : r
        )
      );
      setShowColored(true);
      queryClient.invalidateQueries({ queryKey: getGetColoringHistoryQueryKey() });
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? "";
      setColorizeErrors(prev => ({
        ...prev,
        [itemId]: msg.includes("403") || msg.includes("quota") || msg.includes("billing")
          ? "The AI image service has reached its limit. Please try again later."
          : "Couldn't generate the color version. Please try again.",
      }));
    } finally {
      setColorizingIds(prev => { const n = new Set(prev); n.delete(itemId); return n; });
    }
  }, [selectedResult, colorizeMutation, queryClient]);

  const handleDownloadBW = useCallback(() => {
    if (!selectedResult) return;
    downloadFromCanvas(selectedResult.src, "grayscale(1) contrast(1.4)", `coloring-${selectedResult.genre.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-bw.png`);
  }, [selectedResult]);

  const handleDownloadColored = useCallback(() => {
    if (!selectedResult) return;
    const src = selectedResult.coloredSrc ?? selectedResult.src;
    const a = document.createElement("a");
    a.href = src;
    a.download = `coloring-${selectedResult.genre.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-colored.png`;
    a.click();
  }, [selectedResult]);

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

      {/* Hero */}
      <div className="text-center space-y-2">
        <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground drop-shadow-sm">
          Dream It. <span className="text-primary">Draw It.</span>{" "}
          <span className="text-secondary-foreground bg-secondary px-2 py-1 rounded-xl -rotate-2 inline-block">Color It!</span>
        </h1>
        <p className="text-lg text-muted-foreground">Choose a theme and let our magic crayons draw a brand new coloring page!</p>
      </div>

      {/* Create card */}
      <div className="bg-card p-5 sm:p-6 rounded-3xl border-2 border-primary/20 shadow-xl space-y-6">

        {/* Profile selector */}
        {profiles.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-muted-foreground">Coloring as</Label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setProfileId(null)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${profileId === null ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}>
                Guest
              </button>
              {profiles.map(p => (
                <button type="button" key={p.id}
                  onClick={() => { setProfileId(p.id); setAgeGroup(p.ageGroup as any); }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${profileId === p.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}>
                  {p.avatarEmoji} {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Gender + Age */}
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
            <Label className="text-base font-display font-semibold text-primary">Age group</Label>
            <RadioGroup value={ageGroup} onValueChange={v => setAgeGroup(v as any)} className="flex gap-4 flex-wrap">
              {([["3-5", "3–5 (easy)"], ["6-8", "6–8 (medium)"], ["9+", "9+ (hard)"]] as const).map(([val, lbl]) => (
                <div key={val} className="flex items-center space-x-2">
                  <RadioGroupItem value={val} id={`age-${val}`} />
                  <Label htmlFor={`age-${val}`} className="cursor-pointer">{lbl}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>

        {/* Category cards */}
        <div className="space-y-3">
          <Label className="text-base font-display font-semibold text-accent">What should we draw?</Label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {CATEGORY_CARDS.map(card => (
              <button
                type="button"
                key={card.value}
                onClick={() => setGenre(card.value)}
                className={`flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-2xl border-2 transition-all text-center
                  ${genre === card.value
                    ? "border-primary bg-primary/10 shadow-md"
                    : "border-border bg-card hover:border-primary/40 hover:bg-primary/5"}`}
              >
                <span className="text-3xl leading-none">{card.emoji}</span>
                <span className={`text-xs font-bold leading-tight ${genre === card.value ? "text-primary" : "text-muted-foreground"}`}>{card.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Art Style */}
        <div className="space-y-2">
          <Label className="text-base font-display font-semibold text-accent">Art Style</Label>
          <div className="flex flex-wrap gap-2">
            {ART_STYLES.map(s => (
              <PillButton key={s.value} label={s.label} emoji={s.emoji} selected={artStyle === s.value} onClick={() => setArtStyle(s.value)} />
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label className="text-base font-display font-semibold text-accent">
            Describe it yourself <span className="text-muted-foreground font-normal text-sm">(optional)</span>
          </Label>
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. a dragon flying over a castle with a rainbow in the background…"
            className="rounded-xl resize-none border-accent/30 bg-accent/5 min-h-[70px]"
          />
        </div>

        {/* Enhanced Prompt Preview */}
        <div>
          <button type="button"
            onClick={() => setShowPreview(v => !v)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showPreview ? "Hide" : "Show"} enhanced prompt preview
          </button>
          {showPreview && (
            <div className="mt-2 rounded-xl bg-muted/60 border border-border p-3">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1">AI will generate:</p>
              <p className="text-sm text-foreground leading-relaxed">{previewPrompt}</p>
            </div>
          )}
        </div>

        {/* Advanced Settings */}
        <div className="border border-border rounded-2xl overflow-hidden">
          <button type="button"
            onClick={() => setShowAdvanced(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-sm font-semibold">
            <span>⚙️ Advanced Settings</span>
            {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showAdvanced && (
            <div className="p-4 space-y-5 bg-card">
              {/* Background */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Background</Label>
                <div className="flex gap-2 flex-wrap">
                  {BACKGROUNDS.map(b => (
                    <PillButton key={b.value} label={b.label} desc={b.desc} selected={background === b.value} onClick={() => setBackground(b.value)} />
                  ))}
                </div>
              </div>

              {/* Line Thickness */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Line Thickness</Label>
                <div className="flex gap-2 flex-wrap">
                  {LINE_THICKNESSES.map(t => (
                    <PillButton key={t.value} label={t.label} emoji={t.emoji} selected={lineThickness === t.value} onClick={() => setLineThickness(t.value)} />
                  ))}
                </div>
              </div>

              {/* Generation Quality */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Generation Quality</Label>
                <div className="flex gap-2 flex-wrap">
                  {QUALITY_OPTIONS.map(q => (
                    <PillButton key={q.value} label={q.label} emoji={q.emoji} desc={q.desc} selected={quality === q.value} onClick={() => setQuality(q.value)} />
                  ))}
                </div>
              </div>

              {/* Character Name */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Character Name <span className="text-muted-foreground font-normal">(optional — for consistent characters)</span>
                </Label>
                <Input
                  value={characterName}
                  onChange={e => setCharacterName(e.target.value)}
                  placeholder="e.g. Luna, Max, Ziggy…"
                  className="rounded-xl border-border bg-muted/30 max-w-xs"
                />
              </div>

              {/* Variations */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Generate Variations</Label>
                <div className="flex gap-2">
                  {VARIATION_OPTIONS.map(n => (
                    <PillButton
                      key={n}
                      label={n === 1 ? "1 Page" : `${n} Pages`}
                      selected={variations === n}
                      onClick={() => setVariations(n)}
                    />
                  ))}
                </div>
                {variations > 1 && (
                  <p className="text-xs text-muted-foreground">Each variation is generated separately — takes {variations}× longer.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Generate button */}
        <Button
          size="lg"
          className="w-full h-14 text-lg rounded-2xl font-bold shadow-lg transition-transform hover:-translate-y-1 active:translate-y-0"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating
            ? <>
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                {variations > 1 ? `Drawing ${genProgress}/${variations}…` : "Drawing Magic…"}
              </>
            : <><Wand2 className="mr-2 h-6 w-6" />Generate {variations > 1 ? `${variations} Pages` : "Page"}!</>}
        </Button>
      </div>

      {/* Error */}
      {generateError && !isGenerating && (
        <div className="bg-destructive/10 rounded-2xl border-2 border-destructive/30 p-5 flex items-start gap-3">
          <span className="text-2xl">😬</span>
          <div>
            <p className="font-display font-bold text-destructive">Couldn't generate the page</p>
            <p className="text-sm text-muted-foreground mt-1">{generateError}</p>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {isGenerating && (
        <div className="bg-card rounded-3xl border-2 border-dashed border-border min-h-[240px] flex flex-col items-center justify-center gap-4 shadow-inner">
          <div className="w-20 h-20 relative">
            <div className="absolute inset-0 border-4 border-primary rounded-full animate-[spin_3s_linear_infinite] border-t-transparent" />
            <div className="absolute inset-2 border-4 border-secondary rounded-full animate-[spin_2s_linear_infinite_reverse] border-b-transparent" />
            <div className="absolute inset-4 border-4 border-accent rounded-full animate-[spin_1.5s_linear_infinite] border-l-transparent" />
          </div>
          <p className="font-display text-xl text-primary font-medium">Sharpening crayons…</p>
          {variations > 1 && results.length > 0
            ? <p className="text-sm text-muted-foreground">{results.length} of {variations} done — generating next…</p>
            : <p className="text-sm text-muted-foreground">
                {quality === "fast" ? "~15 seconds" : quality === "premium" ? "~60 seconds" : "~30 seconds"}
              </p>}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-display font-bold text-lg">
              {results.length > 1 ? `${results.length} pages ready!` : "Your page is ready!"}
            </p>
            <Button size="sm" variant="ghost" onClick={handleGenerate} disabled={isGenerating}>
              <RefreshCcw className="mr-2 h-4 w-4" />Try Again
            </Button>
          </div>

          {/* Variation thumbnails */}
          {results.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {results.map((r, i) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { setSelectedIdx(i); setShowColored(false); setShowGuide(false); }}
                  className={`flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border-2 transition-all
                    ${selectedIdx === i ? "border-primary shadow-md scale-105" : "border-border opacity-70 hover:opacity-100 hover:border-primary/50"}`}
                >
                  <img src={r.src} alt={`Variation ${i + 1}`} className="w-full h-full object-cover" style={{ filter: "grayscale(1) contrast(1.3)" }} />
                </button>
              ))}
              {isGenerating && (
                <div className="flex-shrink-0 w-24 h-24 rounded-xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          )}

          {/* Selected result detail */}
          {selectedResult && (
            <>
              <div className="grid sm:grid-cols-2 gap-4">
                {/* B&W Coloring Page */}
                <div className="flex flex-col gap-3 bg-card rounded-2xl border-2 border-border p-4 shadow-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-display font-bold text-sm">Coloring Page</p>
                      <p className="text-xs text-muted-foreground">Print &amp; color this one</p>
                    </div>
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-700">B&amp;W</span>
                  </div>
                  <div className="rounded-xl overflow-hidden bg-white border border-border">
                    <img src={selectedResult.src} alt="Coloring page" className="w-full object-contain" style={{ filter: "grayscale(1) contrast(1.4)" }} />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 rounded-xl font-semibold border-2" onClick={handleDownloadBW}>
                      <Download className="mr-1 h-4 w-4" />PNG
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 rounded-xl font-semibold border-2"
                      onClick={() => downloadPDF(selectedResult.src.replace("data:image/png;base64,", ""), selectedResult.genre)}>
                      <Download className="mr-1 h-4 w-4" />PDF
                    </Button>
                  </div>
                </div>

                {/* Color Version */}
                <div className="flex flex-col gap-3 bg-card rounded-2xl border-2 border-border p-4 shadow-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-display font-bold text-sm">Color Version</p>
                      <p className="text-xs text-muted-foreground">Full color illustration 🎨</p>
                    </div>
                    {selectedResult.coloredSrc && (
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${showColored ? "bg-green-100 text-green-700" : "bg-purple-100 text-purple-700"}`}>
                        {showColored ? "Revealed" : "Blurred"}
                      </span>
                    )}
                  </div>

                  {selectedResult.coloredSrc ? (
                    <>
                      <div
                        className="rounded-xl overflow-hidden bg-white border border-border cursor-pointer relative group"
                        onClick={() => setShowColored(v => !v)}
                      >
                        <img
                          src={selectedResult.coloredSrc}
                          alt="Color version"
                          className="w-full object-contain transition-all duration-300"
                          style={{ filter: showColored ? "none" : "blur(12px)" }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <span className="bg-black/50 text-white text-xs px-3 py-1 rounded-full">
                            {showColored ? "Click to blur" : "Click to reveal!"}
                          </span>
                        </div>
                      </div>
                      <Button size="sm" className="w-full rounded-xl font-bold bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleDownloadColored}>
                        <Download className="mr-2 h-4 w-4" />Download Full Color
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 rounded-xl bg-muted/40 border-2 border-dashed border-border flex flex-col items-center justify-center gap-3 py-10 px-4 text-center">
                        <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                          <Sparkles className="h-6 w-6 text-accent" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground leading-snug">
                          Ready to see this in full color?<br />
                          <span className="text-xs">Generate a matching color illustration.</span>
                        </p>
                      </div>
                      {colorizeErrors[selectedResult.id] && !colorizingIds.has(selectedResult.id) && (
                        <p className="text-xs text-destructive text-center">{colorizeErrors[selectedResult.id]}</p>
                      )}
                      <Button
                        size="sm"
                        className="w-full rounded-xl font-bold bg-accent hover:bg-accent/90 text-accent-foreground"
                        onClick={handleColorize}
                        disabled={colorizingIds.has(selectedResult.id)}
                      >
                        {colorizingIds.has(selectedResult.id) ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Painting…</>
                        ) : (
                          <><Sparkles className="mr-2 h-4 w-4" />Generate Color Version</>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Color Guide */}
              <div className="bg-card rounded-2xl border-2 border-border p-4 shadow-sm">
                <button type="button"
                  className="w-full flex items-center justify-between font-display font-bold text-sm"
                  onClick={() => setShowGuide(v => !v)}
                >
                  <span className="flex items-center gap-2">
                    <ListChecks className="h-5 w-5 text-primary" />Step-by-Step Color Guide
                  </span>
                  {showGuide ? <X className="h-4 w-4" /> : <span className="text-xs text-muted-foreground font-normal">Click to show</span>}
                </button>
                {showGuide && (
                  <div className="mt-3 space-y-2">
                    {guideLoading ? (
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />Generating guide…
                      </div>
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
            </>
          )}
        </div>
      )}

      {/* Empty state */}
      {!isGenerating && results.length === 0 && !generateError && (
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
