import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, BookOpen, RotateCcw, Plus, LogOut, Loader2, CheckCircle2, Trash2, Trophy, Star, Flame, Target, Sparkles } from "lucide-react";
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
  const [userStats, setUserStats] = useState<any>(null);
  const [activeMissions, setActiveMissions] = useState<number>(0);
  const [unlockedAchievements, setUnlockedAchievements] = useState<number>(0);

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

  const fetchMissionStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch or create user stats
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

      // Fetch active missions count
      const { data: missions } = await supabase
        .from("user_missions")
        .select("*")
        .eq("user_id", user.id)
        .eq("completed", false);

      setActiveMissions(missions?.length || 0);

      // Fetch unlocked achievements count
      const { count } = await supabase
        .from("user_achievements")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      setUnlockedAchievements(count || 0);
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
            className="group relative overflow-hidden border-2 border-green-500/30 bg-gradient-to-br from-green-500/5 to-emerald-500/10"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-green-400/10 to-emerald-600/10" />
            <CardHeader className="relative pb-4">
              <div className="mb-4 p-3 w-fit rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/20">
                <BookOpen className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-3xl mb-2 flex items-center gap-2">
                <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  Læringsområde
                </span>
              </CardTitle>
              <CardDescription className="text-base">
                Udforsk nye emner og opbyg din viden med AI-genererede læringsstier
              </CardDescription>
            </CardHeader>
            <CardContent className="relative pt-6">
              <div className="bg-background/50 backdrop-blur-sm rounded-lg p-4 mb-4 border border-green-500/20">
                <p className="text-sm text-muted-foreground">
                  📚 Se dine læringsstier nedenfor og tryk på en for at fortsætte læringen
                </p>
              </div>
              <Button 
                size="lg"
                variant="outline"
                className="w-full text-base h-12 border-green-500/50 hover:bg-green-500/10 hover:border-green-500" 
                onClick={() => document.getElementById('learning-paths')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Se Mine Læringsstier
              </Button>
            </CardContent>
          </Card>

          {/* Spaced Repetition Card */}
          <Card 
            className="group relative overflow-hidden border-2 border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-blue-500/10 cursor-pointer hover:shadow-[0_0_30px_rgba(168,85,247,0.2)] transition-all duration-300"
            onClick={() => navigate("/spaced-repetition")}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-400/10 to-blue-600/10" />
            <CardHeader className="relative pb-4">
              <div className="mb-4 p-3 w-fit rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 shadow-lg shadow-purple-500/20">
                <Brain className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-3xl mb-2 flex items-center gap-2">
                <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  Spaced Repetition
                </span>
              </CardTitle>
              <CardDescription className="text-base">
                Optimer din hukommelse med videnskabeligt bevist gentagelsesmetode
              </CardDescription>
            </CardHeader>
            <CardContent className="relative pt-6">
              <div className="bg-background/50 backdrop-blur-sm rounded-lg p-4 mb-4 border border-purple-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Forfalder i dag:</span>
                  <span className="text-lg font-bold text-purple-500">{dueCardsCount}</span>
                </div>
                <Progress value={(dueCardsCount / Math.max(dueCardsCount, 1)) * 100} className="h-2" />
              </div>
              <Button 
                size="lg"
                className="w-full text-lg h-14 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 group-hover:scale-105 transition-transform shadow-lg shadow-purple-500/20" 
                onClick={(e) => {
                  e.stopPropagation();
                  navigate("/spaced-repetition");
                }}
              >
                <Brain className="w-5 h-5 mr-2" />
                Start Gennemgang
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Vibe Learning Card */}
        <Card 
          className="mb-6 max-w-5xl mx-auto bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-blue-500/10 border-2 border-pink-500/30 hover:border-pink-500/50 transition-all duration-300 cursor-pointer hover:shadow-[0_0_30px_rgba(236,72,153,0.2)]"
          onClick={() => navigate("/vibe-learning")}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-pink-400/10 to-purple-600/10" />
          <CardHeader className="relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-gradient-to-br from-pink-500 to-purple-500 shadow-lg shadow-pink-500/20">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-2xl bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                    Vibe Learning ✨
                  </CardTitle>
                  <CardDescription>
                    Chat med AI, få videoer, generer øvelser - personlig læring i dit tempo
                  </CardDescription>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="lg"
                className="border-pink-500/50 hover:bg-pink-500/10"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate("/vibe-learning");
                }}
              >
                Start Chat
              </Button>
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-background/50 backdrop-blur-sm rounded-lg p-3 border border-pink-500/20">
                <p className="text-xs text-muted-foreground mb-1">💬 Konversationel læring</p>
              </div>
              <div className="bg-background/50 backdrop-blur-sm rounded-lg p-3 border border-purple-500/20">
                <p className="text-xs text-muted-foreground mb-1">🎥 Video anbefalinger</p>
              </div>
              <div className="bg-background/50 backdrop-blur-sm rounded-lg p-3 border border-blue-500/20">
                <p className="text-xs text-muted-foreground mb-1">⚡ Instant øvelser</p>
              </div>
              <div className="bg-background/50 backdrop-blur-sm rounded-lg p-3 border border-pink-500/20">
                <p className="text-xs text-muted-foreground mb-1">🎯 Kontekst-bevidst</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Missions & Achievements Overview */}
        <Card 
          className="mb-12 max-w-5xl mx-auto bg-gradient-to-br from-purple-500/10 via-yellow-500/10 to-orange-500/10 border-2 border-primary/20 hover:border-primary/40 transition-all duration-300 cursor-pointer hover:shadow-[var(--shadow-elevated)]"
          onClick={() => navigate("/missions")}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Missioner & Achievements</CardTitle>
                  <CardDescription>Følg din fremgang og lås op for belønninger</CardDescription>
                </div>
              </div>
              <Button variant="outline" size="lg" onClick={(e) => {
                e.stopPropagation();
                navigate("/missions");
              }}>
                Se Alle
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-background/50 backdrop-blur-sm rounded-lg p-4 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-5 h-5 text-yellow-500 fill-current" />
                  <span className="text-sm text-muted-foreground">Total Points</span>
                </div>
                <p className="text-2xl font-bold text-yellow-500">{userStats?.total_points || 0}</p>
              </div>
              
              <div className="bg-background/50 backdrop-blur-sm rounded-lg p-4 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <span className="text-sm text-muted-foreground">Streak</span>
                </div>
                <p className="text-2xl font-bold text-orange-500">{userStats?.current_streak || 0} dage</p>
              </div>
              
              <div className="bg-background/50 backdrop-blur-sm rounded-lg p-4 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-5 h-5 text-blue-500" />
                  <span className="text-sm text-muted-foreground">Aktive Missioner</span>
                </div>
                <p className="text-2xl font-bold text-blue-500">{activeMissions}</p>
              </div>
              
              <div className="bg-background/50 backdrop-blur-sm rounded-lg p-4 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-5 h-5 text-purple-500" />
                  <span className="text-sm text-muted-foreground">Achievements</span>
                </div>
                <p className="text-2xl font-bold text-purple-500">{unlockedAchievements}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div id="learning-paths" className="flex items-center justify-between mb-6">
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
