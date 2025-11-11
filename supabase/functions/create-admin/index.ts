import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify setup token for security
    const setupToken = req.headers.get("X-Setup-Token");
    const expectedToken = Deno.env.get("ADMIN_SETUP_TOKEN");
    
    if (!expectedToken || setupToken !== expectedToken) {
      console.error("Unauthorized admin creation attempt");
      return new Response(
        JSON.stringify({ error: "Unauthorized. Valid setup token required." }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check if admin already exists
    const { data: existingAdmin } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .eq("email", "admin@deliveryflow.com")
      .maybeSingle();

    if (existingAdmin) {
      return new Response(
        JSON.stringify({ 
          message: "Admin user already exists",
          email: "admin@deliveryflow.com",
          note: "Use these credentials to login"
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Create admin user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: "admin@deliveryflow.com",
      password: "admin",
      email_confirm: true,
      user_metadata: {
        full_name: "Administrador",
      },
    });

    if (authError) {
      throw authError;
    }

    // Add admin role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: authData.user.id,
        role: "admin",
      });

    if (roleError && !roleError.message.includes("duplicate")) {
      throw roleError;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Admin user created successfully",
        credentials: {
          email: "admin@deliveryflow.com",
          password: "admin"
        },
        warning: "⚠️ CHANGE THIS PASSWORD IMMEDIATELY IN PRODUCTION!"
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
