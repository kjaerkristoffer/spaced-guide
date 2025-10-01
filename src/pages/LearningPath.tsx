import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, ArrowLeft, Play, CheckCircle2, Loader2 } from "lucide-react";
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

  useEffect(() => {
    fetchPath();
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

  const startTopic = async (topic: Topic) => {
    setGeneratingCards(topic.title);
    try {
      // Generate cards for this topic
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        "generate-cards",
        { body: { topic: `${path?.subject} - ${topic.title}: ${topic.description}`, count: 8 } }
      );

      if (functionError) throw functionError;

      // Save cards to database
      const { data: { user } } = await supabase.auth.getUser();
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

      toast.success("Cards generated! Starting learning session...");
      navigate(`/learn?path=${id}&topic=${encodeURIComponent(topic.title)}`);
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
            <h1 className="text-3xl font-bold">{path?.subject}</h1>
          </div>
          <p className="text-muted-foreground">
            {path?.structure?.topics?.length || 0} topics to master
          </p>
        </div>

        <div className="space-y-4">
          {path?.structure?.topics?.map((topic: Topic, index: number) => (
            <Card 
              key={index}
              className="shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-elevated)]"
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold">
                        {topic.order}
                      </span>
                      {topic.title}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      {topic.description}
                    </CardDescription>
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
                      Generating Cards...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Start Learning
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default LearningPath;
