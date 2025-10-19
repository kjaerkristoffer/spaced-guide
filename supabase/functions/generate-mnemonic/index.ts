import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Generating mnemonic for:', text);

    const systemPrompt = `Du er en ekspert i mnemoniske teknikker og hukommelsesstrategier. Din opgave er at skabe effektive huskeregler baseret på videnskabeligt beviste metoder som:

1. **Akronymer og forkortelser**: Brug første bogstav i hvert ord
2. **Remser og rim**: Skab rytmiske sætninger der er lette at huske
3. **Stedmetoden (Memory Palace)**: Associer information med steder
4. **Historiefortælling**: Skab en narrativ der forbinder elementerne
5. **Visuelle billeder**: Skab levende mentale billeder
6. **Chunking**: Opdel information i mindre, håndterbare dele
7. **Associationer**: Forbind ny information med noget velkendt

Giv ALTID en konkret, anvendelig huskeregel på dansk. Hold den kort og præcis (max 2-3 sætninger).`;

    const userPrompt = context 
      ? `Tekst der skal huskes: "${text}"\n\nKontekst: ${context}\n\nGiv en effektiv mnemonisk huskeregel.`
      : `Tekst der skal huskes: "${text}"\n\nGiv en effektiv mnemonisk huskeregel.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const mnemonic = data.choices[0].message.content;

    console.log('Generated mnemonic successfully');

    return new Response(
      JSON.stringify({ mnemonic }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in generate-mnemonic function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});