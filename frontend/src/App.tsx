import { useState, useEffect } from 'react';
import { api, RecordItem, SearchResult } from './api';

function App() {
  const [activeTab, setActiveTab] = useState<'ingest' | 'search' | 'dashboard'>('ingest');
  
  const [text, setText] = useState('');
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestStatus, setIngestStatus] = useState<{success: boolean, msg: string} | null>(null);
  
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchRecords();
    }
  }, [activeTab]);

  const fetchRecords = async () => {
    setRecordsLoading(true);
    try {
      const data = await api.getRecords();
      setRecords(data);
    } catch (e) {
      console.error(e);
    } finally {
      setRecordsLoading(false);
    }
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setIngestLoading(true);
    setIngestStatus(null);
    try {
      await api.ingest(text);
      setIngestStatus({ success: true, msg: 'Successfully ingested and summarized!' });
      setText('');
    } catch (e) {
      setIngestStatus({ success: false, msg: 'Failed to ingest data.' });
    } finally {
      setIngestLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearchLoading(true);
    try {
      const res = await api.search(query);
      setSearchResults(res.results);
    } catch (e) {
      console.error(e);
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-text flex flex-col items-center py-10 px-4">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-500">
          ShizenAI
        </h1>
        <p className="text-textDim mt-2">Knowledge Ingestion & Semantic Search</p>
      </header>

      <div className="flex gap-4 mb-8">
        <button 
          onClick={() => setActiveTab('ingest')}
          className={`px-4 py-2 rounded-md transition ${activeTab === 'ingest' ? 'bg-primary text-white' : 'bg-surface text-textDim hover:text-white'}`}
        >
          Ingest Data
        </button>
        <button 
          onClick={() => setActiveTab('search')}
          className={`px-4 py-2 rounded-md transition ${activeTab === 'search' ? 'bg-primary text-white' : 'bg-surface text-textDim hover:text-white'}`}
        >
          Semantic Search
        </button>
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 rounded-md transition ${activeTab === 'dashboard' ? 'bg-primary text-white' : 'bg-surface text-textDim hover:text-white'}`}
        >
          Dashboard
        </button>
      </div>

      <main className="w-full max-w-3xl">
        {activeTab === 'ingest' && (
          <div className="card animate-[fadeIn_0.3s_ease-out]">
            <h2 className="text-2xl font-semibold mb-4 text-white">Ingest Raw Data</h2>
             <form onSubmit={handleIngest}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your raw, unstructured text here..."
                rows={8}
                className="input mb-4 resize-y"
              />
              <button disabled={ingestLoading || !text.trim()} type="submit" className="btn w-full">
                {ingestLoading ? 'Processing...' : 'Submit & Summarize'}
              </button>
            </form>
            {ingestStatus && (
              <div className={`mt-4 p-3 rounded-md border ${ingestStatus.success ? 'bg-green-900/20 border-green-800 text-green-400' : 'bg-red-900/20 border-red-800 text-red-400'}`}>
                {ingestStatus.msg}
              </div>
            )}
          </div>
        )}

        {activeTab === 'search' && (
          <div className="card animate-[fadeIn_0.3s_ease-out]">
            <h2 className="text-2xl font-semibold mb-4 text-white">Semantic Search</h2>
            <form onSubmit={handleSearch} className="flex gap-2 mb-6">
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask a conceptual question..." 
                className="input"
              />
              <button disabled={searchLoading || !query.trim()} type="submit" className="btn whitespace-nowrap">
                {searchLoading ? 'Searching...' : 'Search'}
              </button>
            </form>

            <div className="space-y-4">
              {searchResults.length > 0 ? searchResults.map(res => (
                <div key={res.id} className="p-4 bg-background border border-gray-800 rounded-md">
                  <p className="text-gray-200 mb-2">{res.summary}</p>
                  <div className="flex justify-between text-xs text-textDim">
                    <span>Similarity: {(res.similarity_score * 100).toFixed(1)}%</span>
                  </div>
                </div>
              )) : (
                !searchLoading && searchResults.length === 0 && query && (
                  <p className="text-textDim text-center py-4">No results found.</p>
                )
              )}
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="card animate-[fadeIn_0.3s_ease-out]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-white">Stored Summaries</h2>
              <button onClick={fetchRecords} disabled={recordsLoading} className="text-primary hover:text-blue-400 text-sm">
                Refresh
              </button>
            </div>
            
            {recordsLoading ? (
              <p className="text-textDim text-center">Loading records...</p>
            ) : records.length > 0 ? (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {records.map(record => (
                  <div key={record.id} className="p-4 bg-background border border-gray-800 rounded-md">
                    <p className="text-gray-200 mb-3">{record.summary}</p>
                    <div className="text-xs text-textDim">
                      Added: {new Date(record.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-textDim text-center py-8">No records found. Try ingesting some data first!</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
