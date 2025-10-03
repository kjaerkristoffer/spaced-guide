import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, BookOpen, RotateCcw, Plus, LogOut, Loader2, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface LearningPath {
  id: string;
  subject: string;
  structure: any;
  created_at: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSubject, setNewSubject] = useState("");
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dueCardsCount, setDueCardsCount] = useState(0);
  const [totalCardsCount, setTotalCardsCount] = useState(0);
  const [pathProgress, setPathProgress] = useState<Record<string, number>>({});
  const [deletingPathId, setDeletingPathId] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
    fetchLearningPaths();
    fetchReviewStats();
    fetchPathProgress();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchLearningPaths = async () => {
    try {
      const { data, error } = await supabase
        .from("learning_paths")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLearningPaths(data || []);
    } catch (error: any) {
      toast.error("Kunne ikke indlæse læringsstier");
    } finally {
      setLoading(false);
    }
  };

  const fetchReviewStats = async () => {
    try {
      // Get total cards being tracked
      const { count: totalCount, error: totalError } = await supabase
        .from("user_progress")
        .select("*", { count: "exact", head: true });

      if (totalError) throw totalError;
      setTotalCardsCount(totalCount || 0);

      // Get all cards with next_review dates and filter client-side
      const { data, error } = await supabase
        .from("user_progress")
        .select("next_review")
        .not("next_review", "is", null);

      if (error) throw error;
      
      // Filter cards that are due on the client side to handle timezone properly
      const now = new Date();
      const dueCards = (data || []).filter((card: any) => {
        const nextReviewDate = new Date(card.next_review);
        return nextReviewDate <= now;
      });
      
      setDueCardsCount(dueCards.length);
    } catch (error: any) {
      console.error("Failed to fetch review stats:", error);
    }
  };

  const fetchPathProgress = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all learning paths to know total topics
      const { data: paths, error: pathsError } = await supabase
        .from("learning_paths")
        .select("id, structure")
        .eq("user_id", user.id);

      if (pathsError) throw pathsError;

      // Get all cards with their topics
      const { data: allCards, error: cardsError } = await supabase
        .from("cards")
        .select("id, learning_path_id, topic")
        .eq("user_id", user.id);

      if (cardsError) throw cardsError;

      // Get all progress
      const { data: progress, error: progressError } = await supabase
        .from("user_progress")
        .select("card_id")
        .eq("user_id", user.id);

      if (progressError) throw progressError;

      const reviewedCardIds = new Set(progress?.map(p => p.card_id) || []);
      
      // Group cards by path and topic
      const pathTopicStats: Record<string, Record<string, { total: number; reviewed: number }>> = {};

      allCards?.forEach(card => {
        if (!pathTopicStats[card.learning_path_id]) {
          pathTopicStats[card.learning_path_id] = {};
        }
        if (!pathTopicStats[card.learning_path_id][card.topic]) {
          pathTopicStats[card.learning_path_id][card.topic] = { total: 0, reviewed: 0 };
        }
        pathTopicStats[card.learning_path_id][card.topic].total++;
        if (reviewedCardIds.has(card.id)) {
          pathTopicStats[card.learning_path_id][card.topic].reviewed++;
        }
      });

      // Calculate progress - EXACTLY like LearningPath.tsx
      const progressPct: Record<string, number> = {};
      paths?.forEach(path => {
        const structure = path.structure as any;
        const totalTopicsInStructure = structure?.topics?.length || 0;
        const topicStats = pathTopicStats[path.id] || {};
        
        let completedTopics = 0;
        
        // Count how many topics are 100% complete (exactly like LearningPath line 104-109)
        Object.values(topicStats).forEach(stats => {
          const pct = stats.total > 0 ? (stats.reviewed / stats.total) * 100 : 0;
          if (pct === 100) {
            completedTopics++;
          }
        });
        
        // Progress is: completed topics / ALL topics in structure (exactly like LearningPath line 240)
        progressPct[path.id] = totalTopicsInStructure > 0 
          ? (completedTopics / totalTopicsInStructure) * 100 
          : 0;
      });

      setPathProgress(progressPct);
    } catch (error: any) {
      console.error("Failed to fetch path progress:", error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const createLearningPath = async () => {
    if (!newSubject.trim()) {
      toast.error("Indtast venligst et emne");
      return;
    }

    setCreating(true);
    try {
      // Generate learning path using AI
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        "generate-learning-path",
        { body: { subject: newSubject } }
      );

      if (functionError) throw functionError;

      // Save to database
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("learning_paths")
        .insert({
          user_id: user?.id,
          subject: newSubject,
          structure: functionData.learningPath,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Læringssti oprettet!");
      setNewSubject("");
      setDialogOpen(false);
      fetchLearningPaths();
      fetchPathProgress();
    } catch (error: any) {
      toast.error(error.message || "Kunne ikke oprette læringssti");
    } finally {
      setCreating(false);
    }
  };

  const deleteLearningPath = async (pathId: string) => {
    try {
      const { error } = await supabase
        .from("learning_paths")
        .delete()
        .eq("id", pathId);

      if (error) throw error;

      toast.success("Læringssti slettet!");
      fetchLearningPaths();
      fetchPathProgress();
      fetchReviewStats();
      setDeletingPathId(null);
    } catch (error: any) {
      toast.error(error.message || "Kunne ikke slette læringssti");
    }
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
                onClick={(e) => {
                  e.stopPropagation();
                  navigate("/learn");
                }}
              >
                <BookOpen className="w-5 h-5 mr-2" />
                Start Læring
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
          <h2 className="text-2xl font-bold">Dine Læringsstier</h2>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nyt Emne
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Opret Ny Læringssti</DialogTitle>
                <DialogDescription>
                  Indtast et emne du vil lære, og AI vil skabe en struktureret læringssti til dig.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Emne</Label>
                  <Input
                    id="subject"
                    placeholder="f.eks. Python Programmering, Spansk Grammatik, Kvantfysik..."
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && createLearningPath()}
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={createLearningPath}
                  disabled={creating}
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Genererer...
                    </>
                  ) : (
                    "Opret Læringssti"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : learningPaths.length === 0 ? (
          <Card className="p-12 text-center">
            <Brain className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">Ingen læringsstier endnu</h3>
            <p className="text-muted-foreground mb-4">
              Opret din første læringssti for at komme i gang!
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {learningPaths.map((path) => {
              const progress = pathProgress[path.id] || 0;
              const isComplete = progress === 100;
              
              return (
                <Card 
                  key={path.id} 
                  className={`transition-all hover:shadow-[var(--shadow-elevated)] ${
                    isComplete ? 'border-green-500 border-2' : ''
                  }`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 cursor-pointer" onClick={() => navigate(`/path/${path.id}`)}>
                        <CardTitle className="flex items-center gap-2">
                          {path.subject}
                          {isComplete && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                        </CardTitle>
                        <CardDescription>
                          {path.structure?.topics?.length || 0} emner
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingPathId(path.id);
                        }}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="cursor-pointer" onClick={() => navigate(`/path/${path.id}`)}>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Oprettet {new Date(path.created_at).toLocaleDateString('da-DK')}
                      </p>
                      {progress > 0 && (
                        <div>
                          <Progress value={progress} className="h-1.5" />
                          <p className="text-xs text-muted-foreground mt-1">
                            {Math.round(progress)}% fuldført
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <AlertDialog open={!!deletingPathId} onOpenChange={() => setDeletingPathId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil permanent slette læringsstien og alle tilhørende kort og fremskridt. 
              Denne handling kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPathId && deleteLearningPath(deletingPathId)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Slet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;
