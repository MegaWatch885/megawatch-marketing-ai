
  import "server-only";

  import { createClient } from "@/lib/supabase/server";
  import { supabaseAdmin } from "@/lib/supabase/admin";

  export async function getAuthenticatedInstagramConnection() {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        connection: null,
        error: "Unauthorized",
        status: 401,
      };
    }

    const { data: connection, error } = await supabaseAdmin
      .from("instagram_connections")
      .select(
        "user_id, instagram_user_id, username, access_token, token_expires_at"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Instagram connection lookup failed:", error);

      return {
        connection: null,
        error: "Could not load Instagram connection",
        status: 500,
      };
    }

    if (
      !connection ||
      !connection.access_token ||
      !connection.instagram_user_id
    ) {
      return {
        connection: null,
        error: "Instagram account is not connected",
        status: 400,
      };
    }

    if (
      connection.token_expires_at &&
      new Date(connection.token_expires_at).getTime() <= Date.now()
    ) {
      return {
        connection: null,
        error: "Instagram access token has expired. Please reconnect.",
        status: 401,
      };
    }

    return {
      connection,
      error: null,
      status: 200,
    };
  }

