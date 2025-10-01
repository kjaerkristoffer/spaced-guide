import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, BookOpen, RotateCcw, Plus, LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface LearningPath {
  id: string;
  subject: string;
  structure: any;
  created_at: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSubject, setNewSubject] = useState("");
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    checkAuth();
    fetchLearningPaths();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchLearningPaths = async () => {
    try {
      const { data, error } = await supabase
        .from("learning_paths")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLearningPaths(data || []);
    } catch (error: any) {
      toast.error("Failed to load learning paths");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const createLearningPath = async () => {
    if (!newSubject.trim()) {
      toast.error("Please enter a subject");
      return;
    }

    setCreating(true);
    try {
      // Generate learning path using AI
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        "generate-learning-path",
        { body: { subject: newSubject } }
      );

      if (functionError) throw functionError;

      // Save to database
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("learning_paths")
        .insert({
          user_id: user?.id,
          subject: newSubject,
          structure: functionData.learningPath,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Learning path created!");
      setNewSubject("");
      setDialogOpen(false);
      fetchLearningPaths();
    } catch (error: any) {
      toast.error(error.message || "Failed to create learning path");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ background: "var(--gradient-primary)" }}>
              <Brain className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold">LearnSmart</h1>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 grid gap-4 md:grid-cols-2">
          <Card className="shadow-[var(--shadow-card)]" style={{ background: "var(--gradient-card)" }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Learning Area
              </CardTitle>
              <CardDescription>Study new topics and concepts</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full" 
                onClick={() => navigate("/learn")}
              >
                Start Learning
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-[var(--shadow-card)]" style={{ background: "var(--gradient-card)" }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5" />
                Spaced Repetition
              </CardTitle>
              <CardDescription>Review and reinforce knowledge</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full" 
                onClick={() => navigate("/review")}
              >
                Review Cards
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Your Learning Paths</h2>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Subject
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Learning Path</DialogTitle>
                <DialogDescription>
                  Enter a subject you want to learn, and AI will create a structured learning path for you.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    placeholder="e.g., Python Programming, Spanish Grammar, Quantum Physics..."
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && createLearningPath()}
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={createLearningPath}
                  disabled={creating}
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Create Learning Path"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : learningPaths.length === 0 ? (
          <Card className="p-12 text-center">
            <Brain className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No learning paths yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first learning path to get started!
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {learningPaths.map((path) => (
              <Card 
                key={path.id} 
                className="cursor-pointer transition-all hover:shadow-[var(--shadow-elevated)]"
                onClick={() => navigate(`/path/${path.id}`)}
              >
                <CardHeader>
                  <CardTitle>{path.subject}</CardTitle>
                  <CardDescription>
                    {path.structure?.topics?.length || 0} topics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Created {new Date(path.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
