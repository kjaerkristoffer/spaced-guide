import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Brain,
  BookOpen,
  RotateCcw,
  Plus,
  LogOut,
  Loader2,
  CheckCircle2,
  Trash2,
  Trophy,
  Star,
  Flame,
  Target,
  Sparkles,
  Lightbulb,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { getColorFromString, getIconForTopic } from "@/utils/colorUtils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SortableLearningPath } from "@/components/SortableLearningPath";

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
  const [mnemonics, setMnemonics] = useState<any[]>([]);

  useEffect(() => {
    checkAuth();
    fetchLearningPaths();
    fetchReviewStats();
    fetchPathProgress();
    fetchMissionStats();
    fetchMnemonics();
  }, []);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
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
      const { data, error } = await supabase.from("user_progress").select("next_review").not("next_review", "is", null);

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
      const {
        data: { user },
      } = await supabase.auth.getUser();
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

      const reviewedCardIds = new Set(progress?.map((p) => p.card_id) || []);

      // Group cards by path and topic
      const pathTopicStats: Record<string, Record<string, { total: number; reviewed: number }>> = {};

      allCards?.forEach((card) => {
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
      paths?.forEach((path) => {
        const structure = path.structure as any;
        const totalTopicsInStructure = structure?.topics?.length || 0;
        const topicStats = pathTopicStats[path.id] || {};

        let completedTopics = 0;

        // Count how many topics are 100% complete (exactly like LearningPath line 104-109)
        Object.values(topicStats).forEach((stats) => {
          const pct = stats.total > 0 ? (stats.reviewed / stats.total) * 100 : 0;
          if (pct === 100) {
            completedTopics++;
          }
        });

        // Progress is: completed topics / ALL topics in structure (exactly like LearningPath line 240)
        progressPct[path.id] = totalTopicsInStructure > 0 ? (completedTopics / totalTopicsInStructure) * 100 : 0;
      });

      setPathProgress(progressPct);
    } catch (error: any) {
      console.error("Failed to fetch path progress:", error);
    }
  };

  const fetchMissionStats = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch or create user stats
      let { data: stats } = await supabase.from("user_stats").select("*").eq("user_id", user.id).maybeSingle();

      if (!stats) {
        const { data: newStats } = await supabase.from("user_stats").insert({ user_id: user.id }).select().single();
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

  const fetchMnemonics = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.from("mnemonics").select("id").eq("user_id", user.id);

      if (error) throw error;
      setMnemonics(data || []);
    } catch (error: any) {
      console.error("Failed to fetch mnemonics:", error);
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
      const { data: functionData, error: functionError } = await supabase.functions.invoke("generate-learning-path", {
        body: { subject: newSubject },
      });

      if (functionError) throw functionError;

      // Save to database
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
      const { error } = await supabase.from("learning_paths").delete().eq("id", pathId);

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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = learningPaths.findIndex((path) => path.id === active.id);
      const newIndex = learningPaths.findIndex((path) => path.id === over.id);

      setLearningPaths(arrayMove(learningPaths, oldIndex, newIndex));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Dark Header inspired by reference */}
      <header className="bg-foreground text-background border-b border-border/10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-white font-bold text-lg">
              {userStats?.level || "1"}
            </div>
            <div>
              <h2 className="font-semibold text-sm">LearnSmart</h2>
              <p className="text-xs opacity-70">Student</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="text-background hover:bg-background/10"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Stats Grid - Mobile First */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card
            className="p-4 rounded-2xl border-0 shadow-lg cursor-pointer transition-all hover:shadow-xl active:scale-95 bg-gradient-to-br from-blue-500/10 to-indigo-500/10"
            onClick={() => navigate("/spaced-repetition")}
          >
            <div className="flex flex-col gap-2">
              <div className="text-2xl font-bold flex items-center gap-1">
                <Brain className="w-5 h-5 text-blue-500" />
                {dueCardsCount}
              </div>
              <div className="text-xs text-muted-foreground">Gennemgang</div>
            </div>
          </Card>

          <Card
            className="p-4 rounded-2xl border-0 shadow-lg cursor-pointer transition-all hover:shadow-xl active:scale-95"
            onClick={() => navigate("/missions")}
          >
            <div className="flex flex-col gap-2">
              <div className="text-2xl font-bold flex items-center gap-1">
                <Flame className="w-5 h-5 text-orange-500" />
                {userStats?.current_streak || 0}
              </div>
              <div className="text-xs text-muted-foreground">Dages streak</div>
            </div>
          </Card>

          <Card
            className="p-4 rounded-2xl border-0 shadow-lg cursor-pointer transition-all hover:shadow-xl active:scale-95 bg-gradient-to-br from-green-500/10 to-emerald-500/10"
            onClick={() => navigate("/mnemonics")}
          >
            <div className="flex flex-col gap-2">
              <div className="text-2xl font-bold flex items-center gap-1">
                <Lightbulb className="w-5 h-5 text-green-500" />
                {mnemonics?.length || 0}
              </div>
              <div className="text-xs text-muted-foreground">Huskeregler</div>
            </div>
          </Card>

          <Card
            className="p-4 rounded-2xl border-0 shadow-lg cursor-pointer transition-all hover:shadow-xl active:scale-95 bg-gradient-to-br from-pink-500/10 to-purple-500/10"
            onClick={() => navigate("/vibe-learning")}
          >
            <div className="flex flex-col gap-2">
              <Sparkles className="w-6 h-6 text-pink-500" />
              <div className="text-xs text-muted-foreground font-medium">Vibe AI</div>
            </div>
          </Card>
        </div>

        {/* Featured Courses Section */}
        <div className="mb-8 overflow-visible">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Emner</h2>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 hide-scrollbar">
            <Card
              className="min-w-[160px] p-4 rounded-2xl border-0 shadow-lg cursor-pointer transition-all hover:shadow-xl active:scale-95 flex-shrink-0"
              style={{ background: "var(--gradient-orange)" }}
              onClick={() => navigate("/spaced-repetition")}
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Brain className="w-8 h-8 text-white" />
                  <Target className="w-4 h-4 text-white/70" />
                </div>
                <div>
                  <div className="text-white font-semibold text-sm mb-0.5">Gennemgang</div>
                  <div className="text-white/80 text-xs">{dueCardsCount} kort</div>
                </div>
              </div>
            </Card>

            <Card
              className="min-w-[160px] p-4 rounded-2xl border-0 shadow-lg cursor-pointer transition-all hover:shadow-xl active:scale-95 flex-shrink-0"
              style={{ background: "var(--gradient-blue)" }}
              onClick={() => navigate("/vibe-learning")}
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Sparkles className="w-8 h-8 text-white" />
                  <CheckCircle2 className="w-4 h-4 text-white/70" />
                </div>
                <div>
                  <div className="text-white font-semibold text-sm mb-0.5">Vibe AI</div>
                  <div className="text-white/80 text-xs">Chat & lær</div>
                </div>
              </div>
            </Card>

            <Card
              className="min-w-[160px] p-4 rounded-2xl border-0 shadow-lg cursor-pointer transition-all hover:shadow-xl active:scale-95 flex-shrink-0"
              style={{ background: "var(--gradient-primary)" }}
              onClick={() => navigate("/missions")}
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Trophy className="w-8 h-8 text-white" />
                  <Star className="w-4 h-4 text-white/70" />
                </div>
                <div>
                  <div className="text-white font-semibold text-sm mb-0.5">Missioner</div>
                  <div className="text-white/80 text-xs">{activeMissions} aktive</div>
                </div>
              </div>
            </Card>

            <Card
              className="min-w-[160px] p-4 rounded-2xl border-0 shadow-lg cursor-pointer transition-all hover:shadow-xl active:scale-95 flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}
              onClick={() => navigate("/mnemonics")}
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Lightbulb className="w-8 h-8 text-white" />
                  <Brain className="w-4 h-4 text-white/70" />
                </div>
                <div>
                  <div className="text-white font-semibold text-sm mb-0.5">Husketeknik</div>
                  <div className="text-white/80 text-xs">Mine regler</div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Learning Paths Section - Ongoing style */}
        <div id="learning-paths" className="overflow-visible">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Læringsstier</h2>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <Button
                onClick={() => navigate("/create")}
                size="sm"
                className="gap-2"
                style={{ background: "var(--gradient-primary)" }}
              >
                <Plus className="w-4 h-4" />
                Ny
              </Button>
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
                  <Button className="w-full" onClick={createLearningPath} disabled={creating}>
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

          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : learningPaths.length === 0 ? (
              <Card className="p-12 text-center rounded-2xl border-0 shadow-lg">
                <Brain className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">Ingen læringsstier endnu</h3>
                <p className="text-muted-foreground mb-4">Opret din første læringssti for at komme i gang!</p>
              </Card>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={learningPaths.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                  {learningPaths.map((path) => {
                    const progress = pathProgress[path.id] || 0;

                    return (
                      <SortableLearningPath
                        key={path.id}
                        path={path}
                        progress={progress}
                        onDelete={setDeletingPathId}
                        onClick={() => navigate(`/path/${path.id}`)}
                      />
                    );
                  })}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      </main>

      <AlertDialog open={!!deletingPathId} onOpenChange={() => setDeletingPathId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil permanent slette læringsstien og alle tilhørende kort og fremskridt. Denne handling kan ikke
              fortrydes.
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
