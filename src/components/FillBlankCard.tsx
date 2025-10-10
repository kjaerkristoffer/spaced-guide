import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

interface FillBlankCardProps {
  question: string;
  answer: string;
  onRate: (rating: number) => void;
}

const FillBlankCard = ({ question, answer, onRate }: FillBlankCardProps) => {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  // Generate distractors (wrong options) based on the answer
  const options = useMemo(() => {
    const distractors: string[] = [];
    const answerWords = answer.toLowerCase().split(' ');
    
    // Simple distractor generation strategies
    const strategies = [
      // Strategy 1: Similar sounding/looking words
      () => answer + 's',
      () => answer + 'e',
      () => answer.replace(/e$/, ''),
      // Strategy 2: Random common words
      () => ['ikke', 'meget', 'altid', 'aldrig', 'måske'][Math.floor(Math.random() * 5)],
      () => ['være', 'have', 'blive', 'kunne', 'skulle'][Math.floor(Math.random() * 5)],
    ];
    
    // Generate 3 distractors
    while (distractors.length < 3) {
      const strategy = strategies[Math.floor(Math.random() * strategies.length)];
      const distractor = strategy();
      if (distractor !== answer && !distractors.includes(distractor)) {
        distractors.push(distractor);
      }
    }
    
    // Combine correct answer with distractors and shuffle
    const allOptions = [answer, ...distractors];
    return allOptions.sort(() => Math.random() - 0.5);
  }, [answer]);

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
    <Card className="max-w-2xl mx-auto shadow-[var(--shadow-elevated)]">
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
                  className={`h-auto py-4 text-base font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg ${
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

            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <Button
                  key={rating}
                  variant={rating <= (isCorrect ? 4 : 2) ? "default" : "outline"}
                  onClick={() => handleRate(rating)}
                >
                  {rating}
                </Button>
              ))}
            </div>
            <p className="text-sm text-center text-muted-foreground">
              Bedøm hvor godt du vidste dette (1 = vidste ikke, 5 = vidste perfekt)
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FillBlankCard;
