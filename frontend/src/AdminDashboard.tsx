import React, { useState, useEffect } from 'react';
import { uploadDocument, generateFlashcards, getUsers, assignTopic } from './api';

export default function AdminDashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [topic, setTopic] = useState('');
  const [topicId, setTopicId] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    getUsers().then(setUsers).catch(console.error);
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !topic) return;
    setStatus('Uploading and chunking document via LangChain/PyMuPDF...');
    try {
      const res = await uploadDocument(file, topic);
      setTopicId(res.topic_id);
      setStatus(res.message);
    } catch (err: any) { setStatus(err.message); }
  };

  const handleGenerate = async () => {
    if (!topicId) return;
    setStatus('Prompting Local Llama 3 to generate core-concept questions...');
    try {
      const res = await generateFlashcards(topicId);
      setStatus(res.message);
    } catch (err: any) { setStatus(err.message); }
  };

  const handleAssign = async (userId: string) => {
    if (!topicId) return;
    setStatus('Assigning flashcard track to employee...');
    try {
      const res = await assignTopic(topicId, userId);
      setStatus(res.message);
    } catch (err: any) { setStatus(err.message); }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8 bg-white/5 border border-white/10 rounded-2xl mt-8">
      <div>
        <h2 className="text-3xl font-bold text-emerald-400">Employer Dashboard</h2>
        <p className="text-gray-400 mt-2">Ingest company docs, Auto-Generate Flashcards via Llama 3, and Assign.</p>
      </div>

      <form onSubmit={handleUpload} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">Topic Category Tree</label>
          <input type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Server DevOps -> Log Ingestion" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-emerald-500" required />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">Source Document (.pdf, .docx, .txt)</label>
          <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-emerald-100" required />
        </div>
        <button type="submit" className="px-6 py-3 w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold uppercase tracking-wider rounded-lg transition-colors">1. Vectorize & Extract</button>
      </form>

      {topicId && (
        <div className="p-6 bg-slate-900 border border-emerald-500/50 rounded-xl space-y-6">
          <div className="flex justify-between items-center">
             <p className="text-emerald-400 font-mono text-sm break-all">Topic: {topicId}</p>
          </div>
          
          <button onClick={handleGenerate} className="px-6 py-3 w-full bg-blue-500 hover:bg-blue-400 text-black font-bold uppercase tracking-wider rounded-lg transition-colors">2. Dispatch Flashcard Autogeneration</button>
          
          <div className="pt-4 space-y-4 border-t border-slate-700">
            <h3 className="text-gray-300 font-semibold uppercase tracking-wide text-sm">3. Distribute To Roster</h3>
            <div className="grid grid-cols-2 gap-4">
            {users.map(u => (
              <button key={u.id} onClick={() => handleAssign(u.id)} className="px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg hover:border-emerald-400 text-white flex items-center justify-between transition-colors">
                <span>{u.name} (Employee)</span>
                <span className="text-emerald-500 text-sm">Assign &rarr;</span>
              </button>
            ))}
            </div>
          </div>
        </div>
      )}

      {status && <div className="p-4 bg-black/50 rounded-lg text-sm font-mono text-emerald-200 border border-emerald-900/50">{status}</div>}
    </div>
  );
}
