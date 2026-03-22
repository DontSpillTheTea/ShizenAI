import React, { useState, useEffect, useRef } from 'react';
import { getQueue, submitEvaluation, getEmployeeHierarchy } from './api';
import { TopicTree, TopicNode, buildTree } from './components/TopicTree';

export default function EmployeeDashboard() {
  const [queue, setQueue] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<any>(null);
  const [status, setStatus] = useState('Fetching Daily Review Sync...');
  
  const [treeData, setTreeData] = useState<TopicNode[]>([]);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const loadTree = async () => {
    try {
      const flat = await getEmployeeHierarchy();
      setTreeData(buildTree(flat));
    } catch(err) { console.error('Error loading mastery tree', err); }
  }

  const loadQueue = async () => {
    try {
      const res = await getQueue();
      setQueue(res.queue);
      setStatus(res.queue.length === 0 ? 'Queue Empty. Your Path to Mastery is completely updated!' : '');
    } catch(err) { setStatus('Error loading SRS queue'); }
  };

  useEffect(() => { 
    loadQueue(); 
    loadTree();
  }, []);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e: any) => {
        let finalTrans = '';
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          if (e.results[i].isFinal) finalTrans += e.results[i][0].transcript;
        }
        if (finalTrans) setAnswer(prev => prev + (prev.trim() ? ' ' : '') + finalTrans.trim());
      };
      rec.onerror = (e: any) => { console.error(e); setIsListening(false); };
      recognitionRef.current = rec;
    }
  }, []);

  const toggleListen = () => {
    if (isListening) {
      try { recognitionRef.current?.stop(); } catch(e) {}
      setIsListening(false);
    } else {
      try { recognitionRef.current?.start(); } catch(e) {}
      setIsListening(true);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        e.preventDefault();
        try { recognitionRef.current?.start(); } catch(err) {}
        setIsListening(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        e.preventDefault();
        try { recognitionRef.current?.stop(); } catch(err) {}
        setIsListening(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isListening) toggleListen();
    if (!answer.trim() || currentIdx >= queue.length) return;
    
    setStatus('Passing submission to Local LLM Judge...');
    try {
      const res = await submitEvaluation(queue[currentIdx].flashcard_id, answer);
      setResult(res);
      setStatus('');
      // Live reload the Mastery Tree to visualize competency shifts
      loadTree();
    } catch(err) { setStatus('Evaluation backend failed'); }
  };

  const handleSkip = () => {
    if (isListening) toggleListen();
    handleNext();
  };

  const handleNext = () => {
    setResult(null);
    setAnswer('');
    if (currentIdx + 1 < queue.length) { setCurrentIdx(c => c + 1); } 
    else { loadQueue(); setCurrentIdx(0); }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 mt-8">
      <div className="flex justify-between items-center mb-8">
        <div>
           <h2 className="text-3xl font-bold text-blue-400">Employee Workspace</h2>
           <p className="text-gray-400 mt-2">Voice-verified competence building & real-time mastery tracking.</p>
        </div>
        <span className="px-5 py-2 rounded-full bg-blue-900/40 text-blue-300 font-mono text-sm border border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
          Queue Due Today: {queue.length}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Topic Tree Mirror */}
        <div className="col-span-1 bg-white/5 border border-white/10 p-6 rounded-2xl flex flex-col max-h-[600px]">
           <h3 className="text-xl font-bold text-white mb-2">Path to Mastery</h3>
           <p className="text-xs text-gray-400 mb-6">Assigned structural knowledge map.</p>
           
           <div className="flex-grow bg-slate-900 border border-slate-700/80 rounded-lg p-4 overflow-y-auto">
             <TopicTree data={treeData} />
           </div>
        </div>

        {/* RIGHT COLUMN: Active Review Engine */}
        <div className="col-span-2">
           {status && <div className="p-4 bg-slate-900 rounded-lg text-emerald-400 mb-6 font-mono border border-emerald-900/50">{status}</div>}

           {queue.length > 0 && currentIdx < queue.length && !result && (
             <div className="bg-slate-900/80 border border-slate-700/80 p-8 rounded-3xl shadow-2xl shadow-black/80 space-y-6">
               <p className="text-sm text-gray-400 font-mono uppercase tracking-widest border-b border-white/5 pb-2">Active Assessment {currentIdx + 1} / {queue.length}</p>
               <div className="text-2xl text-white font-medium italic leading-relaxed py-4">
                 "{queue[currentIdx].question}"
               </div>
               
               <form onSubmit={handleSubmit} className="space-y-4">
                 <div className="relative">
                   <textarea
                     value={answer}
                     onChange={e => setAnswer(e.target.value)}
                     className="w-full h-40 bg-black/80 border border-slate-700 rounded-2xl p-5 text-white focus:border-blue-500 outline-none text-lg resize-none shadow-inner"
                     placeholder="Demonstrate your knowledge via text or voice..."
                   />
                   <button type="button" onClick={toggleListen} className={`absolute bottom-4 right-4 p-4 rounded-full transition-all flex items-center justify-center ${isListening ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.7)] animate-pulse' : 'bg-slate-800 hover:bg-slate-700'}`} title="Hold to Dictate">
                       <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                   </button>
                 </div>
                 <div className="flex gap-4">
                   <button type="submit" className="flex-1 py-5 bg-blue-600 hover:bg-blue-500 text-white font-black tracking-widest uppercase rounded-2xl transition-colors shadow-lg">Submit For Evaluation</button>
                   <button type="button" onClick={() => setAnswer(queue[currentIdx]._debug_answer)} className="px-8 py-5 bg-purple-900/40 hover:bg-purple-800/60 text-purple-200 font-black tracking-widest uppercase rounded-2xl transition-colors border border-purple-900/50 shadow-lg flex items-center justify-center cursor-pointer" title="Debug: Auto-fill Correct Answer">
                     <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                   </button>
                   <button type="button" onClick={handleSkip} className="px-8 py-5 bg-red-900/40 hover:bg-red-800/60 text-red-200 font-black tracking-widest uppercase rounded-2xl transition-colors border border-red-900/50 shadow-lg flex items-center justify-center cursor-pointer" title="Skip / Mark Incorrect">
                     <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                   </button>
                 </div>
               </form>
             </div>
           )}

           {result && (
             <div className={`p-8 rounded-3xl border ${result.score >= 1 ? 'bg-emerald-900/20 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.15)]' : 'bg-red-900/20 border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.15)]'} space-y-6`}>
               <div className="flex flex-col gap-4">
                 <div className={`self-start px-6 py-2 text-sm font-black tracking-widest uppercase rounded-full ${result.score >= 1 ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]'}`}>
                   Judge Verdict: {result.score >= 1 ? 'Competence Verified' : 'Critical Failure'}
                 </div>
                 <p className="text-slate-200 text-xl leading-relaxed font-medium">{result.explanation}</p>
               </div>
               
               <div className="pt-6 border-t border-white/10 flex items-center justify-between">
                 <p className="text-sm text-gray-400 flex items-center gap-2 font-mono">
                   Memory Decay (SRS Next Review): <span className="text-white bg-white/10 px-3 py-1 rounded-md">{result.next_review_in_days} days</span>
                 </p>
                 <button onClick={handleNext} className="px-10 py-4 bg-slate-100 hover:bg-white text-black font-black uppercase tracking-widest rounded-xl transition-colors shadow-lg">Proceed</button>
               </div>
             </div>
           )}
        </div>

      </div>
    </div>
  );
}
