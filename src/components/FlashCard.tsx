import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCw } from "lucide-react";

interface FlashCardProps {
  question: string;
  answer: string;
  onRate: (rating: number) => void;
}

const FlashCard = ({ question, answer, onRate }: FlashCardProps) => {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="max-w-2xl mx-auto">
      <Card 
        className="cursor-pointer min-h-[300px] shadow-[var(--shadow-elevated)] transition-all hover:shadow-[var(--shadow-card)]"
        onClick={() => setFlipped(!flipped)}
      >
        <CardContent className="p-8 flex flex-col items-center justify-center min-h-[300px]">
          <div className="text-center">
            {!flipped ? (
              <>
                <div className="text-sm text-muted-foreground mb-4">Spørgsmål</div>
                <p className="text-2xl font-medium">{question}</p>
                <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
                  <RotateCw className="w-4 h-4" />
                  <span>Klik for at afsløre svar</span>
                </div>
              </>
            ) : (
              <>
                <div className="text-sm text-muted-foreground mb-4">Svar</div>
                <p className="text-xl">{answer}</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {flipped && (
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="outline"
            size="lg"
            onClick={() => onRate(1)}
            className="flex-1 sm:max-w-[140px]"
          >
            Svært
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => onRate(3)}
            className="flex-1 sm:max-w-[140px]"
          >
            Godt
          </Button>
          <Button
            size="lg"
            onClick={() => onRate(5)}
            className="flex-1 sm:max-w-[140px]"
          >
            Nemt
          </Button>
        </div>
      )}
    </div>
  );
};

export default FlashCard;
