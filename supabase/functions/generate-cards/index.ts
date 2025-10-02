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
      ? `Du er en ekspert underviser. Skab engagerende læseindhold og læringskort på DANSK for det givne emne.
        
        KRITISK: Du SKAL returnere BÅDE "reading" OG "cards" felter i dit svar. Udelad ikke nogen af felterne.
        
        Returner KUN gyldig JSON (ingen markdown, ingen kodeblokke) med denne PRÆCISE struktur:
        {
          "reading": "En engagerende, informativ 2-6 minutters læsning på DANSK om emnet. Gør det spændende og tilgængeligt! Inkluder 3-5 sjove og overraskende fakta, hver med en UNDERLIG, SJOV eller LATTERLIG huskeregel til at huske det. Huskereglerne skal være mindeværdige gennem absurditet eller humor - tænk dumme akronymer, bizarre mentale billeder eller vanvittige associationer. Formater fakta med fed skrift ved hjælp af **tekst** og kursivér huskereglen ved hjælp af *tekst*.",
          "cards": [
            {
              "question": "Spørgsmål tekst på DANSK",
              "answer": "Svar tekst på DANSK",
              "type": "flashcard",
              "options": null
            },
            {
              "question": "Quiz spørgsmål på DANSK",
              "answer": "Korrekt svar på DANSK",
              "type": "quiz",
              "options": ["Mulighed 1 på DANSK", "Mulighed 2 på DANSK", "Mulighed 3 på DANSK", "Mulighed 4 på DANSK"]
            },
            {
              "question": "Udfyld dette: Hovedstaden i Frankrig er ___",
              "answer": "Paris",
              "type": "fill-blank",
              "options": null
            }
          ]
        }
        
        VIGTIGT: Inkluder ALTID BÅDE læseindholdet OG kortene. Bland flashcards, quiz spørgsmål og udfyld-hullet spørgsmål. For quiz spørgsmål, inkluder 4 muligheder hvor svaret er en af dem. ALT SKAL VÆRE PÅ DANSK.`
      : `Du er en ekspert underviser. Skab læringskort på DANSK for det givne emne.
        Returner KUN gyldig JSON (ingen markdown, ingen kodeblokke) med denne præcise struktur:
        {
          "cards": [
            {
              "question": "Spørgsmål tekst på DANSK",
              "answer": "Svar tekst på DANSK",
              "type": "flashcard",
              "options": null
            },
            {
              "question": "Quiz spørgsmål på DANSK",
              "answer": "Korrekt svar på DANSK",
              "type": "quiz",
              "options": ["Mulighed 1 på DANSK", "Mulighed 2 på DANSK", "Mulighed 3 på DANSK", "Mulighed 4 på DANSK"]
            }
          ]
        }
        Bland flashcards og quiz spørgsmål. For quiz spørgsmål, inkluder 4 muligheder hvor svaret er en af dem. ALT SKAL VÆRE PÅ DANSK.`;

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
            content: `Skab ${count} læringskort (blanding af flashcards, quizzer og udfyld-hullet) PÅ DANSK for: ${topic}`
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
    
    console.log("Raw AI response:", content.substring(0, 500)); // Log first 500 chars
    
    // Clean markdown code blocks that LLMs often add
    let cleanContent = content.trim();
    
    // Remove markdown code blocks (```json or ``` at start/end)
    if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }
    
    console.log("Cleaned content:", cleanContent.substring(0, 500)); // Log first 500 chars
    
    // Parse the JSON response
    const result = JSON.parse(cleanContent);
    
    console.log("Parsed result structure:", { 
      hasReading: !!result.reading, 
      hasCards: !!result.cards,
      cardsLength: result.cards?.length 
    });

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
