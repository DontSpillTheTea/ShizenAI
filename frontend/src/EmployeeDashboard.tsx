import React, { useState, useEffect, useRef } from 'react';
import { getQueue, submitEvaluation, getEmployeeHierarchy, markCardWrong, getTTSAudioBlob } from './api';
import { TopicTree, TopicNode, buildTree, countTopicStatuses } from './components/TopicTree';
import { Sprout } from 'lucide-react';

// Set to true during development to show debug autofill button
const DEMO_DEBUG = false;

export default function EmployeeDashboard() {
  const [queue, setQueue] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [cardState, setCardState] = useState<'initial' | 'passed_chatting' | 'failed_chatting'>('initial');
  const [status, setStatus] = useState('Loading your assigned topics...');

  const [treeData, setTreeData] = useState<TopicNode[]>([]);

  const [isListening, setIsListening] = useState(false);
  const [micNotice, setMicNotice] = useState('');
  const [micReady, setMicReady] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [autoSubmitTrigger, setAutoSubmitTrigger] = useState(0);

  const loadTree = async () => {
    try {
      const flat = await getEmployeeHierarchy();
      setTreeData(buildTree(flat));
    } catch (err) { console.error('Error loading topic tree', err); }
  };

  const loadQueue = async () => {
    try {
      const res = await getQueue();
      setQueue(res.queue);
      setStatus(res.queue.length === 0 ? 'All caught up! No topics due today.' : '');
    } catch (err) { setStatus('Error loading topic queue'); }
  };

  useEffect(() => {
    loadQueue();
    loadTree();
  }, []);

  useEffect(() => {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!window.isSecureContext && !isLocalhost) {
      setMicNotice('Microphone is blocked on insecure HTTP. Use HTTPS (or localhost) and allow mic permission.');
      return;
    }

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
        if (finalTrans) setAnswer((prev: string) => prev + (prev.trim() ? ' ' : '') + finalTrans.trim());
      };
      rec.onerror = (e: any) => {
        console.error(e);
        if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
          setMicNotice('Microphone permission denied. Enable mic access in browser site settings.');
        } else {
          setMicNotice(`Microphone error: ${e?.error || 'unknown'}.`);
        }
        setIsListening(false);
      };
      recognitionRef.current = rec;
      setMicReady(true);
    } else {
      setMicNotice('Speech recognition is not supported in this browser.');
    }
  }, []);

  const toggleListen = async () => {
    if (!micReady || !recognitionRef.current) {
      if (!micNotice) setMicNotice('Microphone is unavailable in this browser/context.');
      return;
    }

    if (isListening) {
      try { recognitionRef.current?.stop(); } catch (e) { }
      setIsListening(false);
    } else {
      try {
        // Trigger permission prompt for browsers that gate speech APIs behind mic permission.
        if (navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((t) => t.stop());
        }
        recognitionRef.current?.start();
        setMicNotice('');
      } catch (e: any) {
        console.error(e);
        setMicNotice('Microphone permission blocked. Allow mic access and retry.');
        return;
      }
      setIsListening(true);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (!micReady || !recognitionRef.current) return;
        try { recognitionRef.current?.start(); } catch (err) { }
        setIsListening(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        e.preventDefault();
        try { recognitionRef.current?.stop(); } catch (err) { }
        setIsListening(false);
        setTimeout(() => setAutoSubmitTrigger(Date.now()), 600);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isListening) toggleListen();
    if (!answer.trim() || currentIdx >= queue.length) return;

    setStatus('Evaluating your response...');
    const newChat = [...chatHistory, { role: 'user', content: answer }];
    setChatHistory(newChat);
    setAnswer('');

    try {
      const res = await submitEvaluation(queue[currentIdx].flashcard_id, newChat);
      if (res.status === 'passed_auto') {
        handleNext();
      } else if (res.status === 'passed_chatting') {
        setCardState('passed_chatting');
        setChatHistory([...newChat, { role: 'assistant', content: res.explanation }]);
        playAudio(res.explanation);
        loadTree();
      } else {
        setCardState('failed_chatting');
        setChatHistory([...newChat, { role: 'assistant', content: res.explanation }]);
        playAudio(res.explanation);
      }
      setStatus('');
    } catch (err) { setStatus('Something went wrong. Please try again.'); }
  };

  const playAudio = async (text: string) => {
    try {
      const blob = await getTTSAudioBlob(text);
      const audio = new Audio(URL.createObjectURL(blob));
      audio.play();
    } catch (e) { console.error('Audio synthesis failed', e); }
  };

  useEffect(() => {
    if (autoSubmitTrigger > 0) {
      handleSubmit();
    }
  }, [autoSubmitTrigger]);

  const handleMarkWrongAndNext = async () => {
    if (isListening) toggleListen();
    try {
      await markCardWrong(queue[currentIdx].flashcard_id);
    } catch (e) { console.error(e); }
    handleNext();
  };

  const handleNext = () => {
    setCardState('initial');
    setChatHistory([]);
    setAnswer('');
    if (currentIdx + 1 < queue.length) { setCurrentIdx((c: number) => c + 1); }
    else { loadQueue(); setCurrentIdx(0); }
  };

  const counts = countTopicStatuses(treeData);

  return (
    <div className="max-w-6xl mx-auto p-6 mt-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-blue-400 flex items-center gap-3">
            <Sprout className="w-8 h-8" />
            Employee Learning Workspace
          </h2>
          <p className="text-gray-400 mt-2">Practice assigned topics, verify understanding, and track progress.</p>
        </div>
        <span className="px-5 py-2 rounded-full bg-blue-900/40 text-blue-300 font-mono text-sm border border-blue-500/30">
          Topics Due Today: {queue.length > 0 ? queue.length - currentIdx : 0}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

        {/* LEFT COLUMN: Assigned Topics Tree */}
        <div className="col-span-1 bg-white/5 border border-white/10 p-6 rounded-2xl flex flex-col max-h-[640px]">
          <h3 className="text-xl font-bold text-white mb-1">Assigned Topics</h3>
          <p className="text-xs text-gray-400 mb-4">What you are expected to know and verify.</p>

          {/* Progress summary */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2 text-center">
              <p className="text-lg font-black text-emerald-400">{counts.verified}</p>
              <p className="text-[10px] text-emerald-500 uppercase tracking-widest font-bold">Verified</p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 text-center">
              <p className="text-lg font-black text-amber-400">{counts.in_progress}</p>
              <p className="text-[10px] text-amber-500 uppercase tracking-widest font-bold">In Progress</p>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-2 text-center">
              <p className="text-lg font-black text-blue-400">{counts.unchecked}</p>
              <p className="text-[10px] text-blue-500 uppercase tracking-widest font-bold">Unchecked</p>
            </div>
          </div>

          <div className="flex-grow bg-slate-900 border border-slate-700/80 rounded-lg p-4 overflow-y-auto">
            <TopicTree data={treeData} />
          </div>
        </div>

        {/* RIGHT COLUMN: Active Review Engine */}
        <div className="col-span-2">
          {status && <div className="p-4 bg-slate-900 rounded-lg text-emerald-400 mb-6 font-mono border border-emerald-900/50 text-sm">{status}</div>}

          {queue.length > 0 && currentIdx < queue.length && (
            <div className="bg-slate-900/80 border border-slate-700/80 p-8 rounded-3xl shadow-2xl shadow-black/80 space-y-6">

              {/* Topic counter + verification state chip */}
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <p className="text-sm text-gray-400 font-mono uppercase tracking-widest">
                  Current Topic {currentIdx + 1} / {queue.length}
                </p>
                {cardState === 'passed_chatting' && (
                  <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    ✓ Verified
                  </span>
                )}
                {cardState === 'failed_chatting' && (
                  <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    ↩ Needs Follow-Up
                  </span>
                )}
              </div>

              {cardState === 'initial' && (
                <div className="text-2xl text-white font-medium italic leading-relaxed py-4">
                  "{queue[currentIdx].question}"
                </div>
              )}

              {chatHistory.length > 0 && (
                <div className="space-y-4 max-h-96 overflow-y-auto mb-4">
                  {chatHistory.map((msg: any, i: number) => (
                    <div key={i} className={`p-4 rounded-xl ${msg.role === 'user' ? 'bg-blue-900/40 text-blue-100 ml-12' : 'bg-slate-800/80 text-emerald-100 mr-12'}`}>
                      <span className="font-bold text-[10px] uppercase tracking-widest opacity-50 block mb-1">{msg.role === 'user' ? 'You' : 'Tutor'}</span>
                      <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 flex flex-col">
                {micNotice && (
                  <div className="text-xs text-amber-300 bg-amber-900/20 border border-amber-700/40 rounded-lg px-3 py-2">
                    {micNotice}
                  </div>
                )}
                <div className="relative">
                  <textarea
                    value={answer}
                    onChange={(e: any) => setAnswer(e.target.value)}
                    className="w-full h-32 bg-black/80 border border-slate-700 rounded-2xl p-5 text-white focus:border-blue-500 outline-none text-lg resize-none shadow-inner"
                    placeholder={cardState === 'initial' ? 'Answer via text or hold Space to speak...' : 'Ask a follow-up question...'}
                  />
                  <button
                    type="button"
                    onClick={toggleListen}
                    className={`absolute bottom-4 right-4 p-4 rounded-full transition-all flex items-center justify-center ${isListening ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.7)] animate-pulse' : 'bg-slate-800 hover:bg-slate-700'}`}
                    title="Hold Space or click to dictate"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                  </button>
                </div>

                <div className="flex gap-4">
                  <button type="submit" className="flex-1 py-5 bg-blue-600 hover:bg-blue-500 text-white font-black tracking-widest uppercase rounded-2xl transition-colors shadow-lg">
                    {cardState === 'initial' ? 'Submit' : 'Respond'}
                  </button>

                  {/* Debug-only autofill button */}
                  {DEMO_DEBUG && cardState === 'initial' && (
                    <button
                      type="button"
                      onClick={() => setAnswer(queue[currentIdx]._debug_answer)}
                      className="px-8 py-5 bg-purple-900/40 hover:bg-purple-800/60 text-purple-200 font-black tracking-widest uppercase rounded-2xl border border-purple-900/50 shadow-lg flex items-center justify-center cursor-pointer"
                      title="Debug: Auto-fill answer"
                    >
                      <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </button>
                  )}

                  {cardState === 'passed_chatting' && (
                    <button type="button" onClick={handleNext} className="flex-1 py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black tracking-widest uppercase rounded-2xl shadow-lg">
                      Continue
                    </button>
                  )}

                  {(cardState === 'initial' || cardState === 'failed_chatting') && (
                    <button
                      type="button"
                      onClick={handleMarkWrongAndNext}
                      className="px-8 py-5 bg-red-900/40 hover:bg-red-800/60 text-red-200 font-black tracking-widest uppercase rounded-2xl border border-red-900/50 shadow-lg flex items-center justify-center cursor-pointer"
                      title="Mark incorrect and move on"
                    >
                      {cardState === 'failed_chatting'
                        ? 'Mark Wrong & Next'
                        : <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                      }
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
