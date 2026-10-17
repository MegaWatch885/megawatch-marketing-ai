
import { supabase } from "@/lib/supabase/client";
import type {
  RepurposePlatform,
  RepurposedContent,
} from "@/services/ai/provider";
import { getAIProvider } from "@/services/ai";

export async function generateAndSaveRepurposedContent(input: {
  contentId: string;
  title: string;
  description?: string | null;
  platform: RepurposePlatform;
}) {
  // Generate content using the configured AI provider
  const provider = getAIProvider();

  const generated: RepurposedContent =
    await provider.repurposeContent(input);

  // Save the generated content in Supabase
  const { data, error } = await supabase
    .from("content_repurposes")
    .insert({
      content_id: generated.contentId,
      platform: generated.platform,
      title: generated.title,
      hook: generated.hook,
      caption: generated.caption,
      hashtags: generated.hashtags,
      cta: generated.cta,
      reason: generated.reason,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

