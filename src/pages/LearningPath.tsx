import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, ArrowLeft, Play, CheckCircle2, Loader2, Award, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { getColorFromString, getIconForTopic } from "@/utils/colorUtils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Topic {
  title: string;
  description: string;
  order: number;
  estimatedMinutes: number;
}

interface LearningPath {
  id: string;
  subject: string;
  structure: {
    topics: Topic[];
  };
}

const LearningPath = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [path, setPath] = useState<LearningPath | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingCards, setGeneratingCards] = useState<string | null>(null);
  const [completedTopics, setCompletedTopics] = useState<Set<string>>(new Set());
  const [topicProgress, setTopicProgress] = useState<Record<string, number>>({});
  const [showContinueDialog, setShowContinueDialog] = useState(false);
  const [continuePrompt, setContinuePrompt] = useState("");
  const [difficulty, setDifficulty] = useState<"easier" | "harder">("harder");
  const [generatingPath, setGeneratingPath] = useState(false);

  useEffect(() => {
    fetchPath();
    fetchProgress();
  }, [id]);

  const fetchPath = async () => {
    try {
      const { data, error } = await supabase
        .from("learning_paths")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching learning path:", error);
        throw error;
      }
      
      if (!data) {
        toast.error("Denne læringssti eksisterer ikke længere. Måske er den blevet slettet?");
        navigate("/dashboard");
        return;
      }
      
      setPath(data as unknown as LearningPath);
    } catch (error: any) {
      console.error("Failed to load learning path:", error);
      toast.error("Kunne ikke indlæse læringssti");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const fetchProgress = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Get all cards for this path
      const { data: allCards, error: cardsError } = await supabase
        .from("cards")
        .select("id, topic")
        .eq("learning_path_id", id);

      if (cardsError) throw cardsError;

      // Get progress for these cards (any that have been reviewed)
      const { data: progress, error: progressError } = await supabase
        .from("user_progress")
        .select("card_id")
        .eq("user_id", user?.id);

      if (progressError) throw progressError;

      const reviewedCardIds = new Set(progress?.map(p => p.card_id) || []);
      const topicStats: Record<string, { total: number; reviewed: number }> = {};

      allCards?.forEach(card => {
        if (!topicStats[card.topic]) {
          topicStats[card.topic] = { total: 0, reviewed: 0 };
        }
        topicStats[card.topic].total++;
        if (reviewedCardIds.has(card.id)) {
          topicStats[card.topic].reviewed++;
        }
      });

      const completed = new Set<string>();
      const progress_pct: Record<string, number> = {};

      Object.entries(topicStats).forEach(([topic, stats]) => {
        const pct = stats.total > 0 ? (stats.reviewed / stats.total) * 100 : 0;
        progress_pct[topic] = pct;
        if (pct === 100) {
          completed.add(topic);
        }
      });

      setCompletedTopics(completed);
      setTopicProgress(progress_pct);
    } catch (error: any) {
      console.error("Failed to fetch progress:", error);
    }
  };

  const startTopic = async (topic: Topic) => {
    setGeneratingCards(topic.title);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Check if cards already exist for this topic
      const { data: existingCards, error: checkError } = await supabase
        .from("cards")
        .select("id")
        .eq("learning_path_id", id)
        .eq("topic", topic.title)
        .eq("user_id", user?.id);

      if (checkError) throw checkError;

      // If cards already exist, navigate with resume flag
      if (existingCards && existingCards.length > 0) {
        const progress = topicProgress[topic.title] || 0;
        const isInProgress = progress > 0 && progress < 100;
        
        toast.success(isInProgress ? "Genoptager emne..." : "Gennemgår emne...");
        navigate(`/learn?path=${id}&topic=${encodeURIComponent(topic.title)}${isInProgress ? '&resume=true' : ''}`);
        setGeneratingCards(null);
        return;
      }

      // Generate cards and reading content for this topic
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        "generate-cards",
        { body: { topic: `${path?.subject} - ${topic.title}: ${topic.description}`, count: 8, generateReading: true } }
      );

      if (functionError) throw functionError;

      // Validate response structure
      if (!functionData || !functionData.cards || !Array.isArray(functionData.cards)) {
        console.error("Invalid response from generate-cards:", functionData);
        throw new Error("Kunne ikke generere kort. Prøv venligst igen.");
      }

      // Save cards to database
      const cardsToInsert = functionData.cards.map((card: any) => ({
        learning_path_id: id,
        user_id: user?.id,
        topic: topic.title,
        question: card.question,
        answer: card.answer,
        card_type: card.type,
        options: card.options,
      }));

      const { error: insertError } = await supabase
        .from("cards")
        .insert(cardsToInsert);

      if (insertError) throw insertError;

      // Update learning path with reading content
      if (functionData.reading) {
        const updatedTopics = path!.structure.topics.map((t: Topic) =>
          t.title === topic.title ? { ...t, readingContent: functionData.reading } : t
        );
        
        await supabase
          .from("learning_paths")
          .update({ structure: { ...path!.structure, topics: updatedTopics } as any })
          .eq("id", id);
      }

      toast.success("Indhold genereret! Starter læringssession...");
      navigate(`/learn?path=${id}&topic=${encodeURIComponent(topic.title)}`);
      fetchProgress();
    } catch (error: any) {
      toast.error(error.message || "Kunne ikke generere kort");
    } finally {
      setGeneratingCards(null);
    }
  };

  const handleContinueLearning = async () => {
    if (!continuePrompt.trim()) {
      toast.error("Beskriv venligst hvad du vil lære");
      return;
    }

    setGeneratingPath(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Build context from all completed topics
      const previousLearning = path!.structure.topics.map((topic: Topic) => 
        `${topic.title}: ${topic.description}`
      ).join("\n");

      const difficultyPrompt = difficulty === "harder" 
        ? "Gør det mere avanceret og sværere end det tidligere indhold."
        : "Gør det mere grundlæggende og nemmere end det tidligere indhold.";

      const fullPrompt = `Baseret på tidligere læring inden for ${path!.subject}:

${previousLearning}

Brugerens ønske: ${continuePrompt}

${difficultyPrompt}

Skab en ny læringssti der bygger videre på den tidligere viden og matcher brugerens ønsker.`;

      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        "generate-learning-path",
        { body: { subject: fullPrompt } }
      );

      if (functionError) throw functionError;

      // Create new learning path
      const { data: newPath, error: insertError } = await supabase
        .from("learning_paths")
        .insert({
          user_id: user?.id,
          subject: `${path!.subject} (Fortsættelse)`,
          structure: functionData
        })
        .select()
        .single();

      if (insertError) throw insertError;

      toast.success("Ny læringssti genereret!");
      navigate(`/path/${newPath.id}`);
    } catch (error: any) {
      console.error("Error generating continuation:", error);
      toast.error("Kunne ikke generere ny læringssti");
    } finally {
      setGeneratingPath(false);
      setShowContinueDialog(false);
      setContinuePrompt("");
    }
  };

  const allTopicsCompleted = path?.structure?.topics?.length > 0 && 
    completedTopics.size === path?.structure?.topics?.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="gap-2 -ml-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Tilbage</span>
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10">
                <Award className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">
                  {completedTopics.size}/{path?.structure?.topics?.length || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Title Card */}
        <Card className="mb-6 p-5 rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-background to-primary/5">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold">{path?.subject}</h1>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center">
                <Award className="w-5 h-5 text-yellow-700" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">SCORE</span>
              <span className="text-2xl font-bold text-primary">
                {completedTopics.size}
              </span>
              <span className="text-muted-foreground">ud af {path?.structure?.topics?.length || 0}</span>
            </div>
          </div>
        </Card>

        {/* Topics List */}
        <div className="space-y-4">
          {path?.structure?.topics?.map((topic: Topic, index: number) => {
            const isCompleted = completedTopics.has(topic.title);
            const progress = topicProgress[topic.title] || 0;
            const isInProgress = progress > 0 && progress < 100;
            
            return (
              <Card 
                key={index}
                className="p-4 rounded-2xl border bg-background hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3">
                  {/* Icon with gradient */}
                  <div 
                    className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl`}
                    style={{ 
                      background: isCompleted 
                        ? 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' 
                        : getColorFromString(topic.title)
                    }}
                  >
                    {isCompleted ? '✓' : getIconForTopic(topic.title)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-base font-semibold leading-tight">
                        {topic.title}
                      </h3>
                      <Button
                        onClick={() => startTopic(topic)}
                        disabled={generatingCards === topic.title}
                        size="sm"
                        className={`flex-shrink-0 ${
                          isCompleted 
                            ? 'bg-background text-foreground border hover:bg-accent' 
                            : isInProgress 
                            ? 'bg-primary/10 text-primary hover:bg-primary/20' 
                            : ''
                        }`}
                        variant={isCompleted || isInProgress ? "outline" : "default"}
                      >
                        {generatingCards === topic.title ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isCompleted ? (
                          <span className="text-xs font-medium px-2">GENNEMGÅ</span>
                        ) : isInProgress ? (
                          <span className="text-xs font-medium px-2">FORTSÆT</span>
                        ) : (
                          <span className="text-xs font-medium px-2">START</span>
                        )}
                      </Button>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                      {isCompleted ? (
                        <>
                          <div className="flex items-center gap-1">
                            <span className="text-yellow-500">★</span>
                            <span className="font-medium">Fuldført</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-full bg-green-400" />
                            <span className="font-medium">100%</span>
                          </div>
                        </>
                      ) : isInProgress ? (
                        <>
                          <div className="flex items-center gap-1">
                            <span className="text-yellow-500">★</span>
                            <span className="font-medium">{Math.round(progress)}%</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-full bg-blue-400" />
                            <span className="font-medium">I gang</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-1">
                            <span className="text-gray-300">★</span>
                            <span>0%</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-full bg-gray-300" />
                            <span>Ikke startet</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="relative h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                          isCompleted ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-primary to-primary/70'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Continue Learning Button */}
        <Card className={`mt-8 p-6 rounded-2xl border-2 transition-all ${
          allTopicsCompleted 
            ? 'border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-lg' 
            : 'border-gray-200 bg-gray-50'
        }`}>
          <div className="flex flex-col items-center text-center gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              allTopicsCompleted 
                ? 'bg-gradient-to-r from-primary to-primary/70' 
                : 'bg-gray-300'
            }`}>
              <Sparkles className={`w-8 h-8 ${allTopicsCompleted ? 'text-white' : 'text-gray-500'}`} />
            </div>
            <div>
              <h3 className={`text-lg font-bold mb-2 ${allTopicsCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                {allTopicsCompleted ? 'Fantastisk arbejde! 🎉' : 'Gennemfør alle emner'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {allTopicsCompleted 
                  ? 'Du har gennemført alle emner! Klar til at lære mere?' 
                  : 'Gennemfør alle emner for at fortsætte din læring'}
              </p>
            </div>
            <Button
              onClick={() => setShowContinueDialog(true)}
              disabled={!allTopicsCompleted}
              size="lg"
              className={`gap-2 ${
                allTopicsCompleted 
                  ? 'bg-gradient-to-r from-primary to-primary/70 hover:from-primary/90 hover:to-primary/60' 
                  : ''
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Fortsæt læring
            </Button>
          </div>
        </Card>
      </main>

      {/* Continue Learning Dialog */}
      <Dialog open={showContinueDialog} onOpenChange={setShowContinueDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Fortsæt din læring
            </DialogTitle>
            <DialogDescription>
              Hvad vil du gerne lære næste gang inden for {path?.subject}?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="continue-prompt">Beskriv hvad du vil lære</Label>
              <Textarea
                id="continue-prompt"
                placeholder="F.eks. jeg vil gerne lære mere om avancerede teknikker..."
                value={continuePrompt}
                onChange={(e) => setContinuePrompt(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="difficulty">Sværhedsgrad</Label>
              <Select value={difficulty} onValueChange={(value: "easier" | "harder") => setDifficulty(value)}>
                <SelectTrigger id="difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easier">Nemmere end før</SelectItem>
                  <SelectItem value="harder">Sværere end før</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowContinueDialog(false);
                setContinuePrompt("");
              }}
              disabled={generatingPath}
            >
              Annuller
            </Button>
            <Button
              onClick={handleContinueLearning}
              disabled={generatingPath || !continuePrompt.trim()}
              className="gap-2"
            >
              {generatingPath ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Genererer...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generer ny læringssti
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LearningPath;
