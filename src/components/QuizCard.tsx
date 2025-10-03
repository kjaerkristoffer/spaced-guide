import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";

interface QuizCardProps {
  question: string;
  answer: string;
  options: string[];
  onRate: (rating: number) => void;
}

const QuizCard = ({ question, answer, options, onRate }: QuizCardProps) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const handleOptionClick = (option: string) => {
    if (showResult) return;
    setSelectedOption(option);
    setShowResult(true);
  };

  const handleContinue = () => {
    const isCorrect = selectedOption === answer;
    onRate(isCorrect ? 5 : 1);
  };

  const isCorrect = selectedOption === answer;

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-[var(--shadow-elevated)]">
        <CardContent className="p-8">
          <div className="mb-6">
            <div className="text-sm text-muted-foreground mb-4">Spørgsmål</div>
            <p className="text-2xl font-medium">{question}</p>
          </div>

          <div className="space-y-3">
            {options.map((option, index) => {
              const isSelected = selectedOption === option;
              const isAnswerOption = option === answer;
              
              let variant: "outline" | "default" | "destructive" | "secondary" = "outline";
              if (showResult) {
                if (isAnswerOption) {
                  variant = "default";
                } else if (isSelected) {
                  variant = "destructive";
                }
              }

              return (
                <Button
                  key={index}
                  variant={variant}
                  size="lg"
                  className="w-full justify-start text-left h-auto py-4"
                  onClick={() => handleOptionClick(option)}
                  disabled={showResult}
                >
                  <span className="flex-1">{option}</span>
                  {showResult && isAnswerOption && (
                    <CheckCircle2 className="w-5 h-5 ml-2 text-white" />
                  )}
                  {showResult && isSelected && !isAnswerOption && (
                    <XCircle className="w-5 h-5 ml-2" />
                  )}
                </Button>
              );
            })}
          </div>

          {showResult && (
            <>
              <div className={`mt-6 p-4 rounded-lg ${isCorrect ? 'bg-success/10' : 'bg-destructive/10'}`}>
                <p className={`font-medium ${isCorrect ? 'text-success' : 'text-destructive'}`}>
                  {isCorrect ? "✓ Korrekt!" : "✗ Forkert"}
                </p>
                {!isCorrect && (
                  <p className="text-sm mt-2 text-muted-foreground">
                    Det korrekte svar er: <strong>{answer}</strong>
                  </p>
                )}
              </div>
              <Button 
                className="w-full mt-4" 
                size="lg"
                onClick={handleContinue}
              >
                Fortsæt
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QuizCard;
