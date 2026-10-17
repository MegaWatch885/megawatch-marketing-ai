import { supabase } from "@/lib/supabase/client";

export async function getContent() {
  const { data, error } = await supabase
    .from("content")
    .select(`
  *,
  content_ai(
    id,
    category,
    tone,
    topic,
    audience_cues,
    hashtags,
    platform_fit,
    confidence
  )
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data;
}



export async function getContentById(
  id: string
) {
  const { data, error } =
    await supabase
      .from("content")
      .select("*")
      .eq("id", id)
      .single();

  if (error) throw error;

  return data;
}



export async function createContent(payload: {
  title: string;
  storage_key?: string;
  permalink?: string;
}) {
  // Get the currently authenticated user.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Please log in before uploading content.");
  }

  const { data, error } = await supabase
    .from("content")
    .insert([
      {
        title: payload.title,
        storage_key: payload.storage_key,
        permalink: payload.permalink ?? null,
        status: "uploaded",
        user_id: user.id,
      },
    ])
    .select()
    .single();

  if (error) throw error;

  return data;
}


export async function updateContentStatus(
  id: string,
  status: string
) {
  const { data, error } =
    await supabase
      .from("content")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

  if (error) throw error;

  return data;
}

export async function deleteContent(
  id: string
) {
  const { error } =
    await supabase
      .from("content")
      .delete()
      .eq("id", id);

  if (error) throw error;
}

export async function scheduleContent(
  id: string,
  scheduledFor: string
) {
  const { data, error } = await supabase
    .from("content")
    .update({
      status: "scheduled",
      scheduled_for: scheduledFor,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function getScheduledContent() {
  const { data, error } = await supabase
    .from("content")
    .select("id, title, status, scheduled_for")
    .not("scheduled_for", "is", null)
    .order("scheduled_for", {
      ascending: true,
    });

  if (error) throw error;

  return data;
}

export async function rescheduleContent(
  id: string,
  scheduledFor: string
) {
  const { data, error } = await supabase
    .from("content")
    .update({
      scheduled_for: scheduledFor,
      status: "scheduled",
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function publishContent(id: string) {
  const { data, error } = await supabase
    .from("content")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data;
}