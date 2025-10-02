import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Brain, BookOpen, RotateCcw, Zap } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-primary)" }}>
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center p-4 rounded-3xl mb-6 bg-white/10 backdrop-blur-sm">
            <Brain className="w-16 h-16 text-white" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            LearnSmart
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-2xl mx-auto">
            Mestre ethvert emne med AI-drevne læringsstier og afstands-gentagelse
          </p>
          <div className="flex gap-4 justify-center">
            <Button 
              size="lg" 
              className="text-lg px-8 bg-white text-primary hover:bg-white/90"
              onClick={() => navigate("/auth")}
            >
              Kom i Gang
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="text-lg px-8 bg-white/10 text-white border-white/30 hover:bg-white/20"
              onClick={() => navigate("/auth")}
            >
              Log Ind
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-white">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-4">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold mb-2">AI-Drevne Læringsstier</h3>
            <p className="text-white/80">
              Lad AI skabe personlige læringsstier tilpasset ethvert emne du vil mestre
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-white">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-4">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Smart Læring</h3>
            <p className="text-white/80">
              Studér med flashcards og quizzer designet til at maksimere retention og forståelse
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-white">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-4">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Afstands-Gentagelse</h3>
            <p className="text-white/80">
              Gennemgå på optimale intervaller for at flytte viden fra korttids- til langtidshukommelse
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
