import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import FlashCard from "@/components/FlashCard";
import QuizCard from "@/components/QuizCard";

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

  const [cards, setCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pathId || !topic) {
      navigate("/dashboard");
      return;
    }
    fetchCards();
  }, [pathId, topic]);

  const fetchCards = async () => {
    try {
      const { data, error } = await supabase
        .from("cards")
        .select("*")
        .eq("learning_path_id", pathId)
        .eq("topic", topic);

      if (error) throw error;
      
      if (!data || data.length === 0) {
        toast.error("No cards found for this topic");
        navigate(`/path/${pathId}`);
        return;
      }

      setCards(data as Card[]);
    } catch (error: any) {
      toast.error("Failed to load cards");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleRate = async (rating: number) => {
    const card = cards[currentIndex];
    
    // Calculate next review date based on rating (simplified spaced repetition)
    const now = new Date();
    const intervals = [1, 3, 7, 14, 30]; // days
    const masteryIncrease = rating >= 3 ? 1 : 0;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Check if progress exists
      const { data: existingProgress } = await supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", user?.id)
        .eq("card_id", card.id)
        .single();

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
            user_id: user?.id,
            card_id: card.id,
            mastery_level: newMastery,
            last_reviewed: now.toISOString(),
            next_review: nextReview.toISOString(),
            review_count: 1,
          });
      }

      // Move to next card
      if (currentIndex < cards.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        toast.success("Topic completed!");
        navigate(`/path/${pathId}`);
      }
    } catch (error: any) {
      console.error("Error updating progress:", error);
      toast.error("Failed to save progress");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentCard = cards[currentIndex];
  const progress = ((currentIndex + 1) / cards.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate(`/path/${pathId}`)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Exit
            </Button>
            <div className="text-sm font-medium">
              {currentIndex + 1} / {cards.length}
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
          {currentCard.card_type === "flashcard" ? (
            <FlashCard
              key={currentCard.id}
              question={currentCard.question}
              answer={currentCard.answer}
              onRate={handleRate}
            />
          ) : (
            <QuizCard
              key={currentCard.id}
              question={currentCard.question}
              answer={currentCard.answer}
              options={currentCard.options || []}
              onRate={handleRate}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Learn;
