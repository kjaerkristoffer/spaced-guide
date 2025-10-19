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
    const { question, answer, topic } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Evaluating answer for question:", question);

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
            content: `Du er en lærer der evaluerer studerendes svar på åbne spørgsmål om emnet "${topic}".

Evaluer svaret på en skala fra 0-10 baseret på:
- Forståelse af emnet (40%)
- Komplethed af svaret (30%)
- Klarhed og struktur (20%)
- Relevans for spørgsmålet (10%)

Giv konstruktiv feedback på dansk der:
1. Fremhæver hvad der var godt (max 2 sætninger)
2. Peger på eventuelle mangler (max 2 sætninger)
3. Foreslår forbedringer (max 2 sætninger)

VIGTIGT: Returner UDELUKKENDE ren JSON uden markdown code blocks.
Format:
{
  "score": <tal mellem 0-10>,
  "feedback": "<kort, konstruktiv feedback på dansk>"
}`,
          },
          {
            role: "user",
            content: `Spørgsmål: ${question}\n\nStuderendes svar: ${answer}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      throw new Error("Failed to evaluate answer");
    }

    const data = await response.json();
    let content = data.choices[0].message.content;

    console.log("AI response:", content);

    // Strip markdown code blocks if present
    content = content
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    // Parse the JSON response from AI
    const evaluation = JSON.parse(content);

    // Ensure feedback is always a string
    if (typeof evaluation.feedback === "object") {
      const parts = [];
      if (evaluation.feedback.godt) parts.push(`✅ ${evaluation.feedback.godt}`);
      if (evaluation.feedback.mangler) parts.push(`⚠️ ${evaluation.feedback.mangler}`);
      if (evaluation.feedback.forbedringer) parts.push(`💡 ${evaluation.feedback.forbedringer}`);
      evaluation.feedback = parts.join("\n\n");
    }

    return new Response(JSON.stringify(evaluation), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in evaluate-answer function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        score: 5,
        feedback: "Der opstod en fejl under evalueringen. Dit svar er modtaget.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
