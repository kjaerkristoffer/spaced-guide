import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCw, Lightbulb } from "lucide-react";
import { MnemonicDialog } from "./MnemonicDialog";

interface FlashCardProps {
  question: string;
  answer: string;
  onRate: (rating: number) => void;
  cardId?: string;
  learningPathId?: string;
}

const FlashCard = ({ question, answer, onRate, cardId, learningPathId }: FlashCardProps) => {
  const [flipped, setFlipped] = useState(false);
  const [mnemonicOpen, setMnemonicOpen] = useState(false);

  return (
    <div className="max-w-2xl mx-auto">
      <Card 
        className="cursor-pointer min-h-[300px] shadow-xl transition-all hover:shadow-2xl relative"
        onClick={() => setFlipped(!flipped)}
      >
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
        <div className="mt-6 flex flex-row gap-3 justify-center">
          <Button
            variant="outline"
            size="lg"
            onClick={() => onRate(1)}
            className="flex-1 max-w-[140px]"
          >
            Svært
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => onRate(3)}
            className="flex-1 max-w-[140px]"
          >
            Godt
          </Button>
          <Button
            size="lg"
            onClick={() => onRate(5)}
            className="flex-1 max-w-[140px]"
          >
            Nemt
          </Button>
        </div>
      )}

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

export default FlashCard;
