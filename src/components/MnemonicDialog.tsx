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

      setMnemonicText(data.mnemonic);
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Lav Husketeknik</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Valgt tekst:</p>
            <p className="text-sm font-medium bg-muted p-3 rounded-lg">
              "{highlightedText}"
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Din huskeregel:
            </label>
            <Textarea
              value={mnemonicText}
              onChange={(e) => setMnemonicText(e.target.value)}
              placeholder="Skriv din egen huskeregel eller klik 'Giv Husketeknik' for AI-forslag"
              rows={4}
              className="resize-none"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleGenerateMnemonic}
              disabled={isGenerating}
              variant="outline"
              className="flex-1"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Genererer...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Giv Husketeknik
                </>
              )}
            </Button>

            <Button
              onClick={handleSave}
              disabled={isSaving || !mnemonicText.trim()}
              className="flex-1"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gemmer...
                </>
              ) : (
                "Gem Huskeregel"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};