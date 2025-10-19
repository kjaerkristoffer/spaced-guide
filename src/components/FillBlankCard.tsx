import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X, Lightbulb } from "lucide-react";
import { MnemonicDialog } from "./MnemonicDialog";

interface FillBlankCardProps {
  question: string;
  answer: string;
  options?: string[] | null;
  onRate: (rating: number) => void;
  cardId?: string;
  learningPathId?: string;
}

const FillBlankCard = ({ question, answer, options: providedOptions, onRate, cardId, learningPathId }: FillBlankCardProps) => {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [mnemonicOpen, setMnemonicOpen] = useState(false);

  // Use provided options or generate contextually relevant ones
  const options = useMemo(() => {
    // If options are provided from database (AI-generated), use those
    if (providedOptions && providedOptions.length > 0) {
      // Ensure correct answer is included and shuffle
      const allOptions = providedOptions.includes(answer) 
        ? [...providedOptions]
        : [answer, ...providedOptions.slice(0, 3)];
      return allOptions.sort(() => Math.random() - 0.5);
    }
    
    // Fallback: Generate basic distractors (this should rarely happen)
    // In a real scenario, options should always come from the AI generation
    const distractors = [
      answer + 'en',
      answer.replace(/en$/, ''),
      'Ingen af delene'
    ];
    
    const allOptions = [answer, ...distractors];
    return allOptions.sort(() => Math.random() - 0.5);
  }, [answer, providedOptions]);

  const isCorrect = selectedAnswer?.trim().toLowerCase() === answer.trim().toLowerCase();

  const handleSelectOption = (option: string) => {
    setSelectedAnswer(option);
    setTimeout(() => setRevealed(true), 300);
  };

  const handleRate = (rating: number) => {
    onRate(rating);
    setSelectedAnswer(null);
    setRevealed(false);
  };

  // Replace blank marker with selected answer or placeholder
  const renderQuestion = () => {
    const blankMarker = '___';
    if (question.includes(blankMarker)) {
      const parts = question.split(blankMarker);
      return (
        <p className="text-lg font-medium leading-relaxed">
          {parts[0]}
          <span 
            className={`inline-block min-w-[120px] mx-2 px-4 py-1 rounded-md border-2 transition-all duration-300 ${
              selectedAnswer
                ? revealed && isCorrect 
                  ? 'border-green-500 bg-green-500/20 text-green-700 font-semibold'
                  : revealed && !isCorrect
                  ? 'border-red-500 bg-red-500/20 text-red-700 font-semibold'
                  : 'border-primary bg-primary/10 text-primary animate-pulse'
                : 'border-dashed border-muted-foreground/30 bg-muted/30'
            }`}
          >
            {selectedAnswer || '?'}
          </span>
          {parts[1]}
        </p>
      );
    }
    return <p className="text-lg font-medium">{question}</p>;
  };

  return (
    <Card className="max-w-2xl mx-auto shadow-[var(--shadow-elevated)] relative">
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
      <CardHeader>
        <CardTitle className="text-center text-xl">Udfyld Hullet</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-6 rounded-lg bg-secondary/50 text-center">
          {renderQuestion()}
        </div>

        {!revealed ? (
          <div className="space-y-4">
            <p className="text-sm text-center text-muted-foreground">
              Vælg det rigtige ord
            </p>
            <div className="grid grid-cols-2 gap-3">
              {options.map((option, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="lg"
                  onClick={() => handleSelectOption(option)}
                  disabled={selectedAnswer !== null}
                  className={`h-auto py-4 text-base font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg whitespace-normal break-words ${
                    selectedAnswer === option
                      ? 'opacity-0 scale-50'
                      : 'opacity-100 scale-100'
                  }`}
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`p-4 rounded-lg border-2 ${isCorrect ? 'border-green-500 bg-green-500/10' : 'border-red-500 bg-red-500/10'}`}>
              <div className="flex items-center justify-center gap-2 mb-2">
                {isCorrect ? (
                  <>
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-600">Korrekt!</span>
                  </>
                ) : (
                  <>
                    <X className="w-5 h-5 text-red-600" />
                    <span className="font-semibold text-red-600">Forkert</span>
                  </>
                )}
              </div>
              {!isCorrect && (
                <p className="text-center">
                  Dit svar: <span className="font-medium">{selectedAnswer}</span>
                  <br />
                  Korrekt svar: <span className="font-medium">{answer}</span>
                </p>
              )}
            </div>

            <div className="flex flex-row gap-3 justify-center">
              <Button
                variant="outline"
                size="lg"
                onClick={() => handleRate(1)}
                className="flex-1 max-w-[140px]"
              >
                Svært
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => handleRate(3)}
                className="flex-1 max-w-[140px]"
              >
                Godt
              </Button>
              <Button
                size="lg"
                onClick={() => handleRate(5)}
                className="flex-1 max-w-[140px]"
              >
                Nemt
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <MnemonicDialog
        open={mnemonicOpen}
        onOpenChange={setMnemonicOpen}
        highlightedText={question}
        cardId={cardId}
        learningPathId={learningPathId}
        context={`Spørgsmål: ${question}\nSvar: ${answer}`}
      />
    </Card>
  );
};

export default FillBlankCard;
