import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import FlashCard from "@/components/FlashCard";
import QuizCard from "@/components/QuizCard";

interface ReviewCard {
  id: string;
  card_id: string;
  mastery_level: number;
  next_review: string;
  cards: {
    id: string;
    question: string;
    answer: string;
    card_type: string;
    options: string[] | null;
    topic: string;
  };
}

const Review = () => {
  const navigate = useNavigate();
  const [reviewCards, setReviewCards] = useState<ReviewCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDueCards();
  }, []);

  const fetchDueCards = async () => {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("user_progress")
        .select(`
          *,
          cards (
            id,
            question,
            answer,
            card_type,
            options,
            topic
          )
        `)
        .lte("next_review", now)
        .order("next_review", { ascending: true });

      if (error) throw error;
      
      setReviewCards(data as ReviewCard[]);
    } catch (error: any) {
      toast.error("Failed to load review cards");
    } finally {
      setLoading(false);
    }
  };

  const handleRate = async (rating: number) => {
    const reviewCard = reviewCards[currentIndex];
    
    // Calculate next review date based on rating and current mastery
    const now = new Date();
    const intervals = [1, 3, 7, 14, 30]; // days
    const masteryChange = rating >= 3 ? 1 : -1;
    const newMastery = Math.max(0, Math.min(5, reviewCard.mastery_level + masteryChange));
    const daysToAdd = intervals[Math.min(newMastery, intervals.length - 1)];
    
    const nextReview = new Date(now);
    nextReview.setDate(nextReview.getDate() + daysToAdd);

    try {
      await supabase
        .from("user_progress")
        .update({
          mastery_level: newMastery,
          last_reviewed: now.toISOString(),
          next_review: nextReview.toISOString(),
          review_count: reviewCard.cards ? (reviewCard as any).review_count + 1 : 1,
        })
        .eq("id", reviewCard.id);

      // Move to next card
      if (currentIndex < reviewCards.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        toast.success("All reviews completed!");
        navigate("/dashboard");
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

  if (reviewCards.length === 0) {
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
        
        <div className="container mx-auto px-4 py-16">
          <Card className="max-w-md mx-auto text-center p-12">
            <CardContent>
              <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-success" />
              <h2 className="text-2xl font-bold mb-2">All caught up!</h2>
              <p className="text-muted-foreground mb-6">
                No cards due for review right now. Keep learning new topics!
              </p>
              <Button onClick={() => navigate("/dashboard")}>
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const currentCard = reviewCards[currentIndex];
  const progress = ((currentIndex + 1) / reviewCards.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Exit
            </Button>
            <div className="text-sm font-medium">
              {currentIndex + 1} / {reviewCards.length}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold">Spaced Repetition Review</h2>
            <span className="text-sm text-muted-foreground">
              {Math.round(progress)}%
            </span>
          </div>
          <Progress value={progress} />
          <p className="text-sm text-muted-foreground mt-2">
            Topic: {currentCard.cards.topic} • Mastery Level: {currentCard.mastery_level}/5
          </p>
        </div>

        <div className="py-8">
          {currentCard.cards.card_type === "flashcard" ? (
            <FlashCard
              question={currentCard.cards.question}
              answer={currentCard.cards.answer}
              onRate={handleRate}
            />
          ) : (
            <QuizCard
              question={currentCard.cards.question}
              answer={currentCard.cards.answer}
              options={currentCard.cards.options || []}
              onRate={handleRate}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Review;
