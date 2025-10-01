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
    const { topic, count = 5, generateReading = false } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Generating content for topic:", topic, "Reading:", generateReading);

    const systemPrompt = generateReading
      ? `You are an expert educator. Create engaging reading content and learning cards for the given topic.
        Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
        {
          "reading": "An engaging, informative 1-3 minute read about the topic. Make it exciting and accessible!",
          "cards": [
            {
              "question": "Question text",
              "answer": "Answer text",
              "type": "flashcard",
              "options": null
            },
            {
              "question": "Quiz question",
              "answer": "Correct answer",
              "type": "quiz",
              "options": ["Option 1", "Option 2", "Option 3", "Option 4"]
            },
            {
              "question": "Complete this: The capital of France is ___",
              "answer": "Paris",
              "type": "fill-blank",
              "options": null
            }
          ]
        }
        Mix flashcards, quiz questions, and fill-in-the-blank questions. For quiz questions, include 4 options with the answer being one of them.`
      : `You are an expert educator. Create learning cards for the given topic.
        Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
        {
          "cards": [
            {
              "question": "Question text",
              "answer": "Answer text",
              "type": "flashcard",
              "options": null
            },
            {
              "question": "Quiz question",
              "answer": "Correct answer",
              "type": "quiz",
              "options": ["Option 1", "Option 2", "Option 3", "Option 4"]
            }
          ]
        }
        Mix flashcards and quiz questions. For quiz questions, include 4 options with the answer being one of them.`;

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
            content: systemPrompt
          },
          {
            role: "user",
            content: `Create ${count} learning cards (mix of flashcards, quizzes, and fill-in-the-blank) for: ${topic}`
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
    let cleanContent = content.trim();
    
    // Remove markdown code blocks (```json or ``` at start/end)
    if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }
    
    // Parse the JSON response
    const result = JSON.parse(cleanContent);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-cards:", error);
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
