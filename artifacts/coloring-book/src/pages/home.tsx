import { useState } from "react";
import { useGenerateColoringPage, getGetColoringHistoryQueryKey, getGetColoringStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Download, Wand2, RefreshCcw, Palette } from "lucide-react";

const GENRES = [
  "Animals", "Fantasy", "Cars & Vehicles", "Sports", "Nature & Landscapes",
  "Dinosaurs", "Space & Planets", "Princess & Fairy Tales", "Superheroes",
  "Farm Life", "Ocean & Sea Creatures", "Jungle Adventure", "Robots & Sci-Fi",
  "Holiday Themes", "Myths & Legends", "School & Education Scenes",
  "Food & Sweets", "Transportation", "Cute Cartoon Characters", "Daily Life Scenes"
];

function ImageCard({
  title,
  subtitle,
  src,
  filename,
  badge,
  badgeColor,
}: {
  title: string;
  subtitle: string;
  src: string;
  filename: string;
  badge: string;
  badgeColor: string;
}) {
  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = src;
    a.download = filename;
    a.click();
  };

  return (
    <div className="flex flex-col gap-3 bg-card rounded-2xl border-2 border-border p-4 shadow-md animate-in zoom-in-95 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display font-bold text-base text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${badgeColor}`}>{badge}</span>
      </div>
      <div className="relative overflow-hidden rounded-xl bg-white border border-border">
        <img
          src={src}
          alt={title}
          className="w-full object-contain"
        />
      </div>
      <Button
        size="sm"
        variant="outline"
        className="w-full rounded-xl font-semibold border-2"
        onClick={handleDownload}
      >
        <Download className="mr-2 h-4 w-4" />
        Download {title}
      </Button>
    </div>
  );
}

export function Home() {
  const [gender, setGender] = useState<"Boy" | "Girl" | "Neutral">("Neutral");
  const [ageGroup, setAgeGroup] = useState<"3-5" | "6-8" | "9+">("6-8");
  const [genre, setGenre] = useState<string>("Animals");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<{ bw: string; colored: string | null; genre: string } | null>(null);

  const queryClient = useQueryClient();

  const generateMutation = useGenerateColoringPage({
    mutation: {
      onSuccess: (data) => {
        setResult({
          bw: `data:image/png;base64,${data.imageData}`,
          colored: data.coloredImageData ? `data:image/png;base64,${data.coloredImageData}` : null,
          genre: data.genre,
        });
        queryClient.invalidateQueries({ queryKey: getGetColoringHistoryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetColoringStatsQueryKey() });
      }
    }
  });

  const handleGenerate = () => {
    generateMutation.mutate({
      data: {
        gender,
        genre,
        ageGroup,
        description: description.trim() || null,
      }
    });
  };

  const slug = result?.genre.toLowerCase().replace(/[^a-z0-9]+/g, "-") ?? "page";

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-3">
        <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground drop-shadow-sm">
          Dream It. <span className="text-primary">Draw It.</span>{" "}
          <span className="text-secondary-foreground bg-secondary px-2 py-1 rounded-xl -rotate-2 inline-block">Color It!</span>
        </h1>
        <p className="text-lg text-muted-foreground">
          Choose a theme and let our magic crayons draw a brand new coloring page just for you!
        </p>
      </div>

      <div className="bg-card p-6 rounded-3xl border-2 border-primary/20 shadow-xl space-y-6">
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="space-y-3">
            <Label className="text-base font-display font-semibold text-primary">Who is coloring?</Label>
            <RadioGroup
              value={gender}
              onValueChange={(v) => setGender(v as any)}
              className="flex gap-4"
            >
              {["Boy", "Girl", "Neutral"].map((g) => (
                <div key={g} className="flex items-center space-x-2">
                  <RadioGroupItem value={g} id={`gender-${g}`} data-testid={`input-gender-${g.toLowerCase()}`} />
                  <Label htmlFor={`gender-${g}`} className="cursor-pointer">{g}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-display font-semibold text-primary">Age group</Label>
            <RadioGroup
              value={ageGroup}
              onValueChange={(v) => setAgeGroup(v as any)}
              className="flex gap-4 flex-wrap"
            >
              {(["3-5", "6-8", "9+"] as const).map((age) => (
                <div key={age} className="flex items-center space-x-2">
                  <RadioGroupItem value={age} id={`age-${age}`} data-testid={`input-age-${age}`} />
                  <Label htmlFor={`age-${age}`} className="cursor-pointer">
                    {age === "3-5" ? "3–5 (simple)" : age === "6-8" ? "6–8 (medium)" : "9+ (detailed)"}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-base font-display font-semibold text-accent">What should we draw?</Label>
          <Select value={genre} onValueChange={setGenre}>
            <SelectTrigger className="h-12 text-base rounded-xl border-accent/30 bg-accent/5 focus:ring-accent" data-testid="select-genre">
              <SelectValue placeholder="Pick a theme" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {GENRES.map((g) => (
                <SelectItem key={g} value={g} data-testid={`select-option-${g.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-base font-display font-semibold text-accent">
            Describe it yourself{" "}
            <span className="text-muted-foreground font-normal text-sm">(optional)</span>
          </Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. a dragon flying over a castle with a rainbow in the background..."
            className="rounded-xl resize-none border-accent/30 bg-accent/5 focus:ring-accent min-h-[80px]"
            data-testid="input-description"
          />
        </div>

        <Button
          size="lg"
          className="w-full h-14 text-lg rounded-2xl font-bold shadow-lg transition-transform hover:-translate-y-1 active:translate-y-0"
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
          data-testid="button-generate"
        >
          {generateMutation.isPending ? (
            <><Loader2 className="mr-2 h-6 w-6 animate-spin" />Drawing Magic...</>
          ) : (
            <><Wand2 className="mr-2 h-6 w-6" />Generate Page!</>
          )}
        </Button>
      </div>

      {generateMutation.isPending && (
        <div className="bg-card rounded-3xl border-2 border-border border-dashed min-h-[260px] flex flex-col items-center justify-center gap-4 shadow-inner animate-pulse">
          <div className="w-20 h-20 relative">
            <div className="absolute inset-0 border-4 border-primary rounded-full animate-[spin_3s_linear_infinite] border-t-transparent" />
            <div className="absolute inset-2 border-4 border-secondary rounded-full animate-[spin_2s_linear_infinite_reverse] border-b-transparent" />
            <div className="absolute inset-4 border-4 border-accent rounded-full animate-[spin_1.5s_linear_infinite] border-l-transparent" />
          </div>
          <p className="font-display text-xl text-primary font-medium">Creating both versions…</p>
          <p className="text-sm text-muted-foreground">This takes about 30–60 seconds</p>
        </div>
      )}

      {!generateMutation.isPending && result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-display font-bold text-lg text-foreground">Your pages are ready!</p>
            <Button size="sm" variant="ghost" onClick={handleGenerate} data-testid="button-regenerate">
              <RefreshCcw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <ImageCard
              title="Coloring Page"
              subtitle="Print this and color it in"
              src={result.bw}
              filename={`coloring-page-${slug}.png`}
              badge="B&W"
              badgeColor="bg-gray-100 text-gray-700"
            />
            {result.colored && (
              <ImageCard
                title="Color Reference"
                subtitle="Use this as your guide"
                src={result.colored}
                filename={`coloring-reference-${slug}.png`}
                badge="Colored"
                badgeColor="bg-green-100 text-green-700"
              />
            )}
          </div>
        </div>
      )}

      {!generateMutation.isPending && !result && (
        <div className="bg-card rounded-3xl border-2 border-border border-dashed min-h-[200px] flex items-center justify-center shadow-inner">
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
