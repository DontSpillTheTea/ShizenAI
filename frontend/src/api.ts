const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface RecordItem {
  id: string;
  summary: string;
  created_at: string;
}

export interface UnifiedQueryResponse {
  text: string;
  source_origin: string;
  similarity_score: number | null;
  audio_url: string | null;
}

export const api = {
  ingest: async (text: string) => {
    const res = await fetch(`${API_BASE}/api/v1/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!res.ok) throw new Error('Ingest failed');
    return res.json();
  },
  
  getRecords: async (limit: number = 50): Promise<RecordItem[]> => {
    const res = await fetch(`${API_BASE}/api/v1/records?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch records');
    return res.json();
  },
  
  query: async (queryText: string, mode: string = 'text', limit: number = 5): Promise<UnifiedQueryResponse> => {
    const res = await fetch(`${API_BASE}/api/v1/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: queryText, limit, mode })
    });
    if (!res.ok) throw new Error('Query failed');
    return res.json();
  }
};
