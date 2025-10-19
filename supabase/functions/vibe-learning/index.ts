import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, learningPathId, conversationHistory } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    console.log("Processing Vibe Learning request for user:", user.id);

    // Get YouTube API key
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");

    // Get learning path context if specified
    let contextInfo = "";
    if (learningPathId) {
      const { data: pathData } = await supabase
        .from("learning_paths")
        .select("subject, structure")
        .eq("id", learningPathId)
        .eq("user_id", user.id)
        .single();

      if (pathData) {
        contextInfo = `\n\nBrugerens aktive læringssti: ${pathData.subject}\nEmner: ${JSON.stringify(pathData.structure)}`;
      }
    } else {
      // Get all user's learning paths for context
      const { data: allPaths } = await supabase.from("learning_paths").select("subject").eq("user_id", user.id);

      if (allPaths && allPaths.length > 0) {
        contextInfo = `\n\nBrugerens læringsstier: ${allPaths.map((p) => p.subject).join(", ")}`;
      }
    }

    // Build conversation messages with YouTube search capabilities
    const messages = [
      {
        role: "system",
        content: `You are an intelligent learning mentor with 50 years of experience in pedagogy and didactics.  
Your task is to help the student learn in an engaging and personalized way.

Functions you can offer:
1. **Explain concepts** in different ways (analogies, examples, simplifications)  
2. **YouTube video recommendations** – request real YouTube videos  
3. **Generate practice cards** – create quizzes, flashcards, or fill-in-the-blank exercises on the topic  
4. **Explore related topics** – help the student see connections  
5. **Personalized feedback** – adapt responses to the student's level and learning style  

🎥 **YOUTUBE VIDEO RECOMMENDATIONS – RULES:**  
- When the user asks for videos or when it would be helpful, use the format: [REQUEST_YOUTUBE: search query in English]
- The search query should be clear and specific to get the best results
- Example: [REQUEST_YOUTUBE: introduction to photosynthesis biology]
- The system will automatically fetch real YouTube videos matching your search query
- You will NOT see the videos in your response, but they will be added automatically for the user

When suggesting practice cards, format them like this:  
[PRACTICE: Description of the exercise]

When explaining concepts, format them like this:  
[CONCEPT: Title of the concept]

Always be enthusiastic, supportive, and adapt your language to Danish. Use emojis where appropriate to make learning fun! 🚀  

**Even if the user input is in English, your output must always be in Danish.**

${contextInfo}`,
      },
    ];

    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.forEach((msg: any) => {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      });
    }

    // Add current message
    messages.push({
      role: "user",
      content: message,
    });

    // Call Lovable AI
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    console.log("AI Response:", aiResponse);

    // Parse resources from response
    const resources: any[] = [];

    // Check if AI response requests YouTube videos
    const youtubeRequestMatch = aiResponse.match(/\[REQUEST_YOUTUBE:\s*([^\]]+)\]/);
    
    if (youtubeRequestMatch && YOUTUBE_API_KEY) {
      const searchQuery = youtubeRequestMatch[1].trim();
      console.log("Fetching YouTube videos for query:", searchQuery);
      
      try {
        // Call YouTube Data API v3 - Search
        const youtubeResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&q=${encodeURIComponent(searchQuery)}&key=${YOUTUBE_API_KEY}&relevanceLanguage=da`
        );

        if (youtubeResponse.ok) {
          const youtubeData = await youtubeResponse.json();
          
          if (youtubeData.items && youtubeData.items.length > 0) {
            // Get video IDs to fetch details
            const videoIds = youtubeData.items.map((item: any) => item.id.videoId).join(',');
            
            // Fetch video details (duration, channel info)
            const detailsResponse = await fetch(
              `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoIds}&key=${YOUTUBE_API_KEY}`
            );
            
            if (detailsResponse.ok) {
              const detailsData = await detailsResponse.json();
              
              // Helper function to parse ISO 8601 duration
              const parseDuration = (duration: string): string => {
                const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
                if (!match) return "Ukendt";
                
                const hours = parseInt(match[1] || "0");
                const minutes = parseInt(match[2] || "0");
                const seconds = parseInt(match[3] || "0");
                
                if (hours > 0) {
                  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                } else {
                  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
                }
              };
              
              for (const video of detailsData.items) {
                const duration = parseDuration(video.contentDetails.duration);
                
                resources.push({
                  type: "youtube",
                  title: video.snippet.title,
                  channel: video.snippet.channelTitle,
                  url: `https://www.youtube.com/watch?v=${video.id}`,
                  duration: duration,
                });
              }
              console.log(`Found ${detailsData.items.length} YouTube videos with details`);
            } else {
              console.error("YouTube API details error:", await detailsResponse.text());
            }
          }
        } else {
          console.error("YouTube API search error:", await youtubeResponse.text());
        }
      } catch (error) {
        console.error("Error fetching YouTube videos:", error);
      }
    }

    // Extract practice exercises
    const practiceMatches = aiResponse.matchAll(/\[PRACTICE: ([^\]]+)\]/g);
    for (const match of practiceMatches) {
      resources.push({
        type: "practice",
        title: match[1].trim(),
      });
    }

    // Extract concepts
    const conceptMatches = aiResponse.matchAll(/\[CONCEPT: ([^\]]+)\]/g);
    for (const match of conceptMatches) {
      resources.push({
        type: "concept",
        title: match[1].trim(),
      });
    }

    // Clean response text from markup
    let cleanResponse = aiResponse
      .replace(/\[REQUEST_YOUTUBE:[^\]]+\]/g, "")
      .replace(/\[PRACTICE: [^\]]+\]/g, "")
      .replace(/\[CONCEPT: [^\]]+\]/g, "")
      .trim();

    return new Response(
      JSON.stringify({
        response: cleanResponse,
        resources: resources,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in vibe-learning:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
