import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Brain, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Mnemonic {
  id: string;
  highlighted_text: string;
  mnemonic_text: string;
  is_ai_generated: boolean;
  created_at: string;
}

const Mnemonics = () => {
  const navigate = useNavigate();
  const [mnemonics, setMnemonics] = useState<Mnemonic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMnemonics();
  }, []);

  const fetchMnemonics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("mnemonics")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setMnemonics(data || []);
    } catch (error: any) {
      console.error("Error fetching mnemonics:", error);
      toast.error("Kunne ikke indlæse huskeregler");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("mnemonics")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setMnemonics(mnemonics.filter(m => m.id !== id));
      toast.success("Huskeregel slettet");
    } catch (error: any) {
      console.error("Error deleting mnemonic:", error);
      toast.error("Kunne ikke slette huskeregel");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="hover:bg-gradient-to-r hover:from-purple-500/20 hover:to-pink-500/20"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Husketeknikker</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Indlæser huskeregler...</p>
          </div>
        ) : mnemonics.length === 0 ? (
          <Card className="shadow-lg">
            <CardContent className="py-12 text-center">
              <Brain className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">Ingen huskeregler endnu</h3>
              <p className="text-muted-foreground mb-6">
                Highlight tekst når du læser eller brug lyspære-ikonet på spørgsmål for at oprette huskeregler
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {mnemonics.map((mnemonic) => (
              <Card key={mnemonic.id} className="shadow-lg hover:shadow-xl transition-all">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg font-semibold line-clamp-2">
                      {mnemonic.highlighted_text}
                    </CardTitle>
                    {mnemonic.is_ai_generated && (
                      <Sparkles className="w-5 h-5 text-primary flex-shrink-0" />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm leading-relaxed">{mnemonic.mnemonic_text}</p>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-muted-foreground">
                      {new Date(mnemonic.created_at).toLocaleDateString('da-DK', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(mnemonic.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Mnemonics;