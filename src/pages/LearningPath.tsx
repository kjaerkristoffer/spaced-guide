import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, ArrowLeft, Play, CheckCircle2, Loader2, Award } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Tilbage til Dashboard</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 sm:py-8 max-w-4xl">
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl" style={{ background: "var(--gradient-primary)" }}>
                <Brain className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">{path?.subject}</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {path?.structure?.topics?.length || 0} emner
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:text-right">
              <Award className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
              <div>
                <span className="text-lg sm:text-2xl font-bold">
                  {completedTopics.size}/{path?.structure?.topics?.length || 0}
                </span>
                <p className="text-xs sm:text-sm text-muted-foreground">Fuldført</p>
              </div>
            </div>
          </div>
          <Progress 
            value={(completedTopics.size / (path?.structure?.topics?.length || 1)) * 100} 
            className="h-2"
          />
        </div>

        <div className="space-y-4">
          {path?.structure?.topics?.map((topic: Topic, index: number) => {
            const isCompleted = completedTopics.has(topic.title);
            const progress = topicProgress[topic.title] || 0;
            const isInProgress = progress > 0 && progress < 100;
            
            return (
              <Card 
                key={index}
                className={`p-4 sm:p-6 rounded-2xl border-0 bg-gradient-to-br from-background to-muted/20 shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-elevated)] ${
                  isCompleted ? 'ring-2 ring-success' : ''
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full flex-shrink-0 ${
                      isCompleted ? 'bg-success text-white' : 'bg-primary/10 text-primary'
                    }`}>
                      {isCompleted ? <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" /> : (
                        <span className="text-sm sm:text-base font-bold">{topic.order}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base sm:text-lg font-semibold mb-1 flex items-center gap-2 flex-wrap">
                        <span className="break-words">{topic.title}</span>
                        {isCompleted && (
                          <span className="text-xs font-normal text-success whitespace-nowrap">✓ Fuldført</span>
                        )}
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground mb-2 line-clamp-2">
                        {topic.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ~{topic.estimatedMinutes} min
                      </p>
                      {progress > 0 && progress < 100 && (
                        <div className="mt-3">
                          <Progress value={progress} className="h-1.5" />
                          <p className="text-xs text-muted-foreground mt-1">
                            {Math.round(progress)}% fuldført
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={() => startTopic(topic)}
                    disabled={generatingCards === topic.title}
                    className="w-full sm:w-auto whitespace-nowrap"
                    variant={isInProgress ? "secondary" : "default"}
                    size="lg"
                  >
                    {generatingCards === topic.title ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin flex-shrink-0" />
                        <span className="truncate">Genererer...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span className="truncate">
                          {isCompleted ? 'Gennemgå' : isInProgress ? 'Fortsæt' : 'Start'}
                        </span>
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default LearningPath;
