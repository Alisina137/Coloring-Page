import { useState } from "react";
import { useGenerateColoringPage, getGetColoringHistoryQueryKey, getGetColoringStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Download, Wand2, RefreshCcw, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

const GENRES = [
  "Animals", "Fantasy", "Cars & Vehicles", "Sports", "Nature & Landscapes", 
  "Dinosaurs", "Space & Planets", "Princess & Fairy Tales", "Superheroes", 
  "Farm Life", "Ocean & Sea Creatures", "Jungle Adventure", "Robots & Sci-Fi", 
  "Holiday Themes", "Myths & Legends", "School & Education Scenes", 
  "Food & Sweets", "Transportation", "Cute Cartoon Characters", "Daily Life Scenes"
];

export function Home() {
  const [gender, setGender] = useState<"Boy" | "Girl" | "Neutral">("Neutral");
  const [genre, setGenre] = useState<string>("Animals");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const generateMutation = useGenerateColoringPage({
    mutation: {
      onSuccess: (data) => {
        setGeneratedImage(data.imageData);
        queryClient.invalidateQueries({ queryKey: getGetColoringHistoryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetColoringStatsQueryKey() });
      }
    }
  });

  const handleGenerate = () => {
    generateMutation.mutate({ data: { gender, genre } });
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const a = document.createElement("a");
    a.href = `data:image/png;base64,${generatedImage}`;
    a.download = `coloring-page-${genre.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    a.click();
  };

  return (
    <div className="max-w-4xl mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-4">
        <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground drop-shadow-sm">
          Dream It. <span className="text-primary">Draw It.</span> <span className="text-secondary-foreground bg-secondary px-2 py-1 rounded-xl -rotate-2 inline-block">Color It!</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Choose a theme and let our magic crayons draw a brand new coloring page just for you!
        </p>
      </div>

      <div className="grid md:grid-cols-12 gap-8">
        <div className="md:col-span-4 space-y-8 bg-card p-6 rounded-3xl border-2 border-primary/20 shadow-xl">
          <div className="space-y-4">
            <Label className="text-lg font-display font-semibold text-primary">Who is coloring?</Label>
            <RadioGroup 
              value={gender} 
              onValueChange={(v) => setGender(v as any)}
              className="grid grid-cols-1 gap-3"
            >
              {["Boy", "Girl", "Neutral"].map((g) => (
                <div key={g} className="flex items-center space-x-2">
                  <RadioGroupItem value={g} id={`gender-${g}`} data-testid={`input-gender-${g.toLowerCase()}`} />
                  <Label htmlFor={`gender-${g}`} className="text-base cursor-pointer">{g}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-4">
            <Label className="text-lg font-display font-semibold text-accent">What should we draw?</Label>
            <Select value={genre} onValueChange={setGenre}>
              <SelectTrigger className="h-14 text-base rounded-xl border-accent/30 bg-accent/5 focus:ring-accent" data-testid="select-genre">
                <SelectValue placeholder="Pick a theme" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {GENRES.map((g) => (
                  <SelectItem key={g} value={g} data-testid={`select-option-${g.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button 
            size="lg" 
            className="w-full h-16 text-lg rounded-2xl font-bold shadow-lg transition-transform hover:-translate-y-1 active:translate-y-0"
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            data-testid="button-generate"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                Drawing Magic...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-6 w-6" />
                Generate Page!
              </>
            )}
          </Button>
        </div>

        <div className="md:col-span-8 flex flex-col">
          <div className="flex-1 bg-card rounded-3xl border-2 border-border border-dashed overflow-hidden min-h-[400px] flex items-center justify-center relative shadow-inner">
            {generateMutation.isPending ? (
              <div className="flex flex-col items-center text-muted-foreground animate-pulse">
                <div className="w-24 h-24 mb-4 relative">
                  <div className="absolute inset-0 border-4 border-primary rounded-full animate-[spin_3s_linear_infinite] border-t-transparent"></div>
                  <div className="absolute inset-2 border-4 border-secondary rounded-full animate-[spin_2s_linear_infinite_reverse] border-b-transparent"></div>
                  <div className="absolute inset-4 border-4 border-accent rounded-full animate-[spin_1.5s_linear_infinite] border-l-transparent"></div>
                </div>
                <p className="font-display text-xl text-primary font-medium">Sharpening crayons...</p>
              </div>
            ) : generatedImage ? (
              <div className="w-full h-full p-4 animate-in zoom-in-95 duration-500 flex flex-col items-center justify-center">
                <img 
                  src={`data:image/png;base64,${generatedImage}`} 
                  alt="Generated coloring page" 
                  className="max-h-[600px] w-auto object-contain rounded-xl shadow-md bg-white border border-border"
                  data-testid="img-generated-preview"
                />
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

          {generatedImage && !generateMutation.isPending && (
            <div className="mt-6 flex flex-wrap gap-4 justify-center animate-in slide-in-from-bottom-4">
              <Button size="lg" variant="outline" className="h-14 px-8 rounded-xl font-semibold border-2" onClick={handleGenerate} data-testid="button-regenerate">
                <RefreshCcw className="mr-2 h-5 w-5" />
                Try Another
              </Button>
              <Button size="lg" className="h-14 px-8 rounded-xl font-bold bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg" onClick={handleDownload} data-testid="button-download">
                <Download className="mr-2 h-5 w-5" />
                Download & Print
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}