import React, { useState, useEffect } from 'react';
import { uploadDocument, getUsers, assignTopic, getAdminHierarchy, createEmployee, importOmiText, finalizeOmiImport, getOmiCaptures } from './api';
import { TopicTree, TopicNode, buildTree, countTopicStatuses } from './components/TopicTree';
import { Sprout } from 'lucide-react';

interface CapturedItem {
  id: string;
  title: string;
  source_type: 'formal' | 'informal';
  origin: string;
  topics_extracted: number;
  unchecked?: number;
}

export default function AdminDashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [topic, setTopic] = useState('');
  const [status, setStatus] = useState('');

  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  
  const [treeData, setTreeData] = useState<TopicNode[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [newUserName, setNewUserName] = useState('');

  const [omiTitle, setOmiTitle] = useState('');
  const [omiTranscript, setOmiTranscript] = useState('');
  const [omiTopicPath, setOmiTopicPath] = useState('');
  const [omiStatus, setOmiStatus] = useState('');
  const [omiLoading, setOmiLoading] = useState(false);

  const [capturedItems, setCapturedItems] = useState<CapturedItem[]>([]);

  // Load Users and captured knowledge on mount
  useEffect(() => {
    getUsers().then(setUsers).catch(console.error);
    getOmiCaptures().then(items => {
      if (items.length > 0) {
        setCapturedItems(items.map((s: any) => ({
          id: s.id,
          title: s.title,
          source_type: s.source_type,
          origin: s.origin === 'omi' ? 'Captured from Omi conversation' : 'Uploaded document',
          topics_extracted: s.topics_created_count,
          unchecked: s.unchecked_count,
        })));
      }
    }).catch(console.error);
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
    setStatus('Processing document — extracting knowledge and generating flashcards...');
    try {
      const res = await uploadDocument(file, topic);
      setStatus(res.message);
      const newItem: CapturedItem = {
        id: Date.now().toString(),
        title: file.name.replace(/\.[^.]+$/, ''),
        source_type: 'formal',
        origin: 'Uploaded document',
        topics_extracted: 1,
        unchecked: 1,
      };
      setCapturedItems(prev => [newItem, ...prev]);
      loadTree(selectedUserId || '');
    } catch (err: any) { 
      setStatus(err.message); 
    }
  };

  const handleOmiImport = async () => {
    if (!omiTranscript.trim()) { setOmiStatus('Please paste a transcript first.'); return; }
    setOmiLoading(true);
    setOmiStatus('Saving transcript...');
    try {
      const title = omiTitle.trim() || 'Omi conversation';
      const { source_id } = await importOmiText(title, omiTranscript.trim(), omiTopicPath.trim() || undefined);
      setOmiStatus('Extracting topics with AI — this may take a moment...');
      const result = await finalizeOmiImport({ source_id, topic_path: omiTopicPath.trim() || undefined });
      setOmiStatus(result.message);
      // Refresh captures from backend
      const captures = await getOmiCaptures();
      setCapturedItems(captures.map((s: any) => ({
        id: s.id,
        title: s.title,
        source_type: s.source_type,
        origin: s.origin === 'omi' ? 'Captured from Omi conversation' : 'Uploaded document',
        topics_extracted: s.topics_created_count,
        unchecked: s.unchecked_count,
      })));
      // Refresh topic tree
      loadTree(selectedUserId || '');
      setOmiTitle('');
      setOmiTranscript('');
      setOmiTopicPath('');
    } catch (err: any) {
      setOmiStatus(`Import failed: ${err.message}`);
    }
    setOmiLoading(false);
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
        setStatus(`Successfully assigned ${count} topic${count !== 1 ? 's' : ''} to the employee.`);
        loadTree(selectedUserId);
        setSelectedTopics(new Set());
    } catch (err: any) {
        setStatus(err.message);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 mt-8">
      <div>
        <h2 className="text-3xl font-bold text-emerald-400 flex items-center gap-3">
          <Sprout className="w-8 h-8" />
          Manager Workspace
        </h2>
        <p className="text-gray-400 mt-2">Capture knowledge, assign learning goals, and track employee fluency.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* LEFT COLUMN: Knowledge Capture */}
        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl space-y-6">
          <h3 className="text-xl font-bold text-white">1. Capture Knowledge</h3>

          {/* Document Upload */}
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Topic Path</label>
              <input type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Developer -> Deployment -> Docker" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-emerald-500" required />
            </div>
            <div className="border-2 border-dashed border-emerald-500/30 p-8 text-center rounded-xl bg-slate-900 transition-hover hover:border-emerald-500/80">
              <label className="block text-sm font-semibold text-emerald-300 mb-2 cursor-pointer">
                Upload a knowledge source
                <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="hidden" required />
              </label>
              <p className="text-xs text-emerald-500 font-mono">{file ? file.name : "Click to browse (.pdf, .docx, .txt)"}</p>
            </div>
            <button type="submit" className="px-6 py-4 w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold uppercase tracking-wider rounded-lg transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)]">Process Document</button>
          </form>
          {status && <div className="p-4 bg-slate-900 rounded-lg text-sm font-mono text-emerald-300 border border-emerald-900/50">{status}</div>}

          {/* Omi Import */}
          <div className="border-t border-white/10 pt-6 space-y-3">
            <div>
              <p className="text-sm font-bold text-white">Import Omi Conversation</p>
              <p className="text-xs text-gray-400 mt-1">Paste a transcript from an Omi conversation to capture informal spoken knowledge.</p>
            </div>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Title (e.g. Rollback walkthrough)"
                value={omiTitle}
                onChange={e => setOmiTitle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-indigo-500"
              />
              <textarea
                placeholder="Paste Omi transcript here..."
                value={omiTranscript}
                onChange={e => setOmiTranscript(e.target.value)}
                rows={4}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-indigo-500 resize-none"
              />
              <input
                type="text"
                placeholder="Topic path (e.g. Engineering &gt; Deployments)"
                value={omiTopicPath}
                onChange={e => setOmiTopicPath(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-indigo-500"
              />
              <button
                type="button"
                onClick={handleOmiImport}
                disabled={omiLoading || !omiTranscript.trim()}
                className="w-full px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-gray-500 text-white font-bold uppercase tracking-wider rounded-lg text-sm transition-colors"
              >
                {omiLoading ? 'Extracting...' : 'Import & Extract Topics'}
              </button>
            </div>
            {omiStatus && <div className="p-3 bg-slate-900 rounded-lg text-xs font-mono text-indigo-300 border border-indigo-900/50">{omiStatus}</div>}
          </div>
        </div>

        {/* RIGHT COLUMN: Assignment */}
        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl space-y-4 flex flex-col">
          <h3 className="text-xl font-bold text-white mb-4">2. Assign Learning Topics</h3>

          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Add new employee... (Press Enter)" 
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
             <option value="">-- Select Employee --</option>
             {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>

          <div className="flex-grow bg-slate-900 border border-slate-800 rounded-lg p-4 overflow-y-auto min-h-[300px] max-h-[400px]">
             {selectedUserId ? (
                 <>
                   <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider border-b border-gray-800 pb-2">Employee Progress Map</p>
                   {/* Progress summary */}
                   {(() => {
                     const c = countTopicStatuses(treeData);
                     return (
                       <div className="grid grid-cols-3 gap-2 mb-4">
                         <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2 text-center">
                           <p className="text-base font-black text-emerald-400">{c.verified}</p>
                           <p className="text-[9px] text-emerald-500 uppercase tracking-widest font-bold">Verified</p>
                         </div>
                         <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 text-center">
                           <p className="text-base font-black text-amber-400">{c.in_progress}</p>
                           <p className="text-[9px] text-amber-500 uppercase tracking-widest font-bold">In Progress</p>
                         </div>
                         <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-2 text-center">
                           <p className="text-base font-black text-blue-400">{c.unchecked}</p>
                           <p className="text-[9px] text-blue-500 uppercase tracking-widest font-bold">Unchecked</p>
                         </div>
                       </div>
                     );
                   })()}
                   <TopicTree data={treeData} onSelectTopic={handleToggleTopic} />
                 </>
             ) : (
                 <p className="text-sm text-gray-500 text-center mt-10">Select an employee to view their knowledge map.</p>
             )}
          </div>

          <button 
             onClick={handleAssignSelected} 
             disabled={!selectedUserId || selectedTopics.size === 0}
             className="px-6 py-4 w-full bg-blue-600 disabled:bg-slate-800 disabled:text-gray-500 hover:bg-blue-500 text-white font-bold uppercase tracking-wider rounded-lg transition-colors mt-4"
          >
             {selectedTopics.size > 0 ? `Assign ${selectedTopics.size} Topics` : `Select topics to assign`}
          </button>
        </div>

      </div>

      {/* BOTTOM: Recent Captured Knowledge */}
      <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
        <h3 className="text-lg font-bold text-white mb-4">Recent Captured Knowledge</h3>
        <div className="space-y-3">
          {capturedItems.length === 0 && (
            <p className="text-sm text-gray-500 italic">No knowledge captured yet. Upload a document or import an Omi conversation above.</p>
          )}
          {capturedItems.map(item => (
            <div key={item.id} className="flex items-center justify-between p-4 bg-slate-900 border border-slate-700/50 rounded-xl">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{item.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{item.origin}</p>
              </div>
              <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                  item.source_type === 'formal'
                    ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                    : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                }`}>
                  {item.source_type === 'formal' ? 'Formal' : 'Informal'}
                </span>
                {item.unchecked != null && item.unchecked > 0 && (
                  <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
                    {item.unchecked} unchecked
                  </span>
                )}
                <span className="text-xs text-gray-500 font-mono">{item.topics_extracted} topic{item.topics_extracted !== 1 ? 's' : ''}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
