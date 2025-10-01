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
        .single();

      if (error) throw error;
      setPath(data as unknown as LearningPath);
    } catch (error: any) {
      toast.error("Failed to load learning path");
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

      // Get progress for these cards
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

      // If cards already exist, just navigate to the learning page
      if (existingCards && existingCards.length > 0) {
        toast.success("Resuming topic...");
        navigate(`/learn?path=${id}&topic=${encodeURIComponent(topic.title)}`);
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
        throw new Error("Failed to generate cards. Please try again.");
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

      toast.success("Content generated! Starting learning session...");
      navigate(`/learn?path=${id}&topic=${encodeURIComponent(topic.title)}`);
      fetchProgress();
    } catch (error: any) {
      toast.error(error.message || "Failed to generate cards");
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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl" style={{ background: "var(--gradient-primary)" }}>
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold">{path?.subject}</h1>
              <p className="text-muted-foreground">
                {path?.structure?.topics?.length || 0} topics
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 mb-1">
                <Award className="w-5 h-5 text-primary" />
                <span className="text-2xl font-bold">
                  {completedTopics.size}/{path?.structure?.topics?.length || 0}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Completed</p>
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
            
            return (
              <Card 
                key={index}
                className={`shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-elevated)] ${
                  isCompleted ? 'border-green-500 border-2' : ''
                }`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <span className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                          isCompleted ? 'bg-green-500 text-white' : 'bg-primary/10 text-primary'
                        }`}>
                          {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : topic.order}
                        </span>
                        {topic.title}
                        {isCompleted && (
                          <span className="text-sm font-normal text-green-600">✓ Completed</span>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-2">
                        {topic.description}
                      </CardDescription>
                      {progress > 0 && progress < 100 && (
                        <div className="mt-3">
                          <Progress value={progress} className="h-1" />
                          <p className="text-xs text-muted-foreground mt-1">
                            {Math.round(progress)}% completed
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ~{topic.estimatedMinutes} min
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => startTopic(topic)}
                    disabled={generatingCards === topic.title}
                    className="w-full sm:w-auto"
                  >
                    {generatingCards === topic.title ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating Content...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        {isCompleted ? 'Review Topic' : 'Start Learning'}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default LearningPath;
