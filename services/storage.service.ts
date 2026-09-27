import { supabase } from "@/lib/supabase/client";

export async function uploadVideo(file: File) {
  const fileName = `${Date.now()}-${file.name}`;

  const { data, error } = await supabase.storage
    .from("content-media")
    .upload(fileName, file);

  if (error) throw error;

  return {
    fileName,
    path: data.path,
  };
}