import { useState } from "react";
import { useGetDailyChallenge, getGetDailyChallengeQueryOptions } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Sun, Trophy, AlertCircle, RefreshCcw } from "lucide-react";
import jsPDF from "jspdf";

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
    a.download = filename;
    a.click();
  };
  img.src = src;
}

async function downloadPDF(imageData: string, title: string, theme: string) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.text(`Today's Challenge: ${title}`, 20, 20, { maxWidth: 170 });
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "normal");
  pdf.text(theme, 20, 32, { maxWidth: 170 });
  const img = new Image();
  img.src = `data:image/png;base64,${imageData}`;
  await new Promise<void>(r => { img.onload = () => r(); });
  const canvas = document.createElement("canvas");
  canvas.width = img.width; canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.filter = "grayscale(1) contrast(1.4)";
  ctx.drawImage(img, 0, 0);
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 20, 40, 170, 170);
  pdf.save("daily-challenge.pdf");
}

export function Daily() {
  const baseOptions = getGetDailyChallengeQueryOptions();
  const { data: challenge, isLoading, error, refetch } = useGetDailyChallenge({
    query: { ...baseOptions, retry: false },
  });
  const [showColored, setShowColored] = useState(false);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="max-w-2xl mx-auto w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Sun className="h-8 w-8 text-yellow-400" />
          <h1 className="font-display text-4xl font-bold text-foreground">Daily Challenge</h1>
        </div>
        <p className="text-muted-foreground">{today}</p>
      </div>

      {isLoading && (
        <div className="bg-card rounded-3xl border-2 border-dashed border-border min-h-[300px] flex flex-col items-center justify-center gap-4 animate-pulse">
          <div className="w-20 h-20 relative">
            <div className="absolute inset-0 border-4 border-yellow-400 rounded-full animate-[spin_3s_linear_infinite] border-t-transparent" />
            <div className="absolute inset-2 border-4 border-primary rounded-full animate-[spin_2s_linear_infinite_reverse] border-b-transparent" />
          </div>
          <p className="font-display text-xl text-primary font-medium">Preparing today's challenge…</p>
          <p className="text-sm text-muted-foreground">This takes about 15–30 seconds</p>
        </div>
      )}

      {error && !isLoading && (
        <div className="bg-destructive/10 rounded-2xl border-2 border-destructive/30 p-6 flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <div>
            <p className="font-display font-bold text-destructive text-lg">Couldn't load today's challenge</p>
            <p className="text-sm text-muted-foreground mt-1">
              {(error as any)?.status === 403
                ? "The AI image service has reached its monthly limit. Please try again later."
                : "Something went wrong loading today's challenge."}
            </p>
          </div>
          <Button variant="outline" className="rounded-xl" onClick={() => refetch()}>
            <RefreshCcw className="mr-2 h-4 w-4" />Try Again
          </Button>
        </div>
      )}

      {challenge && !isLoading && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/30 dark:to-orange-950/30 rounded-3xl border-2 border-yellow-200 dark:border-yellow-800 p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="font-display font-bold text-xl">{challenge.genre} Challenge</p>
                <p className="text-sm text-muted-foreground capitalize">{challenge.theme}</p>
              </div>
            </div>

            {challenge.imageData ? (
              <>
                <div
                  className="rounded-2xl overflow-hidden bg-white border-2 border-yellow-200 cursor-pointer relative group"
                  onClick={() => setShowColored(v => !v)}
                >
                  <img
                    src={`data:image/png;base64,${challenge.imageData}`}
                    alt="Daily challenge"
                    className="w-full object-contain transition-all duration-300"
                    style={{ filter: showColored ? "blur(10px) saturate(1.4)" : "grayscale(1) contrast(1.4)" }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <span className="bg-black/50 text-white text-sm px-4 py-2 rounded-full">
                      {showColored ? "Click to hide colors" : "Click to peek at colors!"}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button className="flex-1 rounded-xl font-bold" onClick={() => downloadFromCanvas(`data:image/png;base64,${challenge.imageData!}`, "grayscale(1) contrast(1.4)", "daily-challenge-bw.png")}>
                    <Download className="mr-2 h-4 w-4" />Download B&amp;W
                  </Button>
                  <Button variant="outline" className="flex-1 rounded-xl font-semibold" onClick={() => downloadPDF(challenge.imageData!, challenge.genre, challenge.theme)}>
                    <Download className="mr-2 h-4 w-4" />Download PDF
                  </Button>
                </div>
              </>
            ) : (
              <div className="bg-white/50 rounded-2xl p-8 text-center text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p>Generating today's image…</p>
              </div>
            )}
          </div>

          <div className="bg-card rounded-2xl border-2 border-border p-4 text-sm text-muted-foreground text-center">
            A new challenge is generated every day. Come back tomorrow for a fresh one!
          </div>
        </div>
      )}
    </div>
  );
}
