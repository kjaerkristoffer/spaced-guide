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
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
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
      const { data: allPaths } = await supabase
        .from("learning_paths")
        .select("subject")
        .eq("user_id", user.id);

      if (allPaths && allPaths.length > 0) {
        contextInfo = `\n\nBrugerens læringsstier: ${allPaths.map(p => p.subject).join(", ")}`;
      }
    }

    // Build conversation messages with strict instructions about video URLs
    const messages = [
      {
        role: "system",
        content: `Du er en intelligent læringsvejleder med 50 års erfaring i pædagogik og didaktik. Din opgave er at hjælpe eleven med at lære på en engagerende og personlig måde.

Funktioner du kan tilbyde:
1. **Forklare koncepter** på forskellige måder (analogier, eksempler, forenklinger)
2. **YouTube video søgning** - foreslå SØGEORD til YouTube, ikke specifikke videoer
3. **Generere øvelseskort** - lav quiz, flashcards eller udfyld-hullet øvelser på emnet
4. **Udforske relaterede emner** - hjælp eleven med at se sammenhænge
5. **Personaliseret feedback** - tilpas svar til elevens niveau og læringsstil

KRITISK VIGTIGT: Du kan IKKE søge efter eller finde specifikke YouTube videoer. I stedet skal du:
- Foreslå SØGEORD som eleven kan bruge på YouTube
- Beskriv hvilken TYPE video der ville være nyttig
- Format søgeforslag sådan: [YOUTUBE_SEARCH: søgeord her]

For eksempel:
- [YOUTUBE_SEARCH: raketvidenskab for begyndere dansk]
- [YOUTUBE_SEARCH: space travel explained simply]

Når du foreslår øvelseskort, format dem sådan:
[PRACTICE: Beskrivelse af øvelsen]

Når du forklarer begreber, format dem sådan:
[CONCEPT: Titel på begrebet]

Vær altid entusiastisk, støttende og tilpas dit sprog til dansk. Brug emojis hvor det giver mening for at gøre læringen sjov! 🚀
${contextInfo}`
      }
    ];

    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.forEach((msg: any) => {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      });
    }

    // Add current message
    messages.push({
      role: "user",
      content: message
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
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    console.log("AI Response:", aiResponse);

    // Parse resources from response
    const resources: any[] = [];
    
    // Extract YouTube search suggestions
    const searchMatches = aiResponse.matchAll(/\[YOUTUBE_SEARCH: ([^\]]+)\]/g);
    for (const match of searchMatches) {
      const searchTerm = match[1].trim();
      resources.push({
        type: "youtube",
        title: `Søg på YouTube: "${searchTerm}"`,
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm)}`
      });
    }

    // Extract practice exercises
    const practiceMatches = aiResponse.matchAll(/\[PRACTICE: ([^\]]+)\]/g);
    for (const match of practiceMatches) {
      resources.push({
        type: "practice",
        title: match[1].trim()
      });
    }

    // Extract concepts
    const conceptMatches = aiResponse.matchAll(/\[CONCEPT: ([^\]]+)\]/g);
    for (const match of conceptMatches) {
      resources.push({
        type: "concept",
        title: match[1].trim()
      });
    }

    // Clean response text from markup
    let cleanResponse = aiResponse
      .replace(/\[YOUTUBE_SEARCH: [^\]]+\]/g, '')
      .replace(/\[PRACTICE: [^\]]+\]/g, '')
      .replace(/\[CONCEPT: [^\]]+\]/g, '')
      .trim();

    return new Response(
      JSON.stringify({
        response: cleanResponse,
        resources: resources
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in vibe-learning:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
