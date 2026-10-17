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

export async function deleteVideo(
  storageKey: string
) {
  const { error } =
    await supabase.storage
      .from("content-media")
      .remove([storageKey]);

  if (error) throw error;
}

export async function getVideoUrl(storageKey: string) {
  const { data, error } = await supabase.storage
    .from("content-media")
    .createSignedUrl(storageKey, 60 * 60);

  if (error) throw error;

  return data.signedUrl;
}