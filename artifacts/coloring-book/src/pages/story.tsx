import { useState } from "react";
import { useGenerateStory, useGetStories, getGetStoriesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Loader2, BookOpen, Download, Wand2, ChevronLeft, ChevronRight } from "lucide-react";
import jsPDF from "jspdf";

const GENRES = [
  "Animals", "Fantasy", "Cars & Vehicles", "Sports", "Nature & Landscapes",
  "Dinosaurs", "Space & Planets", "Princess & Fairy Tales", "Superheroes",
  "Farm Life", "Ocean & Sea Creatures", "Jungle Adventure", "Robots & Sci-Fi",
  "Holiday Themes", "Myths & Legends", "School & Education Scenes",
  "Food & Sweets", "Transportation", "Cute Cartoon Characters", "Daily Life Scenes"
];

type StoryPage = { id: number; pageNumber: number; sentence: string; imageData: string };
type Story = { id: number; title: string; genre: string; pages: StoryPage[]; createdAt: string };

function StoryViewer({ story }: { story: Story }) {
  const [currentPage, setCurrentPage] = useState(0);
  const [showColored, setShowColored] = useState(false);
  const page = story.pages[currentPage];

  const downloadPDF = async () => {
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    for (let i = 0; i < story.pages.length; i++) {
      if (i > 0) pdf.addPage();
      const p = story.pages[i];
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text(`${story.title} — Page ${p.pageNumber}`, 20, 20);
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text(p.sentence, 20, 32, { maxWidth: 170 });
      const img = new Image();
      img.src = `data:image/png;base64,${p.imageData}`;
      await new Promise<void>(resolve => { img.onload = () => resolve(); });
      const canvas = document.createElement("canvas");
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.filter = "grayscale(1) contrast(1.4)";
      ctx.drawImage(img, 0, 0);
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 20, 40, 170, 170);
    }
    pdf.save(`${story.title.replace(/\s+/g, "-")}.pdf`);
  };

  return (
    <div className="bg-card rounded-2xl border-2 border-border p-5 shadow-md space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display font-bold text-base">{story.title}</p>
          <p className="text-xs text-muted-foreground">{story.genre} · {story.pages.length} pages</p>
        </div>
        <Button size="sm" variant="outline" className="rounded-xl" onClick={downloadPDF}>
          <Download className="mr-1 h-4 w-4" />PDF
        </Button>
      </div>

      <div className="relative rounded-xl overflow-hidden bg-white border border-border cursor-pointer" onClick={() => setShowColored(v => !v)}>
        <img
          src={`data:image/png;base64,${page.imageData}`}
          alt={`Page ${page.pageNumber}`}
          className="w-full object-contain"
          style={{ filter: showColored ? "blur(8px) saturate(1.3)" : "grayscale(1) contrast(1.4)" }}
        />
        <div className="absolute inset-0 flex items-end justify-center pb-3 pointer-events-none">
          <span className="bg-black/50 text-white text-xs px-3 py-1 rounded-full">
            {showColored ? "Colored hint — click to hide" : "Click to peek colors"}
          </span>
        </div>
      </div>

      <p className="text-sm font-medium text-center italic text-muted-foreground">"{page.sentence}"</p>

      <div className="flex items-center justify-between">
        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">Page {currentPage + 1} of {story.pages.length}</span>
        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setCurrentPage(p => Math.min(story.pages.length - 1, p + 1))} disabled={currentPage === story.pages.length - 1}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function Story() {
  const queryClient = useQueryClient();
  const [genre, setGenre] = useState("Animals");
  const [ageGroup, setAgeGroup] = useState<"3-5" | "6-8" | "9+">("6-8");
  const [gender, setGender] = useState<"Boy" | "Girl" | "Neutral">("Neutral");
  const [pageCount, setPageCount] = useState(3);
  const [activeStory, setActiveStory] = useState<Story | null>(null);

  const { data: stories = [] } = useGetStories();

  const generateMutation = useGenerateStory({
    mutation: {
      onSuccess: (data) => {
        setActiveStory(data as Story);
        queryClient.invalidateQueries({ queryKey: getGetStoriesQueryKey() });
      }
    }
  });

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2">
        <h1 className="font-display text-4xl font-bold text-foreground">
          <BookOpen className="inline h-9 w-9 mr-2 text-primary" />Story Mode
        </h1>
        <p className="text-muted-foreground">Generate a connected 3–5 page coloring story!</p>
      </div>

      <div className="bg-card p-6 rounded-3xl border-2 border-primary/20 shadow-xl space-y-5">
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label className="font-display font-semibold text-primary">Who is coloring?</Label>
            <RadioGroup value={gender} onValueChange={v => setGender(v as any)} className="flex gap-4">
              {["Boy", "Girl", "Neutral"].map(g => (
                <div key={g} className="flex items-center space-x-2">
                  <RadioGroupItem value={g} id={`story-gender-${g}`} />
                  <Label htmlFor={`story-gender-${g}`} className="cursor-pointer">{g}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label className="font-display font-semibold text-primary">Age / difficulty</Label>
            <RadioGroup value={ageGroup} onValueChange={v => setAgeGroup(v as any)} className="flex gap-4 flex-wrap">
              {(["3-5", "6-8", "9+"] as const).map(age => (
                <div key={age} className="flex items-center space-x-2">
                  <RadioGroupItem value={age} id={`story-age-${age}`} />
                  <Label htmlFor={`story-age-${age}`} className="cursor-pointer">{age === "3-5" ? "3–5" : age === "6-8" ? "6–8" : "9+"}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="font-display font-semibold text-accent">Story genre</Label>
          <Select value={genre} onValueChange={setGenre}>
            <SelectTrigger className="h-12 rounded-xl border-accent/30 bg-accent/5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {GENRES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label className="font-display font-semibold text-accent">Number of pages: <span className="text-primary">{pageCount}</span></Label>
          <Slider min={3} max={5} step={1} value={[pageCount]} onValueChange={v => setPageCount(v[0])} className="w-full" />
          <div className="flex justify-between text-xs text-muted-foreground"><span>3 pages</span><span>5 pages</span></div>
        </div>

        <Button size="lg" className="w-full h-14 text-lg rounded-2xl font-bold shadow-lg" onClick={() => generateMutation.mutate({ data: { genre, ageGroup, gender, pageCount } })} disabled={generateMutation.isPending}>
          {generateMutation.isPending
            ? <><Loader2 className="mr-2 h-6 w-6 animate-spin" />Writing the story… ({pageCount} pages)</>
            : <><Wand2 className="mr-2 h-6 w-6" />Generate Story!</>}
        </Button>
        {generateMutation.isPending && (
          <p className="text-center text-sm text-muted-foreground">This may take 1–2 minutes for all pages…</p>
        )}
      </div>

      {activeStory && !generateMutation.isPending && (
        <div className="space-y-3">
          <p className="font-display font-bold text-lg">Your story is ready!</p>
          <StoryViewer story={activeStory} />
        </div>
      )}

      {stories.length > 0 && (
        <div className="space-y-3">
          <p className="font-display font-bold text-lg text-muted-foreground">Past Stories</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {(stories as Story[]).filter(s => s.id !== activeStory?.id).slice(0, 4).map(story => (
              <StoryViewer key={story.id} story={story} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
