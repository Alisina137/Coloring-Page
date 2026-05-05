import { useGetColoringHistory, useDeleteColoringHistory, getGetColoringHistoryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Trash2, Download, Image as ImageIcon, Loader2 } from "lucide-react";
import { Link } from "wouter";

export function History() {
  const { data: history, isLoading } = useGetColoringHistory();
  const queryClient = useQueryClient();
  const deleteMutation = useDeleteColoringHistory({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetColoringHistoryQueryKey() });
      }
    }
  });

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id });
  };

  const handleDownload = (imageData: string, genre: string) => {
    const a = document.createElement("a");
    a.href = `data:image/png;base64,${imageData}`;
    a.download = `coloring-page-${genre.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    a.click();
  };

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold text-foreground">Your Art Gallery</h1>
          <p className="text-muted-foreground mt-2">All your magical creations in one place.</p>
        </div>
        <Link href="/" className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-8 rounded-full" data-testid="link-create-new">
          Create New Page
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse bg-muted/50 border-0 shadow-sm h-80 rounded-2xl" />
          ))}
        </div>
      ) : !history || history.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-3xl border-2 border-dashed border-border flex flex-col items-center">
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <ImageIcon className="h-12 w-12 text-primary" />
          </div>
          <h2 className="text-2xl font-display font-semibold mb-2">No masterpieces yet!</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Your gallery is empty. Head over to the creative studio to start making some magic!
          </p>
          <Link href="/" className="inline-flex items-center justify-center whitespace-nowrap text-base font-bold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring bg-secondary text-secondary-foreground shadow-lg hover:bg-secondary/90 h-14 px-8 rounded-2xl" data-testid="link-empty-create">
            Start Drawing
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {history.map((item) => (
            <Card key={item.id} className="overflow-hidden border-2 border-border/50 hover:border-primary/30 transition-all hover:shadow-lg rounded-2xl group flex flex-col" data-testid={`card-history-${item.id}`}>
              <CardContent className="p-0 relative flex-1 bg-white flex items-center justify-center overflow-hidden aspect-[3/4]">
                <img 
                  src={`data:image/png;base64,${item.imageData}`} 
                  alt={`${item.genre} coloring page`}
                  className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-500"
                  data-testid={`img-history-${item.id}`}
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className="h-12 w-12 rounded-full" 
                    onClick={() => handleDownload(item.imageData, item.genre)}
                    data-testid={`button-download-${item.id}`}
                  >
                    <Download className="h-6 w-6" />
                  </Button>
                </div>
              </CardContent>
              <CardFooter className="bg-card p-4 flex flex-col items-start gap-3 border-t">
                <div className="flex flex-wrap gap-2 w-full">
                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary border-primary/20" data-testid={`badge-genre-${item.id}`}>
                    {item.genre}
                  </span>
                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-accent/10 text-accent border-accent/20" data-testid={`badge-gender-${item.id}`}>
                    {item.gender}
                  </span>
                </div>
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive hover:bg-destructive hover:text-destructive-foreground rounded-full"
                    onClick={() => handleDelete(item.id)}
                    disabled={deleteMutation.isPending && deleteMutation.variables?.id === item.id}
                    data-testid={`button-delete-${item.id}`}
                  >
                    {deleteMutation.isPending && deleteMutation.variables?.id === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}