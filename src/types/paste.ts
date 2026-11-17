export interface CreatePasteInput {
  content: string;
  ttl_seconds?: number;
  max_views?: number;
}

export interface StoredPaste {
  id: string;
  content: string;
  created_at_ms: number;
  expires_at_ms: number | null;
  max_views: number | null;
  view_count: number;
}

export interface Paste extends StoredPaste {
  remaining_views: number | null;
  expires_at: string | null;
}
