import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, Sparkles, Youtube, BookOpen, Zap } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Message {
  role: "user" | "assistant";
  content: string;
  resources?: {
    type: "youtube" | "practice" | "concept";
    title: string;
    url?: string;
    channel?: string;
    duration?: string;
    description?: string;
    data?: any;
  }[];
}

interface LearningPath {
  id: string;
  subject: string;
}

const VibeLearning = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      loadLearningPaths();
    };

    checkAuth();
  }, [navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadLearningPaths = async () => {
    const { data, error } = await supabase
      .from("learning_paths")
      .select("id, subject")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading learning paths:", error);
      return;
    }

    setLearningPaths(data || []);
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("vibe-learning", {
        body: {
          message: input,
          learningPathId: selectedPath !== "all" ? selectedPath : null,
          conversationHistory: messages.slice(-6), // Last 6 messages for context
        },
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: "assistant",
        content: data.response,
        resources: data.resources || [],
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl. Prøv igen.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickPrompts = [
    { icon: Sparkles, text: "Forklar dette emne anderledes", color: "text-purple-500" },
    { icon: Youtube, text: "Find relevante videoer", color: "text-red-500" },
    { icon: BookOpen, text: "Generer øvelseskort", color: "text-blue-500" },
    { icon: Zap, text: "Quiz mig på dette", color: "text-yellow-500" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
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
              <Sparkles className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Vibe Learning</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="space-y-6 mb-24">
          {messages.length === 0 ? (
            <div className="text-center py-12 space-y-6">
              <div className="inline-block p-4 rounded-full bg-primary/10">
                <Sparkles className="h-12 w-12 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2">Velkommen til Vibe Learning</h2>
                <p className="text-muted-foreground mb-6">
                  Stil spørgsmål, udforsk emner, få videoer og generer øvelseskort - alt sammen tilpasset din læring
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 max-w-2xl mx-auto">
                {quickPrompts.map((prompt, idx) => (
                  <Card
                    key={idx}
                    className="p-4 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                    onClick={() => setInput(prompt.text)}
                  >
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div
                        className={`p-3 rounded-full bg-gradient-to-br ${
                          idx === 0
                            ? "from-purple-500/20 to-purple-600/20"
                            : idx === 1
                              ? "from-red-500/20 to-red-600/20"
                              : idx === 2
                                ? "from-blue-500/20 to-blue-600/20"
                                : "from-yellow-500/20 to-yellow-600/20"
                        }`}
                      >
                        <prompt.icon className={`h-6 w-6 ${prompt.color}`} />
                      </div>
                      <span className="text-xs sm:text-sm font-medium break-words leading-tight">{prompt.text}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, idx) => (
              <div key={idx} className={`flex gap-4 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                {message.role === "assistant" && (
                  <Avatar className="h-10 w-10 bg-primary/10">
                    <AvatarFallback>
                      <Sparkles className="h-5 w-5 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className={`max-w-[80%] space-y-3`}>
                  <Card className={`p-4 ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-card"}`}>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </Card>

                  {message.resources && message.resources.length > 0 && (
                    <div className="space-y-2">
                      {message.resources.map((resource, ridx) => (
                        <Card key={ridx} className="p-3 hover:shadow-md transition-shadow">
                          {resource.type === "youtube" && (
                            <a href={resource.url} target="_blank" rel="noopener noreferrer" className="block">
                              <div className="flex items-start gap-3">
                                <Youtube className="h-5 w-5 text-red-500 mt-1 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm line-clamp-2 mb-1">{resource.title}</div>
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    {resource.channel && <span className="truncate">Kanal: {resource.channel}</span>}
                                    {resource.duration && (
                                      <span className="flex-shrink-0">Tid: {resource.duration}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </a>
                          )}
                          {resource.type === "practice" && (
                            <div className="flex items-center gap-3 text-sm">
                              <Zap className="h-5 w-5 text-yellow-500" />
                              <span className="font-medium">{resource.title}</span>
                            </div>
                          )}
                          {resource.type === "concept" && (
                            <div className="flex items-center gap-3 text-sm">
                              <BookOpen className="h-5 w-5 text-blue-500" />
                              <span className="font-medium">{resource.title}</span>
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
                {message.role === "user" && (
                  <Avatar className="h-10 w-10 bg-primary">
                    <AvatarFallback className="text-primary-foreground">U</AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex gap-4">
              <Avatar className="h-10 w-10 bg-primary/10">
                <AvatarFallback>
                  <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                </AvatarFallback>
              </Avatar>
              <Card className="p-4">
                <div className="flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0.2s]" />
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0.4s]" />
                </div>
              </Card>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-t">
        <div className="container mx-auto px-4 py-4 max-w-4xl">
          <div className="space-y-3">
            <Select value={selectedPath} onValueChange={setSelectedPath}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Alle emner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle emner</SelectItem>
                {learningPaths.map((path) => (
                  <SelectItem key={path.id} value={path.id}>
                    {path.subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Stil et spørgsmål, bed om videoer, eller generer øvelseskort..."
                className="flex-1"
                disabled={isLoading}
              />
              <Button onClick={sendMessage} disabled={isLoading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VibeLearning;
