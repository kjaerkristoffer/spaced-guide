import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

interface OpenEndedCardProps {
  question: string;
  topic: string;
  onRate: (rating: number) => void;
  isLastQuestion?: boolean;
}

const OpenEndedCard = ({ question, topic, onRate, isLastQuestion = false }: OpenEndedCardProps) => {
  const [answer, setAnswer] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<{
    score: number;
    feedback: string;
    isGood: boolean;
  } | null>(null);

  const handleSubmit = async () => {
    if (!answer.trim() || isEvaluating) return;

    setIsEvaluating(true);
    try {
      const { data, error } = await supabase.functions.invoke('evaluate-answer', {
        body: {
          question,
          answer: answer.trim(),
          topic,
        },
      });

      if (error) throw error;

      setEvaluation({
        score: data.score,
        feedback: data.feedback,
        isGood: data.score >= 7,
      });
    } catch (error) {
      console.error('Error evaluating answer:', error);
      setEvaluation({
        score: 5,
        feedback: "Kunne ikke evaluere svaret. Prøv igen.",
        isGood: false,
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleContinue = () => {
    if (!evaluation) return;
    // Map score (0-10) to rating (1-5)
    const rating = evaluation.score >= 8 ? 5 : evaluation.score >= 6 ? 3 : 1;
    onRate(rating);
  };

  const handleSkip = () => {
    // Skip with a neutral rating
    onRate(3);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-[var(--shadow-elevated)]">
        <CardContent className="p-6 sm:p-8">
          <div className="mb-6">
            <div className="text-sm text-muted-foreground mb-4">Åbent spørgsmål</div>
            <p className="text-xl sm:text-2xl font-medium">{question}</p>
          </div>

          <div className="space-y-4">
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Skriv dit svar her... (minimum 50 tegn)"
              className="min-h-[150px] sm:min-h-[200px] text-base"
              disabled={evaluation !== null}
            />

            {!evaluation && (
              <div className="flex gap-3">
                <Button
                  onClick={handleSubmit}
                  disabled={answer.trim().length < 50 || isEvaluating}
                  className="flex-1"
                  size="lg"
                >
                  {isEvaluating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Evaluerer svar...
                    </>
                  ) : (
                    "Indsend svar"
                  )}
                </Button>
                {isLastQuestion && (
                  <Button
                    onClick={handleSkip}
                    disabled={isEvaluating}
                    variant="outline"
                    size="lg"
                  >
                    Spring dette over
                  </Button>
                )}
              </div>
            )}

            {evaluation && (
              <>
                <div className={`p-4 rounded-lg ${evaluation.isGood ? 'bg-success/10' : 'bg-accent/10'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {evaluation.isGood ? (
                      <CheckCircle2 className="w-5 h-5 text-success" />
                    ) : (
                      <XCircle className="w-5 h-5 text-accent" />
                    )}
                    <p className={`font-medium ${evaluation.isGood ? 'text-success' : 'text-foreground'}`}>
                      Score: {evaluation.score}/10
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                    {typeof evaluation.feedback === 'string' 
                      ? evaluation.feedback 
                      : JSON.stringify(evaluation.feedback)}
                  </p>
                </div>
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleContinue}
                >
                  Fortsæt
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OpenEndedCard;
