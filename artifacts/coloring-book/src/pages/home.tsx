import { useState, useRef, useEffect, useCallback } from "react";
import { useGenerateColoringPage, getGetColoringHistoryQueryKey, getGetColoringStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Download, Wand2, RefreshCcw, Palette, Eye } from "lucide-react";

const GENRES = [
  "Animals", "Fantasy", "Cars & Vehicles", "Sports", "Nature & Landscapes",
  "Dinosaurs", "Space & Planets", "Princess & Fairy Tales", "Superheroes",
  "Farm Life", "Ocean & Sea Creatures", "Jungle Adventure", "Robots & Sci-Fi",
  "Holiday Themes", "Myths & Legends", "School & Education Scenes",
  "Food & Sweets", "Transportation", "Cute Cartoon Characters", "Daily Life Scenes"
];

function useColorizedCanvas(imageData: string | null) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!imageData || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageDataObj.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const brightness = (r + g + b) / 3;
        if (brightness > 200) {
          data[i] = 255; data[i + 1] = 255; data[i + 2] = 255;
        } else {
          const t = 1 - brightness / 255;
          data[i] = Math.round(30 + t * 20);
          data[i + 1] = Math.round(80 + t * 60);
          data[i + 2] = Math.round(200 + t * 55);
        }
      }
      ctx.putImageData(imageDataObj, 0, 0);
    };
    img.src = `data:image/png;base64,${imageData}`;
  }, [imageData]);

  return canvasRef;
}

export function Home() {
  const [gender, setGender] = useState<"Boy" | "Girl" | "Neutral">("Neutral");
  const [ageGroup, setAgeGroup] = useState<"3-5" | "6-8" | "9+">("6-8");
  const [genre, setGenre] = useState<string>("Animals");
  const [description, setDescription] = useState("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [showColored, setShowColored] = useState(false);

  const canvasRef = useColorizedCanvas(generatedImage);
  const queryClient = useQueryClient();

  const generateMutation = useGenerateColoringPage({
    mutation: {
      onSuccess: (data) => {
        setGeneratedImage(data.imageData);
        setShowColored(false);
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

  const handleDownload = useCallback(() => {
    if (!generatedImage) return;
    if (showColored && canvasRef.current) {
      const a = document.createElement("a");
      a.href = canvasRef.current.toDataURL("image/png");
      a.download = `coloring-page-${genre.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-colored.png`;
      a.click();
    } else {
      const a = document.createElement("a");
      a.href = `data:image/png;base64,${generatedImage}`;
      a.download = `coloring-page-${genre.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
      a.click();
    }
  }, [generatedImage, showColored, canvasRef, genre]);

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
            Describe it yourself <span className="text-muted-foreground font-normal text-sm">(optional)</span>
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

      <div className="bg-card rounded-3xl border-2 border-border border-dashed overflow-hidden min-h-[420px] flex items-center justify-center relative shadow-inner">
        {generateMutation.isPending ? (
          <div className="flex flex-col items-center text-muted-foreground animate-pulse py-16">
            <div className="w-24 h-24 mb-4 relative">
              <div className="absolute inset-0 border-4 border-primary rounded-full animate-[spin_3s_linear_infinite] border-t-transparent" />
              <div className="absolute inset-2 border-4 border-secondary rounded-full animate-[spin_2s_linear_infinite_reverse] border-b-transparent" />
              <div className="absolute inset-4 border-4 border-accent rounded-full animate-[spin_1.5s_linear_infinite] border-l-transparent" />
            </div>
            <p className="font-display text-xl text-primary font-medium">Sharpening crayons...</p>
          </div>
        ) : generatedImage ? (
          <div className="w-full p-4 animate-in zoom-in-95 duration-500 flex flex-col items-center gap-4">
            <div className="relative group cursor-pointer select-none" onClick={() => setShowColored((v) => !v)} title="Click to toggle colored preview">
              <img
                src={`data:image/png;base64,${generatedImage}`}
                alt="Generated coloring page"
                className="max-h-[560px] w-auto object-contain rounded-xl shadow-md bg-white border border-border transition-opacity duration-300"
                style={{ opacity: showColored ? 0 : 1, position: showColored ? "absolute" : "relative", pointerEvents: showColored ? "none" : "auto" }}
                data-testid="img-generated-preview"
              />
              <canvas
                ref={canvasRef}
                className="max-h-[560px] w-auto object-contain rounded-xl shadow-md border border-blue-300 transition-opacity duration-300"
                style={{
                  opacity: showColored ? 1 : 0,
                  position: showColored ? "relative" : "absolute",
                  maxWidth: "100%",
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="bg-black/50 text-white text-sm font-semibold px-4 py-2 rounded-full flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  {showColored ? "Click to see B&W" : "Click to see colored"}
                </div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground text-center">
              {showColored
                ? "🎨 Colored preview — click the image to switch back to B&W"
                : "⬛ Black & white — click the image to see the colored version"}
            </div>

            <div className="flex flex-wrap gap-3 justify-center animate-in slide-in-from-bottom-4">
              <Button size="lg" variant="outline" className="h-12 px-6 rounded-xl font-semibold border-2" onClick={handleGenerate} data-testid="button-regenerate">
                <RefreshCcw className="mr-2 h-5 w-5" />
                Try Another
              </Button>
              <Button size="lg" className="h-12 px-6 rounded-xl font-bold bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg" onClick={handleDownload} data-testid="button-download">
                <Download className="mr-2 h-5 w-5" />
                Download {showColored ? "Colored" : "B&W"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center p-8 space-y-4 opacity-50">
            <div className="w-32 h-32 mx-auto bg-muted rounded-full flex items-center justify-center">
              <Palette className="h-12 w-12 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium text-muted-foreground">Your masterpiece will appear here!</p>
          </div>
        )}
      </div>
    </div>
  );
}
