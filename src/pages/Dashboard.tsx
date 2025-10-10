import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Brain, BookOpen, Plus, LogOut, Loader2, CheckCircle2, Trash2, Sparkles, Star, Flame, Target, Trophy, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  const [pathProgress, setPathProgress] = useState<Record<string, number>>({});
  const [deletingPathId, setDeletingPathId] = useState<string | null>(null);
  const [userStats, setUserStats] = useState<any>(null);

  useEffect(() => {
    checkAuth();
    fetchLearningPaths();
    fetchReviewStats();
    fetchPathProgress();
    fetchMissionStats();
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
      const { data, error } = await supabase
        .from("user_progress")
        .select("next_review")
        .not("next_review", "is", null);

      if (error) throw error;
      
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

      const { data: paths } = await supabase
        .from("learning_paths")
        .select("id, structure")
        .eq("user_id", user.id);

      const { data: allCards } = await supabase
        .from("cards")
        .select("id, learning_path_id, topic")
        .eq("user_id", user.id);

      const { data: progress } = await supabase
        .from("user_progress")
        .select("card_id")
        .eq("user_id", user.id);

      const reviewedCardIds = new Set(progress?.map(p => p.card_id) || []);
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

      const progressPct: Record<string, number> = {};
      paths?.forEach(path => {
        const structure = path.structure as any;
        const totalTopicsInStructure = structure?.topics?.length || 0;
        const topicStats = pathTopicStats[path.id] || {};
        
        let completedTopics = 0;
        Object.values(topicStats).forEach(stats => {
          const pct = stats.total > 0 ? (stats.reviewed / stats.total) * 100 : 0;
          if (pct === 100) {
            completedTopics++;
          }
        });
        
        progressPct[path.id] = totalTopicsInStructure > 0 
          ? (completedTopics / totalTopicsInStructure) * 100 
          : 0;
      });

      setPathProgress(progressPct);
    } catch (error: any) {
      console.error("Failed to fetch path progress:", error);
    }
  };

  const fetchMissionStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let { data: stats } = await supabase
        .from("user_stats")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!stats) {
        const { data: newStats } = await supabase
          .from("user_stats")
          .insert({ user_id: user.id })
          .select()
          .single();
        stats = newStats;
      }

      setUserStats(stats);
    } catch (error: any) {
      console.error("Failed to fetch mission stats:", error);
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
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        "generate-learning-path",
        { body: { subject: newSubject } }
      );

      if (functionError) throw functionError;

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
      {/* Minimal Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                <Brain className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-medium tracking-tight">LearnSmart</span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleSignOut}
              className="text-xs font-medium"
            >
              Log ud
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Hero Stats - Minimalist Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card 
            className="p-4 sm:p-6 border-0 bg-gradient-to-br from-background to-muted/20 hover:shadow-lg transition-all duration-300 cursor-pointer animate-fade-up"
            onClick={() => navigate("/spaced-repetition")}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-primary" />
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-light tracking-tight">{dueCardsCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Gennemgang</p>
              </div>
            </div>
          </Card>

          <Card 
            className="p-4 sm:p-6 border-0 bg-gradient-to-br from-background to-muted/20 hover:shadow-lg transition-all duration-300 cursor-pointer animate-fade-up [animation-delay:100ms]"
            onClick={() => navigate("/missions")}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-orange-500" />
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-light tracking-tight">{userStats?.current_streak || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Dages streak</p>
              </div>
            </div>
          </Card>

          <Card 
            className="p-4 sm:p-6 border-0 bg-gradient-to-br from-background to-muted/20 hover:shadow-lg transition-all duration-300 cursor-pointer animate-fade-up [animation-delay:200ms]"
            onClick={() => navigate("/missions")}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                  <Star className="w-5 h-5 text-yellow-500" />
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-light tracking-tight">{userStats?.total_points || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Points</p>
              </div>
            </div>
          </Card>

          <Card 
            className="p-4 sm:p-6 border-0 bg-gradient-to-br from-background to-muted/20 hover:shadow-lg transition-all duration-300 cursor-pointer animate-fade-up [animation-delay:300ms]"
            onClick={() => navigate("/vibe-learning")}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-pink-500" />
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium tracking-tight">Vibe</p>
                <p className="text-xs text-muted-foreground mt-1">AI Learning</p>
              </div>
            </div>
          </Card>
        </section>

        {/* Learning Paths Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-medium tracking-tight">Læringsstier</h2>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Ny sti</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-lg font-medium">Opret læringssti</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <Input
                    placeholder="f.eks. Python, Spansk, Kvantfysik..."
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && createLearningPath()}
                    className="border-0 bg-muted/50 focus-visible:ring-1"
                  />
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
                      "Opret"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : learningPaths.length === 0 ? (
            <Card className="p-12 sm:p-20 text-center border-0 bg-gradient-to-br from-background to-muted/20">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-primary/60" />
              </div>
              <h3 className="text-lg font-medium mb-2">Ingen læringsstier</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Opret din første læringssti for at komme i gang
              </p>
            </Card>
          ) : (
            <div className="grid gap-3 sm:gap-4">
              {learningPaths.map((path, index) => {
                const progress = pathProgress[path.id] || 0;
                const isComplete = progress === 100;
                
                return (
                  <Card 
                    key={path.id} 
                    className={`group p-4 sm:p-6 border-0 bg-gradient-to-br from-background to-muted/20 hover:shadow-lg transition-all duration-300 cursor-pointer animate-fade-up`}
                    style={{ animationDelay: `${index * 50}ms` }}
                    onClick={() => navigate(`/path/${path.id}`)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-3">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate">{path.subject}</h3>
                          {isComplete && (
                            <div className="shrink-0 w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center">
                              <CheckCircle2 className="w-3 h-3 text-green-500" />
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{path.structure?.topics?.length || 0} emner</span>
                            <span>{Math.round(progress)}%</span>
                          </div>
                          <Progress value={progress} className="h-1" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingPathId(path.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingPathId} onOpenChange={() => setDeletingPathId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet læringssti?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil permanent slette denne læringssti og al dens fremgang.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingPathId && deleteLearningPath(deletingPathId)}>
              Slet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;
