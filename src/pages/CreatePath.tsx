import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Sparkles, BookOpen, Code, Microscope, Globe, Calculator } from "lucide-react";
import { toast } from "sonner";
import { getColorFromString, getIconForTopic } from "@/utils/colorUtils";

const featuredTopics = [
  {
    title: "Webprogrammering",
    description: "Lær at bygge moderne websites med HTML, CSS og JavaScript",
    icon: Code,
    gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    level: "Begynder"
  },
  {
    title: "Astronomi og Rumforskning",
    description: "Udforsk universet, stjerner, planeter og sorte huller",
    icon: Sparkles,
    gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    level: "Begynder"
  },
  {
    title: "Biologi og Genetik",
    description: "Forstå livet, DNA, celler og evolution",
    icon: Microscope,
    gradient: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    level: "Begynder"
  },
  {
    title: "Spansk for Begyndere",
    description: "Start din rejse med det spanske sprog",
    icon: Globe,
    gradient: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    level: "Begynder"
  },
  {
    title: "Avanceret Matematik",
    description: "Dyk ned i calculus, algebra og statistik",
    icon: Calculator,
    gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    level: "Videregående"
  }
];

const CreatePath = () => {
  const navigate = useNavigate();
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreatePath = async (featuredTopic?: typeof featuredTopics[0]) => {
    const topicToCreate = featuredTopic ? featuredTopic.title : subject;
    const topicLevel = featuredTopic ? featuredTopic.level : level;

    if (!topicToCreate.trim()) {
      toast.error("Angiv venligst et emne");
      return;
    }

    if (!topicLevel) {
      toast.error("Vælg venligst dit niveau");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const prompt = `${topicToCreate}. Niveau: ${topicLevel}`;

      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        "generate-learning-path",
        { body: { subject: prompt } }
      );

      if (functionError) throw functionError;

      const { data: pathData, error: insertError } = await supabase
        .from("learning_paths")
        .insert({
          user_id: user?.id,
          subject: topicToCreate,
          structure: functionData.learningPath
        })
        .select()
        .single();

      if (insertError) throw insertError;

      toast.success("Læringssti oprettet!");
      navigate(`/path/${pathData.id}`);
    } catch (error: any) {
      console.error("Error creating learning path:", error);
      toast.error("Kunne ikke oprette læringssti");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="gap-2 -ml-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Tilbage</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Featured Topics Section */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">Udvalgte Emner</h1>
              <p className="text-muted-foreground">Populære læringsstier til at komme i gang</p>
            </div>
          </div>

          {/* Horizontal Scroll */}
          <div className="relative -mx-4 px-4">
            <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar snap-x snap-mandatory">
              {featuredTopics.map((topic, index) => {
                const Icon = topic.icon;
                return (
                  <Card
                    key={index}
                    className="flex-shrink-0 w-[280px] snap-start cursor-pointer hover:shadow-lg transition-all border-2 hover:border-primary/50"
                    onClick={() => handleCreatePath(topic)}
                  >
                    <CardContent className="p-0">
                      {/* Header with gradient */}
                      <div 
                        className="h-20 relative overflow-hidden rounded-t-lg"
                        style={{ background: topic.gradient }}
                      >
                        <div className="absolute inset-0 bg-black/10" />
                        <div className="absolute bottom-3 left-3 right-3">
                          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                        </div>
                      </div>
                      
                      {/* Content */}
                      <div className="p-3">
                        <h3 className="font-bold text-base mb-1.5">{topic.title}</h3>
                        <p className="text-xs text-muted-foreground mb-2.5 line-clamp-2">
                          {topic.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs px-2.5 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                            {topic.level}
                          </span>
                          <Button 
                            size="sm" 
                            disabled={loading}
                            className="h-8 text-xs px-3"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCreatePath(topic);
                            }}
                          >
                            {loading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              "Start"
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        {/* Custom Learning Path Section */}
        <div className="max-w-2xl mx-auto">
          <Card className="border-2 shadow-2xl overflow-hidden relative">
            {/* Gradient Background */}
            <div 
              className="absolute inset-0 opacity-10"
              style={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)'
              }}
            />
            
            <CardContent className="p-8 relative z-10">
              <div className="mb-6">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent mb-2">
                  Opret Din Egen Læringssti
                </h2>
                <p className="text-base text-muted-foreground">
                  Tilpasset til dit niveau og dine interesser
                </p>
              </div>

              <div className="space-y-6">
                {/* Subject Input */}
                <div className="space-y-2">
                  <Label htmlFor="subject" className="text-base font-medium">
                    Hvad vil du lære? <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="subject"
                    placeholder="F.eks. Python programmering, Fotosyntese, Renæssancen, Spansk grammatik..."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="min-h-[100px] text-base resize-none border-2 focus:border-primary"
                  />
                  <p className="text-xs text-muted-foreground">
                    Vær så specifik som muligt for bedst tilpasset indhold
                  </p>
                </div>

                {/* Level Selection */}
                <div className="space-y-2">
                  <Label htmlFor="level" className="text-base font-medium">
                    Dit nuværende niveau <span className="text-destructive">*</span>
                  </Label>
                  <Select value={level} onValueChange={setLevel}>
                    <SelectTrigger id="level" className="text-base border-2 focus:border-primary">
                      <SelectValue placeholder="Vælg dit niveau" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Absolut begynder">Absolut begynder - Jeg starter fra nul</SelectItem>
                      <SelectItem value="Begynder">Begynder - Jeg har en smule viden</SelectItem>
                      <SelectItem value="Mellem">Mellem - Jeg har grundlæggende forståelse</SelectItem>
                      <SelectItem value="Videregående">Videregående - Jeg kender det godt</SelectItem>
                      <SelectItem value="Ekspert">Ekspert - Jeg vil uddybe min viden</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Dette sikrer at indholdet matcher din eksisterende viden
                  </p>
                </div>

                {/* Create Button */}
                <Button
                  onClick={() => handleCreatePath()}
                  disabled={loading || !subject.trim() || !level}
                  className="w-full gap-2 h-14 text-lg font-semibold shadow-lg"
                  style={{ 
                    background: loading || !subject.trim() || !level 
                      ? undefined 
                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  }}
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Genererer læringssti...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Opret Læringssti
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  AI genererer en personligt tilpasset læringssti baseret på dine inputs
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default CreatePath;
