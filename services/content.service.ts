import { supabase } from "@/lib/supabase/client";

export async function getContent() {
  const { data, error } = await supabase
    .from("content")
    .select("*")
    .order("created_at", {
      ascending: false,
    });

  if (error) throw error;

  return data;
}

export async function createContent(payload: {
  title: string;
  storage_key?: string;
}) {
  const { data, error } = await supabase
    .from("content")
    .insert([
      {
        title: payload.title,
        storage_key: payload.storage_key,
        status: "uploaded",
      },
    ])
    .select()
    .single();

  if (error) throw error;

  return data;
}