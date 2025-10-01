import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X } from "lucide-react";

interface FillBlankCardProps {
  question: string;
  answer: string;
  onRate: (rating: number) => void;
}

const FillBlankCard = ({ question, answer, onRate }: FillBlankCardProps) => {
  const [userAnswer, setUserAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const isCorrect = userAnswer.trim().toLowerCase() === answer.trim().toLowerCase();

  const handleSubmit = () => {
    setRevealed(true);
  };

  const handleRate = (rating: number) => {
    onRate(rating);
    setUserAnswer("");
    setRevealed(false);
  };

  return (
    <Card className="max-w-2xl mx-auto shadow-[var(--shadow-elevated)]">
      <CardHeader>
        <CardTitle className="text-center text-xl">Fill in the Blank</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-6 rounded-lg bg-secondary/50 text-center">
          <p className="text-lg font-medium">{question}</p>
        </div>

        {!revealed ? (
          <div className="space-y-4">
            <Input
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Type your answer..."
              className="text-center text-lg"
              autoFocus
            />
            <Button
              onClick={handleSubmit}
              className="w-full"
              disabled={!userAnswer.trim()}
            >
              Submit Answer
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`p-4 rounded-lg border-2 ${isCorrect ? 'border-green-500 bg-green-500/10' : 'border-red-500 bg-red-500/10'}`}>
              <div className="flex items-center justify-center gap-2 mb-2">
                {isCorrect ? (
                  <>
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-600">Correct!</span>
                  </>
                ) : (
                  <>
                    <X className="w-5 h-5 text-red-600" />
                    <span className="font-semibold text-red-600">Incorrect</span>
                  </>
                )}
              </div>
              {!isCorrect && (
                <p className="text-center">
                  Your answer: <span className="font-medium">{userAnswer}</span>
                  <br />
                  Correct answer: <span className="font-medium">{answer}</span>
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
              Rate how well you knew this (1 = didn't know, 5 = knew perfectly)
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FillBlankCard;
