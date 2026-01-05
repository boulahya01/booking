// @ts-ignore Import works in Deno runtime
// @deno-types="https://deno.land/std@0.208.0/http/server.ts"
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
// @ts-ignore Import works in Deno runtime
// @deno-types="https://esm.sh/@supabase/supabase-js@2.38.0"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// @ts-ignore Deno global available at runtime
const supabaseUrl = Deno.env.get("SUPABASE_URL")!
// @ts-ignore Deno global available at runtime
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const supabase = createClient(supabaseUrl, supabaseKey)

serve(async (req: Request): Promise<Response> => {
    try {
        const { method } = req;

        if (method === "GET") {
            // Fetch bookings
            const { data, error } = await supabase
                .from("bookings")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;

            return new Response(JSON.stringify(data), {
                headers: { "Content-Type": "application/json" },
                status: 200,
            });
        }

        if (method === "POST") {
            // Create booking
            const bookingData = await req.json();
            const { data, error } = await supabase
                .from("bookings")
                .insert([bookingData])
                .select();

            if (error) throw error;

            return new Response(JSON.stringify(data), {
                headers: { "Content-Type": "application/json" },
                status: 201,
            });
        }

        return new Response("Method not allowed", { status: 405 })
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        console.error("Error:", error)
        return new Response(JSON.stringify({ error: errorMessage }), {
            headers: { "Content-Type": "application/json" },
            status: 500,
        })
    }
});
