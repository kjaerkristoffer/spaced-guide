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

    const systemPrompt = `Du er en ekspert i at skabe effektive husketeknikker og huskeråd. 
  Din opgave er at generere en kort, præcis og minnesværdig husketeknik på dansk.
  Hold det simpelt og direkte. Brug billedsprog, metaforer eller sammenligninger når det giver mening.
  Målet er at gøre information lettere at huske.
  
  VIGTIGT: Giv ALDRIG akronymer som huskeregel. Brug i stedet:
  - Billedsprog og metaforer
  - Historier eller scenarier
  - Associationer til hverdagsting
  - Rim eller rytme
  - Visuelle beskrivelser`;

    const userPrompt = context 
      ? `Tekst at huske: "${text}"\nKontekst: ${context}\n\nGenerer en dansk huskeregel (max 100 ord). Kun reglen, ingen overskrifter. Brug IKKE akronymer.`
      : `Tekst at huske: "${text}"\n\nGenerer en dansk huskeregel (max 100 ord). Kun reglen, ingen overskrifter. Brug IKKE akronymer.`;

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