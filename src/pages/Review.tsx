import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import FlashCard from "@/components/FlashCard";
import QuizCard from "@/components/QuizCard";
import FillBlankCard from "@/components/FillBlankCard";

interface ReviewCard {
  id: string;
  card_id: string;
  mastery_level: number;
  last_reviewed: string;
  next_review: string;
  review_count: number;
  cards: {
    question: string;
    answer: string;
    card_type: string;
    options: string[] | null;
    topic: string;
    learning_path_id: string;
  };
}

interface HistoryCard {
  card_id: string;
  mastery_level: number;
  last_reviewed: string;
  review_count: number;
  question: string;
  answer: string;
  card_type: string;
  topic: string;
  learning_path_id: string;
  path_subject: string;
}

const Review = () => {
  const navigate = useNavigate();
  const [reviewCards, setReviewCards] = useState<ReviewCard[]>([]);
  const [historyCards, setHistoryCards] = useState<HistoryCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("review");

  useEffect(() => {
    fetchDueCards();
    fetchHistory();
  }, []);

  const fetchDueCards = async () => {
    try {
      const now = new Date().toISOString();
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("user_progress")
        .select(`
          *,
          cards (
            question,
            answer,
            card_type,
            options,
            topic,
            learning_path_id
          )
        `)
        .eq("user_id", user?.id)
        .lte("next_review", now)
        .order("next_review", { ascending: true });

      if (error) throw error;
      setReviewCards((data as any) || []);
    } catch (error: any) {
      toast.error("Failed to load review cards");
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("user_progress")
        .select(`
          card_id,
          mastery_level,
          last_reviewed,
          review_count,
          cards (
            question,
            answer,
            card_type,
            topic,
            learning_path_id,
            learning_paths (
              subject
            )
          )
        `)
        .eq("user_id", user?.id)
        .order("last_reviewed", { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((item: any) => ({
        card_id: item.card_id,
        mastery_level: item.mastery_level,
        last_reviewed: item.last_reviewed,
        review_count: item.review_count,
        question: item.cards.question,
        answer: item.cards.answer,
        card_type: item.cards.card_type,
        topic: item.cards.topic,
        learning_path_id: item.cards.learning_path_id,
        path_subject: item.cards.learning_paths?.subject || "Unknown",
      }));

      setHistoryCards(formatted);
    } catch (error: any) {
      console.error("Failed to load history:", error);
    }
  };

  const handleRate = async (rating: number) => {
    const card = reviewCards[currentIndex];
    const now = new Date();
    const intervals = [1, 3, 7, 14, 30];
    const masteryIncrease = rating >= 3 ? 1 : 0;
    const newMastery = Math.min(5, card.mastery_level + masteryIncrease);
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
          review_count: card.review_count + 1,
        })
        .eq("id", card.id);

      if (currentIndex < reviewCards.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        toast.success("All reviews completed!");
        fetchDueCards();
        fetchHistory();
        setCurrentIndex(0);
      }
    } catch (error: any) {
      toast.error("Failed to save progress");
    }
  };

  const getMasteryColor = (level: number) => {
    if (level >= 4) return "bg-green-500";
    if (level >= 2) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getMasteryLabel = (level: number) => {
    if (level >= 4) return "Mastered";
    if (level >= 2) return "Learning";
    return "New";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const groupedHistory = historyCards.reduce((acc, card) => {
    const key = `${card.learning_path_id}-${card.topic}`;
    if (!acc[key]) {
      acc[key] = {
        path: card.path_subject,
        topic: card.topic,
        cards: [],
      };
    }
    acc[key].cards.push(card);
    return acc;
  }, {} as Record<string, { path: string; topic: string; cards: HistoryCard[] }>);

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

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
            <TabsTrigger value="review">
              Due Now ({reviewCards.length})
            </TabsTrigger>
            <TabsTrigger value="history">
              History ({historyCards.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="review">
            {reviewCards.length === 0 ? (
              <Card className="max-w-2xl mx-auto text-center py-12">
                <CardContent>
                  <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500" />
                  <h2 className="text-2xl font-bold mb-2">All caught up!</h2>
                  <p className="text-muted-foreground mb-6">
                    No cards are due for review right now.
                  </p>
                  <Button onClick={() => navigate("/dashboard")}>
                    Back to Dashboard
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="mb-8 max-w-2xl mx-auto">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xl font-semibold">
                      {reviewCards[currentIndex]?.cards.topic}
                    </h2>
                    <span className="text-sm text-muted-foreground">
                      {currentIndex + 1} / {reviewCards.length}
                    </span>
                  </div>
                  <Progress value={((currentIndex + 1) / reviewCards.length) * 100} />
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline">
                      Mastery: {reviewCards[currentIndex]?.mastery_level}/5
                    </Badge>
                    <Badge variant="outline">
                      Reviews: {reviewCards[currentIndex]?.review_count}
                    </Badge>
                  </div>
                </div>

                <div className="py-8">
                  {reviewCards[currentIndex]?.cards.card_type === "flashcard" ? (
                    <FlashCard
                      key={reviewCards[currentIndex].card_id}
                      question={reviewCards[currentIndex].cards.question}
                      answer={reviewCards[currentIndex].cards.answer}
                      onRate={handleRate}
                    />
                  ) : reviewCards[currentIndex]?.cards.card_type === "quiz" ? (
                    <QuizCard
                      key={reviewCards[currentIndex].card_id}
                      question={reviewCards[currentIndex].cards.question}
                      answer={reviewCards[currentIndex].cards.answer}
                      options={reviewCards[currentIndex].cards.options || []}
                      onRate={handleRate}
                    />
                  ) : (
                    <FillBlankCard
                      key={reviewCards[currentIndex].card_id}
                      question={reviewCards[currentIndex].cards.question}
                      answer={reviewCards[currentIndex].cards.answer}
                      onRate={handleRate}
                    />
                  )}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="history">
            <div className="space-y-6 max-w-4xl mx-auto">
              {Object.entries(groupedHistory).map(([key, group]) => (
                <Card key={key}>
                  <CardHeader>
                    <CardTitle>{group.path}</CardTitle>
                    <CardDescription>{group.topic}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {group.cards.map((card) => (
                        <div
                          key={card.card_id}
                          className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30"
                        >
                          <div className={`w-2 h-2 rounded-full mt-2 ${getMasteryColor(card.mastery_level)}`} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm mb-1">{card.question}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <Badge variant="secondary" className="text-xs">
                                {getMasteryLabel(card.mastery_level)} ({card.mastery_level}/5)
                              </Badge>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {card.review_count} reviews
                              </span>
                              <span>
                                {card.last_reviewed
                                  ? new Date(card.last_reviewed).toLocaleDateString()
                                  : "Never"}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Review;
