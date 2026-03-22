import React, { useState, useEffect } from 'react';
import { uploadDocument, getUsers, assignTopic, getAdminHierarchy, createEmployee } from './api';
import { TopicTree, TopicNode, buildTree } from './components/TopicTree';
import { Sprout } from 'lucide-react';

export default function AdminDashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [topic, setTopic] = useState('');
  const [status, setStatus] = useState('');

  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  
  const [treeData, setTreeData] = useState<TopicNode[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [newUserName, setNewUserName] = useState('');

  // Load Users
  useEffect(() => {
    getUsers().then(setUsers).catch(console.error);
  }, []);

  // Hydrate Tree when a user is selected (or general pool)
  const loadTree = async (userId: string) => {
    try {
      const flat = await getAdminHierarchy(userId);
      setTreeData(buildTree(flat));
    } catch(err: any) {
      console.error(err);
    }
  }

  useEffect(() => {
    if (selectedUserId) {
      loadTree(selectedUserId);
      setSelectedTopics(new Set());
    } else {
       loadTree('');
    }
  }, [selectedUserId]);

  const handleCreateUser = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newUserName.trim()) {
      try {
        setStatus('Creating new employee profile...');
        const u = await createEmployee(newUserName.trim());
        setUsers(prev => {
            if (prev.find(x => x.id === u.id)) return prev;
            return [...prev, u];
        });
        setSelectedUserId(u.id);
        setNewUserName('');
        setStatus('Employee joined active directory.');
      } catch (err: any) { setStatus(err.message); }
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !topic) return;
    setStatus('Processing Atomic Pipeline: Uploading, Vectorizing, and Synthesizing Flashcards...');
    try {
      const res = await uploadDocument(file, topic);
      setStatus(res.message);
      loadTree(selectedUserId || ''); // reload Tree
    } catch (err: any) { 
      setStatus(err.message); 
    }
  };

  const handleToggleTopic = (id: string, isChecked: boolean) => {
    const next = new Set(selectedTopics);
    if (isChecked) next.add(id);
    else next.delete(id);
    setSelectedTopics(next);
  };

  const handleAssignSelected = async () => {
    if (!selectedUserId) {
      setStatus("Please select an employee first.");
      return;
    }
    if (selectedTopics.size === 0) return;
    
    setStatus(`Assigning ${selectedTopics.size} topics to employee...`);
    try {
        let count = 0;
        for (const tid of selectedTopics) {
            await assignTopic(tid, selectedUserId);
            count++;
        }
        setStatus(`Successfully distributed ${count} topic trees to the employee.`);
        loadTree(selectedUserId); // Reload tree to visually represent Assignment
        setSelectedTopics(new Set()); // wipe selection
    } catch (err: any) {
        setStatus(err.message);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 mt-8">
      <div>
        <h2 className="text-3xl font-bold text-emerald-400 flex items-center gap-3">
          <Sprout className="w-8 h-8" />
          Voice Training Assistant Admin
        </h2>
        <p className="text-gray-400 mt-2">One-Click Ingestion & Automated Competency Tracking</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* LEFT COLUMN: Atomic Ingestion Pipeline */}
        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl space-y-4">
          <h3 className="text-xl font-bold text-white mb-4">1. One-Click Ingestion</h3>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Topic Category Track</label>
              <input type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Developer -> Deployment -> Docker" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-emerald-500" required />
            </div>
            <div className="border-2 border-dashed border-emerald-500/30 p-8 text-center rounded-xl bg-slate-900 transition-hover hover:border-emerald-500/80">
              <label className="block text-sm font-semibold text-emerald-300 mb-2 cursor-pointer">
                Select Document (.pdf, .docx, .txt)
                <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="hidden" required />
              </label>
              <p className="text-xs text-emerald-500 font-mono">{file ? file.name : "Click to Browse File"}</p>
            </div>
            <button type="submit" className="px-6 py-4 w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold uppercase tracking-wider rounded-lg transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)]">Atomic Process: Vectorize & Synthesize</button>
          </form>
          {status && <div className="p-4 bg-slate-900 rounded-lg text-sm font-mono text-emerald-300 border border-emerald-900/50 mt-4">{status}</div>}
        </div>

        {/* RIGHT COLUMN: Assignment Matrix & Tree */}
        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl space-y-4 flex flex-col">
          <h3 className="text-xl font-bold text-white mb-4">2. Assignment Matrix</h3>

          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Create new employee... (Press Enter)" 
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:outline-blue-500"
              value={newUserName}
              onChange={e => setNewUserName(e.target.value)}
              onKeyDown={handleCreateUser}
            />
          </div>
          
          <select 
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-blue-500"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
          >
             <option value="">-- Employee Registry: View Competencies --</option>
             {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>

          <div className="flex-grow bg-slate-900 border border-slate-800 rounded-lg p-4 overflow-y-auto min-h-[300px] max-h-[400px]">
             {selectedUserId ? (
                 <>
                   <p className="text-xs text-gray-500 mb-4 uppercase tracking-wider border-b border-gray-800 pb-2">Employee Readiness Matrix</p>
                   <TopicTree data={treeData} onSelectTopic={handleToggleTopic} />
                 </>
             ) : (
                 <p className="text-sm text-gray-500 text-center mt-10">Select an employee to expand their knowledge tree.</p>
             )}
          </div>

          <button 
             onClick={handleAssignSelected} 
             disabled={!selectedUserId || selectedTopics.size === 0}
             className="px-6 py-4 w-full bg-blue-600 disabled:bg-slate-800 disabled:text-gray-500 hover:bg-blue-500 text-white font-bold uppercase tracking-wider rounded-lg transition-colors mt-4"
          >
             {selectedTopics.size > 0 ? `Push ${selectedTopics.size} Topics to SRS Queue` : `Select Topic Nodes to Distribute`}
          </button>
        </div>

      </div>
    </div>
  );
}
