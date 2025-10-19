import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MnemonicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  highlightedText: string;
  learningPathId?: string;
  cardId?: string;
  context?: string;
}

export const MnemonicDialog = ({
  open,
  onOpenChange,
  highlightedText,
  learningPathId,
  cardId,
  context
}: MnemonicDialogProps) => {
  const [mnemonicText, setMnemonicText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleGenerateMnemonic = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-mnemonic', {
        body: { text: highlightedText, context }
      });

      if (error) throw error;

      // Clean up the AI response - remove markdown formatting
      const cleanedMnemonic = data.mnemonic
        .replace(/\*\*/g, '') // Remove bold markers
        .replace(/\*/g, '')   // Remove italic markers
        .replace(/^(Regel:|Huskeregel:)\s*/i, '') // Remove "Regel:" prefix
        .trim();

      setMnemonicText(cleanedMnemonic);
      toast.success("Huskeregel genereret!");
    } catch (error: any) {
      console.error('Error generating mnemonic:', error);
      toast.error("Kunne ikke generere huskeregel");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!mnemonicText.trim()) {
      toast.error("Indtast en huskeregel");
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from('mnemonics').insert({
        user_id: user.id,
        learning_path_id: learningPathId || null,
        card_id: cardId || null,
        highlighted_text: highlightedText,
        mnemonic_text: mnemonicText,
        is_ai_generated: isGenerating
      });

      if (error) throw error;

      toast.success("Huskeregel gemt!");
      onOpenChange(false);
      setMnemonicText("");
    } catch (error: any) {
      console.error('Error saving mnemonic:', error);
      toast.error("Kunne ikke gemme huskeregel");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[550px] max-h-[90vh] overflow-y-auto bg-gradient-to-br from-background to-muted/30 border-2 border-primary/20 p-4 sm:p-6">
        <DialogHeader className="space-y-2 pb-2">
          <DialogTitle className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent pr-8">
            Lav Husketeknik
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 p-3 sm:p-4 rounded-xl border border-primary/10">
            <p className="text-xs text-muted-foreground mb-1.5 font-medium">Valgt tekst:</p>
            <p className="text-sm font-medium leading-relaxed break-words">
              "{highlightedText}"
            </p>
          </div>

          <div>
            <label className="text-sm font-semibold mb-2 block flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
              <span>Din huskeregel:</span>
            </label>
            <Textarea
              value={mnemonicText}
              onChange={(e) => setMnemonicText(e.target.value)}
              placeholder="Skriv din egen huskeregel eller klik 'Giv Husketeknik' for AI-forslag"
              rows={4}
              className="resize-none border-2 focus:border-primary transition-colors text-sm"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-1">
            <Button
              onClick={handleGenerateMnemonic}
              disabled={isGenerating}
              variant="outline"
              size="lg"
              className="flex-1 border-2 hover:border-primary hover:bg-primary/5 text-sm sm:text-base"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin flex-shrink-0" />
                  <span className="truncate">Genererer...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="truncate">Giv Husketeknik</span>
                </>
              )}
            </Button>

            <Button
              onClick={handleSave}
              disabled={isSaving || !mnemonicText.trim()}
              size="lg"
              className="flex-1 bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 text-sm sm:text-base"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin flex-shrink-0" />
                  <span className="truncate">Gemmer...</span>
                </>
              ) : (
                <span className="truncate">Gem Huskeregel</span>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};