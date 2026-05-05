import { Link, useLocation } from "wouter";
import { Palette, Library, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Create", icon: Palette },
    { href: "/history", label: "Gallery", icon: Library },
    { href: "/stats", label: "Stats", icon: BarChart2 },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 transition-transform hover:scale-105" data-testid="link-home-logo">
            <div className="bg-primary text-primary-foreground p-2 rounded-xl rotate-3">
              <Palette className="h-6 w-6" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-foreground">Coloring Magic</span>
          </Link>
          
          <nav className="flex items-center gap-2">
            {navItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link 
                  key={item.href} 
                  href={item.href}
                  data-testid={`link-nav-${item.label.toLowerCase()}`}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all duration-200",
                    isActive 
                      ? "bg-secondary text-secondary-foreground shadow-sm -translate-y-0.5" 
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-secondary-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col container mx-auto px-4 py-8">
        {children}
      </main>

      <footer className="py-6 border-t border-border/40 text-center text-muted-foreground text-sm">
        <p>Made with magic and crayons.</p>
      </footer>
    </div>
  );
}