import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, CheckCircle2, Clock, Brain, Zap, Calendar, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import FlashCard from "@/components/FlashCard";
import QuizCard from "@/components/QuizCard";
import FillBlankCard from "@/components/FillBlankCard";
import { trackCardCompletion } from "@/utils/progressTracker";

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

interface Stats {
  dueToday: number;
  dueThisWeek: number;
  reviewedToday: number;
  totalMastered: number;
}

const SpacedRepetition = () => {
  const navigate = useNavigate();
  const [reviewCards, setReviewCards] = useState<ReviewCard[]>([]);
  const [historyCards, setHistoryCards] = useState<HistoryCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("review");
  const [stats, setStats] = useState<Stats>({ dueToday: 0, dueThisWeek: 0, reviewedToday: 0, totalMastered: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    await Promise.all([fetchDueCards(), fetchHistory(), fetchStats()]);
    setLoading(false);
  };

  const fetchStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const { data: allProgress } = await supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", user.id);

      if (!allProgress) return;

      const dueToday = allProgress.filter(p => 
        p.next_review && new Date(p.next_review) <= now
      ).length;

      const dueThisWeek = allProgress.filter(p => 
        p.next_review && new Date(p.next_review) <= weekFromNow
      ).length;

      const reviewedToday = allProgress.filter(p => 
        p.last_reviewed && p.last_reviewed.split('T')[0] === today
      ).length;

      const totalMastered = allProgress.filter(p => p.mastery_level >= 4).length;

      setStats({ dueToday, dueThisWeek, reviewedToday, totalMastered });
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const fetchDueCards = async () => {
    try {
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
        .not("next_review", "is", null)
        .order("next_review", { ascending: true });

      if (error) throw error;
      
      const now = new Date();
      const dueCards = (data || []).filter((card: any) => {
        if (!card.next_review) return false;
        const nextReviewDate = new Date(card.next_review);
        return nextReviewDate <= now;
      });
      
      setReviewCards(dueCards as any);
    } catch (error: any) {
      toast.error("Kunne ikke indlæse gennemgangskort");
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
    const isLastCard = currentIndex >= reviewCards.length - 1;
    
    // Immediately move to next card or refresh
    if (!isLastCard) {
      setCurrentIndex(currentIndex + 1);
    } else {
      toast.success("Alle gennemgange fuldført!");
      setCurrentIndex(0);
      // Refresh data in background
      fetchData();
    }
    
    // Run database updates in background (non-blocking)
    const updateProgress = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const now = new Date();
        const intervals = [1, 3, 7, 14, 30];
        const masteryIncrease = rating >= 3 ? 1 : 0;
        const newMastery = Math.min(5, card.mastery_level + masteryIncrease);
        const daysToAdd = intervals[Math.min(newMastery, intervals.length - 1)];
        const nextReview = new Date(now);
        nextReview.setDate(nextReview.getDate() + daysToAdd);

        await supabase
          .from("user_progress")
          .update({
            mastery_level: newMastery,
            last_reviewed: now.toISOString(),
            next_review: nextReview.toISOString(),
            review_count: card.review_count + 1,
          })
          .eq("id", card.id);

        await trackCardCompletion(user.id, rating);
      } catch (error: any) {
        console.error("Error updating progress:", error);
      }
    };
    
    // Fire and forget - don't await
    updateProgress();
  };

  const getMasteryColor = (level: number) => {
    if (level >= 4) return "bg-green-500";
    if (level >= 2) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getMasteryLabel = (level: number) => {
    if (level >= 4) return "Mestret";
    if (level >= 2) return "Lærer";
    return "Ny";
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
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-cyan-500/10 border-b border-border/50">
        <div className="container mx-auto px-4 py-8">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Tilbage til Dashboard
          </Button>
          
          <div className="max-w-4xl">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500">
                <Brain className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold mb-2">Spaced Repetition</h1>
                <p className="text-lg text-muted-foreground">
                  Optimer din hukommelse med videnskabeligt bevist gentagelsesmetode
                </p>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              <Card className="bg-background/50 backdrop-blur-sm border-orange-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-5 h-5 text-orange-500" />
                    <span className="text-sm text-muted-foreground">Forfalder I Dag</span>
                  </div>
                  <p className="text-3xl font-bold text-orange-500">{stats.dueToday}</p>
                </CardContent>
              </Card>

              <Card className="bg-background/50 backdrop-blur-sm border-blue-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-5 h-5 text-blue-500" />
                    <span className="text-sm text-muted-foreground">Denne Uge</span>
                  </div>
                  <p className="text-3xl font-bold text-blue-500">{stats.dueThisWeek}</p>
                </CardContent>
              </Card>

              <Card className="bg-background/50 backdrop-blur-sm border-green-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                    <span className="text-sm text-muted-foreground">I Dag</span>
                  </div>
                  <p className="text-3xl font-bold text-green-500">{stats.reviewedToday}</p>
                </CardContent>
              </Card>

              <Card className="bg-background/50 backdrop-blur-sm border-purple-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-purple-500" />
                    <span className="text-sm text-muted-foreground">Mestret</span>
                  </div>
                  <p className="text-3xl font-bold text-purple-500">{stats.totalMastered}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
            <TabsTrigger value="review">
              Forfaldne Nu ({reviewCards.length})
            </TabsTrigger>
            <TabsTrigger value="history">
              Historik ({historyCards.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="review">
            {reviewCards.length === 0 ? (
              <Card className="max-w-2xl mx-auto text-center py-12 bg-gradient-to-br from-green-500/5 to-emerald-500/5 border-green-500/20">
                <CardContent>
                  <CheckCircle2 className="w-20 h-20 mx-auto mb-6 text-green-500" />
                  <h2 className="text-3xl font-bold mb-3">Perfekt! 🎉</h2>
                  <p className="text-lg text-muted-foreground mb-6">
                    Ingen kort er forfaldne til gennemgang lige nu.
                  </p>
                  <div className="bg-background/50 rounded-lg p-4 mb-6 max-w-md mx-auto">
                    <p className="text-sm text-muted-foreground">
                      Dine kort er optimeret med spaced repetition algoritmen. 
                      Kom tilbage når kort er klar til at blive gennemgået!
                    </p>
                  </div>
                  <Button onClick={() => navigate("/dashboard")} size="lg">
                    Tilbage til Dashboard
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
                  <Progress value={((currentIndex + 1) / reviewCards.length) * 100} className="h-2 mb-4" />
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-purple-500/50 text-purple-500">
                      Beherskelse: {reviewCards[currentIndex]?.mastery_level}/5
                    </Badge>
                    <Badge variant="outline" className="border-blue-500/50 text-blue-500">
                      Gennemgange: {reviewCards[currentIndex]?.review_count}
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
                <Card key={key} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle>{group.path}</CardTitle>
                    <CardDescription>{group.topic}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {group.cards.map((card) => (
                        <div
                          key={card.card_id}
                          className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                        >
                          <div className={`w-2 h-2 rounded-full mt-2 ${getMasteryColor(card.mastery_level)}`} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm mb-1">{card.question}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                              <Badge variant="secondary" className="text-xs">
                                {getMasteryLabel(card.mastery_level)} ({card.mastery_level}/5)
                              </Badge>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {card.review_count} gennemgange
                              </span>
                              <span>
                                {card.last_reviewed
                                  ? new Date(card.last_reviewed).toLocaleDateString('da-DK')
                                  : "Aldrig"}
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

export default SpacedRepetition;
