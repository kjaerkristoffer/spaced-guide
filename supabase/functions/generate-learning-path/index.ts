import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subject } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Generating learning path for subject:", subject);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Du er en ekspert læringsstiedesigner. Skab en struktureret læringssti på DANSK for det givne emne. 
            Returner KUN gyldig JSON (ingen markdown, ingen kodeblokke) med denne præcise struktur:
            {
              "topics": [
                {
                  "title": "Emne navn på DANSK",
                  "description": "Kort beskrivelse på DANSK",
                  "order": 1,
                  "estimatedMinutes": 30
                }
              ]
            }
            Skab 5-8 emner der bygger progressivt på hinanden. ALT SKAL VÆRE PÅ DANSK.`
          },
          {
            role: "user",
            content: `Skab en læringssti på DANSK for: ${subject}`
          }
        ],
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
    const content = data.choices[0].message.content;

    // Clean markdown code blocks that LLMs often add
    const cleanContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Parse the JSON response
    const learningPath = JSON.parse(cleanContent);

return new Response(JSON.stringify({ learningPath }), {
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});
  } catch (error) {
    console.error("Error in generate-learning-path:", error);
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
