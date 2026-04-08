const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { stopId } = await req.json();
    if (!stopId) {
      return new Response(JSON.stringify({ error: 'stopId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('schedule_bounds')
      .select('line_name, towards, first_departure, last_departure')
      .eq('stop_diva', stopId);

    if (error) throw new Error(error.message);

    const bounds = (data ?? []).map((row: any) => ({
      lineName: row.line_name,
      towards: row.towards,
      firstDeparture: row.first_departure,
      lastDeparture: row.last_departure,
    }));

    return new Response(JSON.stringify({ bounds }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
