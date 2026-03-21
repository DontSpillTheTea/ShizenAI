import { useState, useEffect, useRef } from 'react';
import { api, RecordItem, UnifiedQueryResponse } from './api';

// For Web Speech API types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source_origin?: string;
  similarity_score?: number | null;
  audio_url?: string | null;
}

function App() {
  const [activeTab, setActiveTab] = useState<'ingest' | 'search' | 'dashboard'>('search');
  
  // Ingest state
  const [ingestText, setIngestText] = useState('');
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestStatus, setIngestStatus] = useState<{success: boolean, msg: string} | null>(null);
  
  // Dashboard state
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  
  // Search / Transcript state
  const [query, setQuery] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchRecords();
    }
  }, [activeTab]);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

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
    if (!ingestText.trim()) return;
    setIngestLoading(true);
    setIngestStatus(null);
    try {
      await api.ingest(ingestText);
      setIngestStatus({ success: true, msg: 'Successfully ingested and summarized!' });
      setIngestText('');
    } catch (e) {
      setIngestStatus({ success: false, msg: 'Failed to ingest data.' });
    } finally {
      setIngestLoading(false);
    }
  };

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = SpeechRecognition ? new SpeechRecognition() : null;

  if (recognition) {
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      submitQuery(transcript, 'voice');
    };
    
    recognition.onend = () => {
      setIsListening(false);
    };
    
    recognition.onerror = (e: any) => {
      console.error('Speech recognition error', e);
      setIsListening(false);
    };
  }

  const handleMicrophoneClick = () => {
    if (!recognition) {
      alert("Your browser does not support the Web Speech API.");
      return;
    }
    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      recognition.start();
      setIsListening(true);
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    submitQuery(query, 'text');
    setQuery('');
  };

  const submitQuery = async (qText: string, mode: string) => {
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: qText };
    setChatHistory(prev => [...prev, userMsg]);
    setSearchLoading(true);
    
    try {
      const res = await api.query(qText, mode);
      const asstMsg: ChatMessage = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: res.text,
        source_origin: res.source_origin,
        similarity_score: res.similarity_score,
        audio_url: res.audio_url
      };
      setChatHistory(prev => [...prev, asstMsg]);
      
      if (res.audio_url && audioRef.current) {
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        audioRef.current.src = `${API_BASE}${res.audio_url}`;
        audioRef.current.play().catch(e => console.error("Mock Audio playback failed natively:", e));
      }
    } catch (e) {
      console.error(e);
      setChatHistory(prev => [...prev, { id: (Date.now() + 2).toString(), role: 'assistant', content: "An error occurred fetching the response." }]);
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
        <p className="text-textDim mt-2">Hybrid Orchestration & Inclusive I/O</p>
      </header>

      <div className="flex gap-4 mb-8">
        <button 
          onClick={() => setActiveTab('search')}
          className={`px-4 py-2 rounded-md transition ${activeTab === 'search' ? 'bg-primary text-white' : 'bg-surface text-textDim hover:text-white'}`}
        >
          Transcript Chat
        </button>
        <button 
          onClick={() => setActiveTab('ingest')}
          className={`px-4 py-2 rounded-md transition ${activeTab === 'ingest' ? 'bg-primary text-white' : 'bg-surface text-textDim hover:text-white'}`}
        >
          Ingest Data
        </button>
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 rounded-md transition ${activeTab === 'dashboard' ? 'bg-primary text-white' : 'bg-surface text-textDim hover:text-white'}`}
        >
          DB Layout
        </button>
      </div>

      <main className="w-full max-w-3xl flex-grow flex flex-col">
        {activeTab === 'ingest' && (
          <div className="card animate-[fadeIn_0.3s_ease-out]">
            <h2 className="text-2xl font-semibold mb-4 text-white">Ingest Raw Data</h2>
             <form onSubmit={handleIngest}>
              <textarea
                value={ingestText}
                onChange={(e) => setIngestText(e.target.value)}
                placeholder="Paste your raw, unstructured text here..."
                rows={8}
                className="input mb-4 resize-y"
              />
              <button disabled={ingestLoading || !ingestText.trim()} type="submit" className="btn w-full">
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
          <div className="card flex flex-col flex-grow animate-[fadeIn_0.3s_ease-out] relative pb-20 overflow-hidden" style={{ minHeight: '600px' }}>
            <h2 className="text-2xl font-semibold mb-2 text-white border-b border-gray-800 pb-2">Transcript View</h2>
            
            <div className="flex-grow overflow-y-auto mb-4 space-y-4 pr-2 mt-4 custom-scrollbar">
              {chatHistory.length === 0 ? (
                <div className="text-center text-textDim py-10">Ask a question using text or your voice.</div>
              ) : (
                chatHistory.map(msg => (
                  <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[80%] p-4 rounded-xl ${msg.role === 'user' ? 'bg-primary text-white rounded-br-none' : 'bg-[#2a2a2a] text-gray-200 rounded-bl-none'}`}>
                      {msg.role === 'assistant' && msg.source_origin && (
                        <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wider">
                          {msg.source_origin === 'local_db' ? (
                            <span className="flex items-center gap-1 text-green-400">
                              <span className="w-2 h-2 rounded-full bg-green-400"></span> Internal DB ({(msg.similarity_score! * 100).toFixed(1)}%)
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-blue-400">
                              <span className="w-2 h-2 rounded-full bg-blue-400"></span> External Research Mock
                            </span>
                          )}
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
              {searchLoading && (
                <div className="flex justify-start">
                  <div className="bg-[#2a2a2a] text-gray-400 p-4 rounded-xl rounded-bl-none animate-pulse">
                    Routing & processing query...
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input Area */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-surface border-t border-gray-800">
              <form onSubmit={handleSearchSubmit} className="flex gap-2 relative items-center">
                <input 
                  type="text" 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask a question..." 
                  className="input flex-grow pr-12"
                  disabled={searchLoading}
                />
                <button 
                  type="button" 
                  onClick={handleMicrophoneClick}
                  disabled={searchLoading}
                  className={`absolute right-16 p-2 rounded-full transition ${isListening ? 'bg-red-500/20 text-red-500 animate-pulse' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                  title="Tap-to-Talk"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                  </svg>
                </button>
                <button disabled={searchLoading || (!query.trim() && !isListening)} type="submit" className="btn whitespace-nowrap px-6">
                  {isListening ? 'Listening...' : 'Send'}
                </button>
              </form>
            </div>
            {/* Hidden audio element for TTS */}
            <audio ref={audioRef} style={{ display: 'none' }} />
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
