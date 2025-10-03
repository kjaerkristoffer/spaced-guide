import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, BookOpen, RotateCcw, LogOut } from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const [dueCardsCount, setDueCardsCount] = useState(0);
  const [totalCardsCount, setTotalCardsCount] = useState(0);

  useEffect(() => {
    checkAuth();
    fetchReviewStats();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchReviewStats = async () => {
    try {
      const now = new Date().toISOString();
      
      const { count: totalCount, error: totalError } = await supabase
        .from("user_progress")
        .select("*", { count: "exact", head: true });

      if (totalError) throw totalError;
      setTotalCardsCount(totalCount || 0);

      const { count: dueCount, error: dueError } = await supabase
        .from("user_progress")
        .select("*", { count: "exact", head: true })
        .lte("next_review", now);

      if (dueError) throw dueError;
      setDueCardsCount(dueCount || 0);
    } catch (error: any) {
      console.error("Failed to fetch review stats:", error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ background: "var(--gradient-primary)" }}>
              <Brain className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold">LearnSmart</h1>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Log Ud
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="mb-12 grid gap-6 md:grid-cols-2 max-w-5xl mx-auto">
          {/* Learning Area Card */}
          <Card 
            className="group relative overflow-hidden border-2 hover:border-primary transition-all duration-300 cursor-pointer hover:shadow-[var(--shadow-elevated)]"
            onClick={() => navigate("/learn")}
          >
            <div className="absolute inset-0 opacity-5" style={{ background: "var(--gradient-primary)" }} />
            <CardHeader className="relative pb-4">
              <div className="mb-4 p-3 w-fit rounded-xl" style={{ background: "var(--gradient-primary)" }}>
                <BookOpen className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-3xl mb-2">Læringsområde</CardTitle>
              <CardDescription className="text-base">
                Udforsk nye emner og opbyg din viden med AI-genererede læringsstier
              </CardDescription>
            </CardHeader>
            <CardContent className="relative pt-6">
              <Button 
                size="lg"
                className="w-full text-lg h-14 group-hover:scale-105 transition-transform" 
                onClick={() => navigate("/learning-paths")}
              >
                <BookOpen className="w-5 h-5 mr-2" />
                Udforsk Læringsstier
              </Button>
            </CardContent>
          </Card>

          {/* Spaced Repetition Card */}
          <Card 
            className="group relative overflow-hidden border-2 hover:border-primary transition-all duration-300 cursor-pointer hover:shadow-[var(--shadow-elevated)]"
            onClick={() => dueCardsCount > 0 && navigate("/review")}
          >
            <div className="absolute inset-0 opacity-5" style={{ background: "var(--gradient-primary)" }} />
            <CardHeader className="relative pb-4">
              <div className="mb-4 p-3 w-fit rounded-xl" style={{ background: "var(--gradient-primary)" }}>
                <RotateCcw className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-3xl mb-2">Spaced Repetition</CardTitle>
              <CardDescription className="text-base">
                Gennemgå og forstærk din viden med videnskabeligt baseret gentagelse
              </CardDescription>
            </CardHeader>
            <CardContent className="relative space-y-4 pt-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-background/50 rounded-lg p-4 text-center border">
                  <div className="text-3xl font-bold text-primary mb-1">{dueCardsCount}</div>
                  <div className="text-xs text-muted-foreground">Forfaldne nu</div>
                </div>
                <div className="bg-background/50 rounded-lg p-4 text-center border">
                  <div className="text-3xl font-bold mb-1">{totalCardsCount}</div>
                  <div className="text-xs text-muted-foreground">I alt sporet</div>
                </div>
              </div>
              <Button 
                size="lg"
                className="w-full text-lg h-14 group-hover:scale-105 transition-transform" 
                onClick={(e) => {
                  e.stopPropagation();
                  navigate("/review");
                }}
                disabled={dueCardsCount === 0}
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                {dueCardsCount === 0 ? "Ingen Kort Forfaldne" : `Gennemgå ${dueCardsCount} Kort`}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold">Vælg Din Læringsmetode</h2>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
