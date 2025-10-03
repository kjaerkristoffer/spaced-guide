-- Create missions table
CREATE TABLE public.missions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  mission_type TEXT NOT NULL CHECK (mission_type IN ('daily', 'weekly', 'permanent')),
  target_count INTEGER NOT NULL,
  reward_points INTEGER NOT NULL DEFAULT 0,
  reward_badge TEXT,
  icon TEXT NOT NULL DEFAULT 'target',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create achievements table
CREATE TABLE public.achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  requirement_type TEXT NOT NULL CHECK (requirement_type IN ('reviews', 'streak', 'mastery', 'paths', 'perfect_score')),
  requirement_count INTEGER NOT NULL,
  reward_points INTEGER NOT NULL DEFAULT 0,
  badge_icon TEXT NOT NULL DEFAULT 'trophy',
  badge_color TEXT NOT NULL DEFAULT 'gold',
  rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_missions table
CREATE TABLE public.user_missions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, mission_id)
);

-- Create user_achievements table
CREATE TABLE public.user_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- Create user_stats table for tracking overall progress
CREATE TABLE public.user_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  total_points INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  total_reviews INTEGER NOT NULL DEFAULT 0,
  perfect_reviews INTEGER NOT NULL DEFAULT 0,
  last_review_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for missions (everyone can view)
CREATE POLICY "Missions are viewable by everyone"
ON public.missions FOR SELECT
USING (true);

-- RLS Policies for achievements (everyone can view)
CREATE POLICY "Achievements are viewable by everyone"
ON public.achievements FOR SELECT
USING (true);

-- RLS Policies for user_missions
CREATE POLICY "Users can view own missions"
ON public.user_missions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own missions"
ON public.user_missions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own missions"
ON public.user_missions FOR UPDATE
USING (auth.uid() = user_id);

-- RLS Policies for user_achievements
CREATE POLICY "Users can view own achievements"
ON public.user_achievements FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own achievements"
ON public.user_achievements FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_stats
CREATE POLICY "Users can view own stats"
ON public.user_stats FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stats"
ON public.user_stats FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stats"
ON public.user_stats FOR UPDATE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_user_stats_updated_at
BEFORE UPDATE ON public.user_stats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default missions
INSERT INTO public.missions (title, description, mission_type, target_count, reward_points, icon) VALUES
('Første Gennemgang', 'Gennemgå dit første kort', 'permanent', 1, 10, 'play-circle'),
('Daglig Træning', 'Gennemgå 5 kort i dag', 'daily', 5, 25, 'calendar'),
('Ugens Mester', 'Gennemgå 20 kort denne uge', 'weekly', 20, 100, 'trophy'),
('Perfektionist', 'Få 10 perfekte svar i træk', 'permanent', 10, 50, 'star'),
('Dedikeret Lærer', 'Gennemgå kort 7 dage i træk', 'permanent', 7, 75, 'flame');

-- Insert some default achievements  
INSERT INTO public.achievements (title, description, requirement_type, requirement_count, reward_points, badge_icon, badge_color, rarity) VALUES
('Nybegynder', 'Gennemgå 10 kort', 'reviews', 10, 20, 'award', 'bronze', 'common'),
('Træner', 'Gennemgå 50 kort', 'reviews', 50, 50, 'award', 'silver', 'rare'),
('Ekspert', 'Gennemgå 100 kort', 'reviews', 100, 100, 'award', 'gold', 'epic'),
('Mester', 'Gennemgå 500 kort', 'reviews', 500, 250, 'crown', 'gold', 'legendary'),
('Streak Starter', 'Opnå en 3-dages streak', 'streak', 3, 30, 'flame', 'orange', 'common'),
('Streak Champion', 'Opnå en 7-dages streak', 'streak', 7, 75, 'flame', 'red', 'rare'),
('Beherskelsesmester', 'Få 10 kort til beherskelse niveau 5', 'mastery', 10, 100, 'gem', 'purple', 'epic'),
('Læringsvej Entusiast', 'Opret 3 læringsveje', 'paths', 3, 50, 'map', 'blue', 'rare');