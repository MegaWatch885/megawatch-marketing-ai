export interface Content {
  id: string;
  title: string | null;
  description: string | null;
  storage_key: string | null;
  thumbnail_url: string | null;
  duration: number | null;
  category: string | null;
  status: string;
  created_at: string;
}