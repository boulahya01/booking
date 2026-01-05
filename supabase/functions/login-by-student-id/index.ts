// @ts-ignore Import works in Deno runtime
// @deno-types="https://deno.land/std@0.208.0/http/server.ts"
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
// @ts-ignore Import works in Deno runtime
// @deno-types="https://esm.sh/@supabase/supabase-js@2.38.0"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
// @ts-ignore Deno global available at runtime
const supabaseUrl = Deno.env.get("SUPABASE_URL")!
// @ts-ignore Deno global available at runtime
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface LoginRequest {
    studentId: string
    password: string
}

interface LoginResponse {
    session?: unknown
    user?: unknown
    error?: string
}

serve(async (req: Request): Promise<Response> => {
    // Handle CORS
    if (req.method === "OPTIONS") {
        return new Response("ok", {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        })
    }

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: { "Content-Type": "application/json" },
        })
    }

    try {
        const { studentId, password } = (await req.json()) as LoginRequest

        if (!studentId || !password) {
            return new Response(
                JSON.stringify({ error: "Student ID and password are required" }),
                {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                }
            )
        }

        // Step 1: Find profile by student_id
        const { data: profiles, error: profileError } = await supabase
            .from("profiles")
            .select("id, status")
            .eq("student_id", studentId)
            .single()

        if (profileError || !profiles) {
            console.error("Profile lookup error:", profileError)
            return new Response(
                JSON.stringify({ error: "Invalid credentials" }),
                {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                }
            )
        }

        // Step 2: Allow all users to login (pending, approved, rejected, suspended)
        // Status restrictions are enforced at database/RLS level and in UI
        // User will see appropriate messages in frontend based on their status

        // Step 3: Get user's email from auth.users
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
            profiles.id
        )

        if (userError || !userData.user || !userData.user.email) {
            console.error("User lookup error:", userError)
            return new Response(
                JSON.stringify({ error: "User not found" }),
                {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                }
            )
        }

        // Step 4: Sign in with email and password using the anon client
        // @ts-ignore Deno global available at runtime
        const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!)
        const { data, error: signInError } = await anonClient.auth.signInWithPassword({
            email: userData.user.email,
            password: password,
        })

        if (signInError) {
            console.error("Sign in error:", signInError)
            return new Response(
                JSON.stringify({ error: "Invalid credentials" }),
                {
                    status: 401,
                    headers: { "Content-Type": "application/json" },
                }
            )
        }

        // Success: return session and user
        const response: LoginResponse = {
            session: data.session,
            user: data.user,
        }

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        })
    } catch (error: unknown) {
        console.error("Login error:", error)
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        )
    }
})
