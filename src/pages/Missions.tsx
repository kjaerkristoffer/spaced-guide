import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Trophy, Star, Flame, Target, Crown, Award, Gem, Map } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as LucideIcons from "lucide-react";

interface Mission {
  id: string;
  title: string;
  description: string;
  mission_type: string;
  target_count: number;
  reward_points: number;
  icon: string;
}

interface UserMission {
  id: string;
  mission_id: string;
  progress: number;
  completed: boolean;
  missions: Mission;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  requirement_type: string;
  requirement_count: number;
  reward_points: number;
  badge_icon: string;
  badge_color: string;
  rarity: string;
}

interface UserAchievement {
  achievement_id: string;
  unlocked_at: string;
  achievements: Achievement;
}

interface UserStats {
  total_points: number;
  current_streak: number;
  longest_streak: number;
  total_reviews: number;
}

const Missions = () => {
  const navigate = useNavigate();
  const [missions, setMissions] = useState<UserMission[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [unlockedAchievements, setUnlockedAchievements] = useState<UserAchievement[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch or create user stats
      let { data: stats, error: statsError } = await supabase
        .from("user_stats")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (statsError) throw statsError;
      
      if (!stats) {
        const { data: newStats, error: createError } = await supabase
          .from("user_stats")
          .insert({ user_id: user.id })
          .select()
          .single();
        
        if (createError) throw createError;
        stats = newStats;
      }

      setUserStats(stats);

      // Fetch all missions
      const { data: allMissions, error: missionsError } = await supabase
        .from("missions")
        .select("*");

      if (missionsError) throw missionsError;

      // Fetch user's mission progress
      const { data: userMissions, error: userMissionsError } = await supabase
        .from("user_missions")
        .select(`
          *,
          missions (*)
        `)
        .eq("user_id", user.id);

      if (userMissionsError) throw userMissionsError;

      // Create user missions for any that don't exist
      const existingMissionIds = userMissions?.map(um => um.mission_id) || [];
      const missingMissions = allMissions?.filter(m => !existingMissionIds.includes(m.id)) || [];
      
      if (missingMissions.length > 0) {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + (7 - now.getDay()));
        nextWeek.setHours(23, 59, 59, 999);

        const newUserMissions = missingMissions.map(m => ({
          user_id: user.id,
          mission_id: m.id,
          progress: 0,
          completed: false,
          expires_at: m.mission_type === "daily" 
            ? tomorrow.toISOString() 
            : m.mission_type === "weekly" 
              ? nextWeek.toISOString() 
              : null,
        }));

        await supabase.from("user_missions").insert(newUserMissions);
        
        // Refetch after creating
        const { data: refreshedMissions } = await supabase
          .from("user_missions")
          .select(`
            *,
            missions (*)
          `)
          .eq("user_id", user.id);
        
        setMissions(refreshedMissions || []);
      } else {
        setMissions(userMissions || []);
      }

      // Fetch all achievements
      const { data: allAchievements, error: achievementsError } = await supabase
        .from("achievements")
        .select("*")
        .order("requirement_count", { ascending: true });

      if (achievementsError) throw achievementsError;
      setAchievements(allAchievements || []);

      // Fetch unlocked achievements
      const { data: userAchievements, error: userAchievementsError } = await supabase
        .from("user_achievements")
        .select(`
          *,
          achievements (*)
        `)
        .eq("user_id", user.id);

      if (userAchievementsError) throw userAchievementsError;
      setUnlockedAchievements(userAchievements || []);

    } catch (error: any) {
      console.error("Failed to fetch missions data:", error);
      toast.error("Kunne ikke indlæse missioner");
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (iconName: string) => {
    const Icon = (LucideIcons as any)[iconName] || Target;
    return Icon;
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "common": return "text-gray-400";
      case "rare": return "text-blue-400";
      case "epic": return "text-purple-400";
      case "legendary": return "text-yellow-400";
      default: return "text-gray-400";
    }
  };

  const getRarityGlow = (rarity: string) => {
    switch (rarity) {
      case "common": return "shadow-[0_0_10px_rgba(156,163,175,0.3)]";
      case "rare": return "shadow-[0_0_15px_rgba(96,165,250,0.4)]";
      case "epic": return "shadow-[0_0_20px_rgba(192,132,252,0.5)]";
      case "legendary": return "shadow-[0_0_25px_rgba(250,204,21,0.6)]";
      default: return "";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeMissions = missions.filter(m => !m.completed);
  const completedMissions = missions.filter(m => m.completed);
  const unlockedIds = new Set(unlockedAchievements.map(ua => ua.achievement_id));

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
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Trophy className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Missioner</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 border-yellow-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Points</p>
                  <p className="text-3xl font-bold text-yellow-500">{userStats?.total_points || 0}</p>
                </div>
                <Star className="w-12 h-12 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500/10 to-red-600/10 border-orange-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Nuværende Streak</p>
                  <p className="text-3xl font-bold text-orange-500">{userStats?.current_streak || 0}</p>
                </div>
                <Flame className="w-12 h-12 text-orange-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Achievements</p>
                  <p className="text-3xl font-bold text-purple-500">{unlockedAchievements.length}/{achievements.length}</p>
                </div>
                <Trophy className="w-12 h-12 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Gennemgange</p>
                  <p className="text-3xl font-bold text-blue-500">{userStats?.total_reviews || 0}</p>
                </div>
                <Target className="w-12 h-12 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="missions" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
            <TabsTrigger value="missions">Missioner ({activeMissions.length})</TabsTrigger>
            <TabsTrigger value="achievements">Achievements ({achievements.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="missions" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-4">Aktive Missioner</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {activeMissions.map((mission) => {
                  const Icon = getIcon(mission.missions.icon);
                  const progressPercent = (mission.progress / mission.missions.target_count) * 100;
                  
                  return (
                    <Card key={mission.id} className="hover:shadow-lg transition-shadow duration-300 animate-fade-in">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-3 bg-primary/10 rounded-lg">
                              <Icon className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{mission.missions.title}</CardTitle>
                              <CardDescription>{mission.missions.description}</CardDescription>
                            </div>
                          </div>
                          <Badge variant="secondary">
                            {mission.missions.mission_type}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Fremskridt</span>
                            <span className="font-medium">{mission.progress}/{mission.missions.target_count}</span>
                          </div>
                          <Progress value={progressPercent} className="h-2" />
                          <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-1 text-sm text-yellow-500">
                              <Star className="w-4 h-4 fill-current" />
                              <span className="font-semibold">+{mission.missions.reward_points} points</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {completedMissions.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-4 text-green-500">Fuldførte Missioner</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {completedMissions.map((mission) => {
                    const Icon = getIcon(mission.missions.icon);
                    
                    return (
                      <Card key={mission.id} className="opacity-60 border-green-500/20">
                        <CardHeader>
                          <div className="flex items-center gap-3">
                            <div className="p-3 bg-green-500/10 rounded-lg">
                              <Icon className="w-6 h-6 text-green-500" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{mission.missions.title}</CardTitle>
                              <Badge variant="outline" className="text-green-500 border-green-500">
                                Fuldført ✓
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="achievements" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {achievements.map((achievement) => {
                const isUnlocked = unlockedIds.has(achievement.id);
                const Icon = getIcon(achievement.badge_icon);
                
                return (
                  <Card 
                    key={achievement.id} 
                    className={`relative overflow-hidden transition-all duration-300 ${
                      isUnlocked 
                        ? `${getRarityGlow(achievement.rarity)} hover:scale-105 animate-scale-in` 
                        : 'opacity-40 grayscale'
                    }`}
                  >
                    <div className={`absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full opacity-10 ${
                      isUnlocked ? 'bg-gradient-to-br from-primary to-primary/50' : 'bg-gray-500'
                    }`} />
                    
                    <CardHeader className="relative">
                      <div className="flex items-start gap-4">
                        <div className={`p-4 rounded-xl ${
                          isUnlocked 
                            ? `bg-gradient-to-br from-${achievement.badge_color}-500/20 to-${achievement.badge_color}-600/20` 
                            : 'bg-gray-500/10'
                        }`}>
                          <Icon className={`w-10 h-10 ${
                            isUnlocked ? getRarityColor(achievement.rarity) : 'text-gray-500'
                          }`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <CardTitle className="text-lg">{achievement.title}</CardTitle>
                            {isUnlocked && (
                              <Trophy className={`w-5 h-5 ${getRarityColor(achievement.rarity)}`} />
                            )}
                          </div>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${isUnlocked ? getRarityColor(achievement.rarity) : 'text-gray-500'}`}
                          >
                            {achievement.rarity.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="relative">
                      <p className="text-sm text-muted-foreground mb-3">
                        {achievement.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-sm">
                          <Star className={`w-4 h-4 ${isUnlocked ? 'text-yellow-500 fill-current' : 'text-gray-500'}`} />
                          <span className={isUnlocked ? 'text-yellow-500 font-semibold' : 'text-gray-500'}>
                            +{achievement.reward_points} points
                          </span>
                        </div>
                        {isUnlocked && unlockedAchievements.find(ua => ua.achievement_id === achievement.id) && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(unlockedAchievements.find(ua => ua.achievement_id === achievement.id)!.unlocked_at).toLocaleDateString('da-DK')}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Missions;