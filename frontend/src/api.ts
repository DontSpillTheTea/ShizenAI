const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface RecordItem {
  id: string;
  summary: string;
  created_at: string;
}

export interface SearchResult {
  id: string;
  summary: string;
  similarity_score: number;
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
  
  search: async (query: string, limit: number = 5): Promise<{results: SearchResult[]}> => {
    const res = await fetch(`${API_BASE}/api/v1/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit })
    });
    if (!res.ok) throw new Error('Search failed');
    return res.json();
  }
};
