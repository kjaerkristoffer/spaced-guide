import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FlashCard from "@/components/FlashCard";
import QuizCard from "@/components/QuizCard";
import FillBlankCard from "@/components/FillBlankCard";
import OpenEndedCard from "@/components/OpenEndedCard";
import { trackCardCompletion } from "@/utils/progressTracker";

interface Card {
  id: string;
  question: string;
  answer: string;
  card_type: string;
  options: string[] | null;
  topic: string;
}

const Learn = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pathId = searchParams.get("path");
  const topic = searchParams.get("topic");
  const shouldResume = searchParams.get("resume") === "true";

  const [cards, setCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [readingContent, setReadingContent] = useState<string>("");
  const [showReading, setShowReading] = useState(!shouldResume);
  const [readingTime, setReadingTime] = useState(0);

  useEffect(() => {
    if (!pathId || !topic) {
      navigate("/dashboard");
      return;
    }
    fetchCards();
  }, [pathId, topic]);

  const fetchCards = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("cards")
        .select("*")
        .eq("learning_path_id", pathId)
        .eq("topic", topic);

      if (error) throw error;
      
      if (!data || data.length === 0) {
        toast.error("Ingen kort fundet for dette emne");
        navigate(`/path/${pathId}`);
        return;
      }

      setCards(data as Card[]);

      // If resuming, find the first unreviewed card
      if (shouldResume) {
        const { data: progressData } = await supabase
          .from("user_progress")
          .select("card_id")
          .eq("user_id", user?.id);

        const reviewedCardIds = new Set(progressData?.map(p => p.card_id) || []);
        
        // Find the first card that hasn't been reviewed
        const firstUnreviewedIndex = data.findIndex(card => !reviewedCardIds.has(card.id));
        
        if (firstUnreviewedIndex > 0) {
          setCurrentIndex(firstUnreviewedIndex);
        }
      }

      // Fetch reading content from learning path
      const { data: pathData } = await supabase
        .from("learning_paths")
        .select("structure")
        .eq("id", pathId)
        .single();

      if (pathData) {
        const structure = pathData.structure as any;
        const topicData = structure.topics?.find((t: any) => t.title === topic);
        if (topicData?.readingContent) {
          setReadingContent(topicData.readingContent);
          // Calculate reading time (assuming 200 words per minute)
          const wordCount = topicData.readingContent.split(/\s+/).length;
          setReadingTime(Math.ceil(wordCount / 200));
        } else {
          setShowReading(false);
        }
      }
    } catch (error: any) {
      toast.error("Kunne ikke indlæse kort");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleRate = async (rating: number) => {
    const card = cards[currentIndex];
    const isLastCard = currentIndex >= cards.length - 1;
    const isOpenEndedCard = currentIndex === cards.length;
    
    // Immediately move to next card or complete
    if (!isLastCard && !isOpenEndedCard) {
      setCurrentIndex(currentIndex + 1);
    } else if (isLastCard && !isOpenEndedCard) {
      // Move to open-ended question after last card
      setCurrentIndex(currentIndex + 1);
    } else {
      toast.success("Emne fuldført!");
      navigate(`/path/${pathId}`);
    }
    
    // Run database updates in background (non-blocking)
    const updateProgress = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const now = new Date();
        const intervals = [1, 3, 7, 14, 30]; // days
        const masteryIncrease = rating >= 3 ? 1 : 0;
        
        // Check if progress exists
        const { data: existingProgress } = await supabase
          .from("user_progress")
          .select("*")
          .eq("user_id", user.id)
          .eq("card_id", card.id)
          .maybeSingle();

        const currentMastery = existingProgress?.mastery_level || 0;
        const newMastery = Math.min(5, currentMastery + masteryIncrease);
        const daysToAdd = intervals[Math.min(newMastery, intervals.length - 1)];
        
        const nextReview = new Date(now);
        nextReview.setDate(nextReview.getDate() + daysToAdd);

        if (existingProgress) {
          await supabase
            .from("user_progress")
            .update({
              mastery_level: newMastery,
              last_reviewed: now.toISOString(),
              next_review: nextReview.toISOString(),
              review_count: existingProgress.review_count + 1,
            })
            .eq("id", existingProgress.id);
        } else {
          await supabase
            .from("user_progress")
            .insert({
              user_id: user.id,
              card_id: card.id,
              mastery_level: newMastery,
              last_reviewed: now.toISOString(),
              next_review: nextReview.toISOString(),
              review_count: 1,
            });
        }

        // Track completion for missions and achievements
        await trackCardCompletion(user.id, rating);
      } catch (error: any) {
        console.error("Error updating progress:", error);
      }
    };
    
    // Fire and forget - don't await
    updateProgress();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (showReading && readingContent) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border">
          <div className="container mx-auto px-4 py-4">
            <Button variant="ghost" onClick={() => navigate(`/path/${pathId}`)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Afslut
            </Button>
          </div>
        </header>

        <div className="container max-w-3xl mx-auto px-4 py-8">
          <Card className="shadow-[var(--shadow-elevated)]">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <BookOpen className="w-6 h-6 text-primary" />
                <CardTitle className="text-2xl">{topic}</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                {readingTime} min læsning · {cards.length} øvelsesspørgsmål følger
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="prose prose-lg dark:prose-invert max-w-none">
                {readingContent.split('\n\n').map((paragraph, index) => {
                  // Convert markdown bold (**text**) and italic (*text*) to HTML
                  const formattedParagraph = paragraph
                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.+?)\*/g, '<em>$1</em>');
                  
                  return (
                    <p 
                      key={index} 
                      className="text-base leading-relaxed mb-4"
                      dangerouslySetInnerHTML={{ __html: formattedParagraph }}
                    />
                  );
                })}
              </div>
              
              <div className="pt-6 border-t">
                <Button 
                  onClick={() => setShowReading(false)} 
                  className="w-full"
                  size="lg"
                >
                  Start Øvelsesspørgsmål ({cards.length} spørgsmål)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const currentCard = currentIndex < cards.length ? cards[currentIndex] : null;
  const isOpenEndedQuestion = currentIndex === cards.length;
  const totalSteps = cards.length + 1; // cards + open-ended question
  const progress = ((currentIndex + 1) / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate(`/path/${pathId}`)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Afslut
            </Button>
            <div className="text-sm font-medium">
              {currentIndex + 1} / {totalSteps}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold">{topic}</h2>
            <span className="text-sm text-muted-foreground">
              {Math.round(progress)}%
            </span>
          </div>
          <Progress value={progress} />
        </div>

        <div className="py-8">
          {isOpenEndedQuestion ? (
            <OpenEndedCard
              question={`Forklar hvad du har lært om "${topic}". Hvad er de vigtigste punkter?`}
              topic={topic || ""}
              onRate={handleRate}
            />
          ) : currentCard ? (
            currentCard.card_type === "flashcard" ? (
              <FlashCard
                key={currentCard.id}
                question={currentCard.question}
                answer={currentCard.answer}
                onRate={handleRate}
              />
            ) : currentCard.card_type === "quiz" ? (
              <QuizCard
                key={currentCard.id}
                question={currentCard.question}
                answer={currentCard.answer}
                options={currentCard.options || []}
                onRate={handleRate}
              />
            ) : (
              <FillBlankCard
                key={currentCard.id}
                question={currentCard.question}
                answer={currentCard.answer}
                options={currentCard.options || []}
                onRate={handleRate}
              />
            )
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Learn;
