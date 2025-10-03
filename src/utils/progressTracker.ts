import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Updates user stats, missions, and achievements after completing a card review
 */
export async function trackCardCompletion(userId: string, rating: number) {
  console.log("🎯 trackCardCompletion called:", { userId, rating });
  
  try {
    // 1. Update or create user stats
    const { data: existingStats } = await supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const today = new Date().toISOString().split('T')[0];
    const isPerfect = rating >= 4;
    
    let newStreak = 1;
    if (existingStats) {
      const lastReviewDate = existingStats.last_review_date;
      if (lastReviewDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        if (lastReviewDate === today) {
          newStreak = existingStats.current_streak;
        } else if (lastReviewDate === yesterdayStr) {
          newStreak = existingStats.current_streak + 1;
        }
      }
    }

    const statsUpdate = {
      user_id: userId,
      total_reviews: (existingStats?.total_reviews || 0) + 1,
      perfect_reviews: (existingStats?.perfect_reviews || 0) + (isPerfect ? 1 : 0),
      current_streak: newStreak,
      longest_streak: Math.max(newStreak, existingStats?.longest_streak || 0),
      last_review_date: today,
      updated_at: new Date().toISOString(),
    };

    console.log("📊 Updating stats:", statsUpdate);

    if (existingStats) {
      await supabase
        .from("user_stats")
        .update(statsUpdate)
        .eq("user_id", userId);
    } else {
      await supabase
        .from("user_stats")
        .insert(statsUpdate);
    }

    console.log("✅ Stats updated, now updating missions...");

    // 2. Update missions progress
    await updateMissionsProgress(userId, {
      total_reviews: statsUpdate.total_reviews,
      perfect_reviews: statsUpdate.perfect_reviews,
      current_streak: statsUpdate.current_streak,
    });

    console.log("✅ Missions updated, now checking achievements...");

    // 3. Check and unlock achievements
    await checkAndUnlockAchievements(userId, statsUpdate);

    console.log("✅ trackCardCompletion completed successfully");

  } catch (error) {
    console.error("❌ Error tracking card completion:", error);
  }
}

/**
 * Updates mission progress based on user stats
 */
async function updateMissionsProgress(
  userId: string, 
  stats: { total_reviews: number; perfect_reviews: number; current_streak: number }
) {
  console.log("🎯 updateMissionsProgress called with stats:", stats);
  
  try {
    // Fetch all missions
    const { data: allMissions } = await supabase
      .from("missions")
      .select("*");

    if (!allMissions) {
      console.log("⚠️ No missions found");
      return;
    }

    console.log("📋 Found missions:", allMissions.length);

    // Fetch user's mission progress
    const { data: userMissions } = await supabase
      .from("user_missions")
      .select("*")
      .eq("user_id", userId);

    console.log("📊 User missions:", userMissions?.length || 0);

    const existingMissionIds = userMissions?.map(um => um.mission_id) || [];

    // Create missing user missions
    const missingMissions = allMissions.filter(m => !existingMissionIds.includes(m.id));
    if (missingMissions.length > 0) {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + (7 - now.getDay()));
      nextWeek.setHours(23, 59, 59, 999);

      await supabase.from("user_missions").insert(
        missingMissions.map(m => ({
          user_id: userId,
          mission_id: m.id,
          progress: 0,
          completed: false,
          expires_at: m.mission_type === "daily" 
            ? tomorrow.toISOString() 
            : m.mission_type === "weekly" 
              ? nextWeek.toISOString() 
              : null,
        }))
      );
      
      // Refetch after creating
      const { data: refreshedMissions } = await supabase
        .from("user_missions")
        .select("*")
        .eq("user_id", userId);
      
      if (refreshedMissions) {
        userMissions?.push(...refreshedMissions.filter(rm => 
          missingMissions.some(mm => mm.id === rm.mission_id)
        ));
      }
    }

    const now = new Date();
    
    // Update progress for each mission
    for (const mission of allMissions) {
      const userMission = userMissions?.find(um => um.mission_id === mission.id);
      if (!userMission) {
        console.log(`⚠️ No user mission found for: ${mission.title}`);
        continue;
      }

      console.log(`🔍 Checking mission: ${mission.title}`, {
        type: mission.mission_type,
        currentProgress: userMission.progress,
        target: mission.target_count,
        completed: userMission.completed,
        expiresAt: userMission.expires_at
      });

      // Check if daily/weekly mission has expired and needs reset
      if (userMission.expires_at) {
        const expiresAt = new Date(userMission.expires_at);
        if (now > expiresAt) {
          console.log(`🔄 Resetting expired mission: ${mission.title}`);
          
          // Reset the mission
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(0, 0, 0, 0);

          const nextWeek = new Date(now);
          nextWeek.setDate(nextWeek.getDate() + (7 - now.getDay()));
          nextWeek.setHours(23, 59, 59, 999);

          await supabase
            .from("user_missions")
            .update({
              progress: 0,
              completed: false,
              completed_at: null,
              expires_at: mission.mission_type === "daily" 
                ? tomorrow.toISOString() 
                : nextWeek.toISOString(),
            })
            .eq("id", userMission.id);
          
          // Update local reference
          userMission.progress = 0;
          userMission.completed = false;
        }
      }

      if (userMission.completed) continue;

      let newProgress = userMission.progress;
      let shouldComplete = false;

      // Determine progress based on mission type and title
      if (mission.mission_type === "daily") {
        // Daily missions increment on each review
        if (mission.title.includes("Gennemgå") || mission.title.includes("kort") || mission.title.includes("Daglig")) {
          newProgress = userMission.progress + 1;
          shouldComplete = newProgress >= mission.target_count;
          console.log(`📈 Daily mission progress: ${newProgress}/${mission.target_count}`);
        }
      } else if (mission.mission_type === "weekly") {
        // Weekly missions track total for the week
        if (mission.title.includes("Gennemgå") || mission.title.includes("kort") || mission.title.includes("Ugens")) {
          newProgress = userMission.progress + 1;
          shouldComplete = newProgress >= mission.target_count;
          console.log(`📈 Weekly mission progress: ${newProgress}/${mission.target_count}`);
        }
      } else if (mission.mission_type === "permanent") {
        // Permanent missions track specific achievements
        if (mission.title.includes("Første")) {
          // First review
          newProgress = stats.total_reviews >= 1 ? 1 : 0;
          shouldComplete = newProgress >= mission.target_count;
          console.log(`📈 First review mission: ${newProgress}/${mission.target_count}`);
        } else if (mission.title.includes("perfekte") || mission.title.includes("Perfektionist")) {
          // Perfect streak tracking
          newProgress = stats.perfect_reviews;
          shouldComplete = newProgress >= mission.target_count;
          console.log(`📈 Perfect reviews mission: ${newProgress}/${mission.target_count}`);
        } else if (mission.title.includes("dage i træk") || mission.title.includes("Dedikeret")) {
          // Streak tracking
          newProgress = stats.current_streak;
          shouldComplete = newProgress >= mission.target_count;
          console.log(`📈 Streak mission: ${newProgress}/${mission.target_count}`);
        }
      }

      // Update the mission
      const updates: any = { progress: newProgress };
      
      if (shouldComplete && !userMission.completed) {
        updates.completed = true;
        updates.completed_at = new Date().toISOString();
        
        console.log(`🎉 Mission completed: ${mission.title}`);
        
        // Award points
        const { data: currentStats } = await supabase
          .from("user_stats")
          .select("total_points")
          .eq("user_id", userId)
          .single();

        await supabase
          .from("user_stats")
          .update({ 
            total_points: (currentStats?.total_points || 0) + mission.reward_points 
          })
          .eq("user_id", userId);

        toast.success(`🎉 Mission fuldført: ${mission.title}! +${mission.reward_points} points`);
      }

      console.log(`💾 Updating mission ${mission.title} with:`, updates);

      await supabase
        .from("user_missions")
        .update(updates)
        .eq("id", userMission.id);
    }
  } catch (error) {
    console.error("Error updating missions:", error);
  }
}

/**
 * Checks and unlocks achievements based on user stats
 */
async function checkAndUnlockAchievements(
  userId: string,
  stats: {
    total_reviews: number;
    perfect_reviews: number;
    current_streak: number;
    longest_streak: number;
  }
) {
  try {
    // Fetch all achievements
    const { data: allAchievements } = await supabase
      .from("achievements")
      .select("*");

    if (!allAchievements) return;

    // Fetch already unlocked achievements
    const { data: unlockedAchievements } = await supabase
      .from("user_achievements")
      .select("achievement_id")
      .eq("user_id", userId);

    const unlockedIds = new Set(unlockedAchievements?.map(ua => ua.achievement_id) || []);

    // Check each achievement
    for (const achievement of allAchievements) {
      if (unlockedIds.has(achievement.id)) continue;

      let shouldUnlock = false;

      switch (achievement.requirement_type) {
        case "total_reviews":
          shouldUnlock = stats.total_reviews >= achievement.requirement_count;
          break;
        case "perfect_reviews":
          shouldUnlock = stats.perfect_reviews >= achievement.requirement_count;
          break;
        case "streak":
          shouldUnlock = stats.current_streak >= achievement.requirement_count;
          break;
        case "longest_streak":
          shouldUnlock = stats.longest_streak >= achievement.requirement_count;
          break;
      }

      if (shouldUnlock) {
        // Unlock achievement
        await supabase
          .from("user_achievements")
          .insert({
            user_id: userId,
            achievement_id: achievement.id,
          });

        // Award points
        const { data: currentStats } = await supabase
          .from("user_stats")
          .select("total_points")
          .eq("user_id", userId)
          .single();

        await supabase
          .from("user_stats")
          .update({ 
            total_points: (currentStats?.total_points || 0) + achievement.reward_points 
          })
          .eq("user_id", userId);

        toast.success(`🏆 Achievement låst op: ${achievement.title}! +${achievement.reward_points} points`, {
          duration: 5000,
        });
      }
    }
  } catch (error) {
    console.error("Error checking achievements:", error);
  }
}
