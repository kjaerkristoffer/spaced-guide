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
        content: `You are an intelligent learning mentor with 50 years of experience in pedagogy and didactics, and with real-time internet search access.  
Your task is to help the student learn in an engaging and personalized way.

Functions you can offer:
1. **Explain concepts** in different ways (analogies, examples, simplifications)  
2. **YouTube video recommendations** – find EXISTING YouTube videos via internet search  
3. **Generate practice cards** – create quizzes, flashcards, or fill-in-the-blank exercises on the topic  
4. **Explore related topics** – help the student see connections  
5. **Personalized feedback** – adapt responses to the student’s level and learning style  

🎥 **YOUTUBE VIDEO SEARCH – RULES:**  
- You MUST use real search results from the internet (never invent video titles, channel names, or links).  
- Please confirm all links before sharing them.  
- You MUST include the full YouTube URL for each video.  
- Only show videos that actually exist on YouTube. Keep verifying the video links until you are sure the link points to an existing YouTube video. Make sure the link never leads to “This video is not available” on YouTube.  
- Always provide between 3 and 5 relevant results.  
- For each video, include:  
  * Video title  
  * Channel name  
  * YouTube link (full URL: https://www.youtube.com/watch?v=VIDEO_ID)  
  * A short description (1–2 sentences) of why the video matches.  

Format YouTube recommendations like this – **perform the search in English**:  
[YOUTUBE_VIDEO]  
Title: [Video title]  
Channel: [Channel name]  
URL: [Full YouTube URL]  
Description: [Why this video is relevant]  
[/YOUTUBE_VIDEO]

AND REMEMBER: **NEVER PROVIDE LINKS TO NON-EXISTING YOUTUBE VIDEOS. THIS IS STRICTLY FORBIDDEN!!!**  

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

    // Extract YouTube video recommendations
    const videoPattern =
      /\[YOUTUBE_VIDEO\]\s*Titel:\s*([^\n]+)\s*Kanal:\s*([^\n]+)\s*URL:\s*(https:\/\/www\.youtube\.com\/watch\?v=[^\s]+)\s*Beskrivelse:\s*([^\[]+)\[\/YOUTUBE_VIDEO\]/g;
    const videoMatches = aiResponse.matchAll(videoPattern);
    for (const match of videoMatches) {
      resources.push({
        type: "youtube",
        title: match[1].trim(),
        channel: match[2].trim(),
        url: match[3].trim(),
        description: match[4].trim(),
      });
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
      .replace(/\[YOUTUBE_VIDEO\][\s\S]*?\[\/YOUTUBE_VIDEO\]/g, "")
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
