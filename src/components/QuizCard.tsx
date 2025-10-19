import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Sparkles, Zap, Lightbulb } from "lucide-react";
import { MnemonicDialog } from "./MnemonicDialog";

interface QuizCardProps {
  question: string;
  answer: string;
  options: string[];
  onRate: (rating: number) => void;
  cardId?: string;
  learningPathId?: string;
}

const QuizCard = ({ question, answer, options, onRate, cardId, learningPathId }: QuizCardProps) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [mnemonicOpen, setMnemonicOpen] = useState(false);

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
      <Card className="shadow-[var(--shadow-elevated)] relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-10 hover:bg-primary/10"
          onClick={(e) => {
            e.stopPropagation();
            setMnemonicOpen(true);
          }}
        >
          <Lightbulb className="w-5 h-5 text-primary" />
        </Button>
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
                  className="w-full justify-start text-left h-auto py-4 whitespace-normal break-words"
                  onClick={() => handleOptionClick(option)}
                  disabled={showResult}
                >
                  <span className="flex-1 break-words">{option}</span>
                  {showResult && isAnswerOption && (
                    <CheckCircle2 className="w-5 h-5 ml-2 flex-shrink-0 text-white" />
                  )}
                  {showResult && isSelected && !isAnswerOption && (
                    <XCircle className="w-5 h-5 ml-2 flex-shrink-0" />
                  )}
                </Button>
              );
            })}
          </div>

          {showResult && (
            <>
              <div className={`mt-6 p-6 rounded-2xl border-2 animate-scale-in ${
                isCorrect 
                  ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-400 dark:from-green-950/30 dark:to-emerald-950/30' 
                  : 'bg-gradient-to-br from-red-50 to-orange-50 border-red-400 dark:from-red-950/30 dark:to-orange-950/30'
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  {isCorrect ? (
                    <>
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center animate-scale-in shadow-lg">
                        <CheckCircle2 className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400 flex items-center gap-2">
                          Korrekt! 
                          <Sparkles className="w-5 h-5 animate-pulse" />
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-300">Flot klaret!</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-400 to-orange-500 flex items-center justify-center animate-scale-in shadow-lg">
                        <XCircle className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                          Forkert
                          <Zap className="w-5 h-5" />
                        </p>
                        <p className="text-sm text-red-700 dark:text-red-300">Næste gang går det bedre!</p>
                      </div>
                    </>
                  )}
                </div>
                {!isCorrect && (
                  <div className="mt-4 p-3 bg-white/50 dark:bg-black/20 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="text-sm text-muted-foreground">
                      Det korrekte svar er:
                    </p>
                    <p className="font-semibold text-base mt-1 text-foreground">{answer}</p>
                  </div>
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

      <MnemonicDialog
        open={mnemonicOpen}
        onOpenChange={setMnemonicOpen}
        highlightedText={question}
        cardId={cardId}
        learningPathId={learningPathId}
        context={`Spørgsmål: ${question}\nSvar: ${answer}`}
      />
    </div>
  );
};

export default QuizCard;
