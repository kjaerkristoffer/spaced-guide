import { useState } from "react";
import { MnemonicDialog } from "./MnemonicDialog";
import { Button } from "./ui/button";
import { Lightbulb } from "lucide-react";

interface ReadingContentProps {
  content: string;
  learningPathId?: string;
}

export const ReadingContent = ({ content, learningPathId }: ReadingContentProps) => {
  const [selectedText, setSelectedText] = useState("");
  const [mnemonicOpen, setMnemonicOpen] = useState(false);
  const [showHighlightButton, setShowHighlightButton] = useState(false);
  const [buttonPosition, setButtonPosition] = useState({ x: 0, y: 0 });

  const handleTextSelection = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();

    if (text && text.length > 0) {
      setSelectedText(text);
      
      // Get selection position
      const range = selection?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();
      
      if (rect) {
        setButtonPosition({
          x: rect.left + rect.width / 2,
          y: rect.top - 10
        });
        setShowHighlightButton(true);
      }
    } else {
      setShowHighlightButton(false);
    }
  };

  const handleCreateMnemonic = () => {
    setMnemonicOpen(true);
    setShowHighlightButton(false);
  };

  const formatParagraph = (paragraph: string) => {
    return paragraph
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
  };

  return (
    <>
      <div 
        className="prose prose-lg dark:prose-invert max-w-none select-text"
        onMouseUp={handleTextSelection}
        onTouchEnd={handleTextSelection}
      >
        {content.split('\n\n').map((paragraph, index) => {
          const formattedParagraph = formatParagraph(paragraph);
          
          return (
            <p 
              key={index} 
              className="text-base leading-relaxed mb-4"
              dangerouslySetInnerHTML={{ __html: formattedParagraph }}
            />
          );
        })}
      </div>

      {showHighlightButton && (
        <Button
          size="sm"
          className="fixed z-50 animate-scale-in shadow-lg"
          style={{
            left: `${buttonPosition.x}px`,
            top: `${buttonPosition.y}px`,
            transform: 'translate(-50%, -100%)'
          }}
          onClick={handleCreateMnemonic}
        >
          <Lightbulb className="w-4 h-4 mr-2" />
          Lav Husketeknik
        </Button>
      )}

      <MnemonicDialog
        open={mnemonicOpen}
        onOpenChange={(open) => {
          setMnemonicOpen(open);
          if (!open) {
            window.getSelection()?.removeAllRanges();
          }
        }}
        highlightedText={selectedText}
        learningPathId={learningPathId}
      />
    </>
  );
};