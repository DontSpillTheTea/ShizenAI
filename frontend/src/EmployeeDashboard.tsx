import React, { useState, useEffect, useRef } from 'react';
import { getQueue, evaluateAnswer } from './api';

export default function EmployeeDashboard() {
  const [queue, setQueue] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<any>(null);
  const [status, setStatus] = useState('Fetching Daily Review Sync...');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const loadQueue = async () => {
    try {
      const res = await getQueue();
      setQueue(res.queue);
      setStatus(res.queue.length === 0 ? 'Queue Empty. You are completely caught up for today!' : '');
    } catch(err) { setStatus('Error loading SRS queue'); }
  };

  useEffect(() => { loadQueue(); }, []);

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
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); }
    else { recognitionRef.current?.start(); setIsListening(true); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isListening) toggleListen();
    if (!answer.trim() || currentIdx >= queue.length) return;
    
    setStatus('Passing submission to Llama 3 Judge...');
    try {
      const res = await evaluateAnswer(queue[currentIdx].flashcard_id, answer);
      setResult(res);
      setStatus('');
    } catch(err) { setStatus('Evaluation backend failed'); }
  };

  const handleNext = () => {
    setResult(null);
    setAnswer('');
    if (currentIdx + 1 < queue.length) { setCurrentIdx(c => c + 1); } 
    else { loadQueue(); setCurrentIdx(0); }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 mt-8">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-blue-400">Employee Daily Queue</h2>
        <span className="px-4 py-1 rounded-full bg-blue-900/30 text-blue-300 font-mono text-sm border border-blue-500/20">
          Due Today: {queue.length}
        </span>
      </div>

      {status && <div className="p-4 bg-slate-900 rounded-lg text-emerald-400 mb-6 font-mono border border-slate-700">{status}</div>}

      {queue.length > 0 && currentIdx < queue.length && !result && (
        <div className="bg-slate-900/80 border border-slate-700/80 p-8 rounded-3xl shadow-xl shadow-black/50 space-y-6">
          <p className="text-sm text-gray-400 font-mono uppercase tracking-widest border-b border-white/5 pb-2">Review Card {currentIdx + 1}</p>
          <div className="text-2xl text-white font-medium italic leading-relaxed">
            "{queue[currentIdx].question}"
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="relative">
              <textarea
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                className="w-full h-40 bg-black/60 border border-slate-700 rounded-2xl p-5 text-white focus:border-blue-500 outline-none text-lg resize-none"
                placeholder="Prove your knowledge..."
              />
              <button type="button" onClick={toggleListen} className={`absolute bottom-4 right-4 p-3 rounded-full transition-all flex items-center justify-center ${isListening ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse' : 'bg-slate-800 hover:bg-slate-700'}`} title="Hold to Dictate">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              </button>
            </div>
            <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold tracking-wider uppercase rounded-2xl transition-colors">Submit For Evaluation</button>
          </form>
        </div>
      )}

      {result && (
        <div className={`p-8 rounded-3xl border ${result.score === 1 ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-red-900/20 border-red-500/50'} space-y-6 shadow-xl`}>
          <div className="flex flex-col gap-4">
            <div className={`self-start px-4 py-1.5 text-sm font-black tracking-widest uppercase rounded-full ${result.score === 1 ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]'}`}>
              Judge Verdict: {result.score === 1 ? 'Pass' : 'Fail'}
            </div>
            <p className="text-slate-200 text-xl leading-relaxed">{result.explanation}</p>
          </div>
          
          <div className="pt-4 border-t border-white/10 flex items-center justify-between">
            <p className="text-sm text-gray-400 flex items-center gap-2 font-mono">
              Memory Decay (SRS Next Review): <span className="text-white bg-white/10 px-2 py-0.5 rounded">{result.next_review_in_days} days</span>
            </p>
            <button onClick={handleNext} className="px-8 py-3 bg-slate-100 hover:bg-white text-black font-bold uppercase tracking-wider rounded-xl transition-colors">Proceed</button>
          </div>
        </div>
      )}
    </div>
  );
}
