import { useState } from 'react';
import { getTopicCards } from '../api';

export interface TopicNode {
  id: string;
  title: string;
  path: string;
  parent_id: string | null;
  status: 'gray' | 'red' | 'green';
  children: TopicNode[];
}

export function buildTree(flat: any[]): TopicNode[] {
  const map = new Map<string, TopicNode>();
  const roots: TopicNode[] = [];
  
  flat.forEach(f => {
    map.set(f.id, { ...f, children: [] });
  });
  
  flat.forEach(f => {
    if (f.parent_id && map.has(f.parent_id)) {
      map.get(f.parent_id)!.children.push(map.get(f.id)!);
    } else {
      roots.push(map.get(f.id)!);
    }
  });
  return roots;
}

export function TopicTree({ data, onSelectTopic }: { data: TopicNode[], onSelectTopic?: (id: string, selected: boolean) => void }) {
  if (!data || data.length === 0) return <div className="text-gray-500 italic ml-4">No topics found.</div>;
  
  return (
    <div className="space-y-1">
      {data.map(node => <TopicTreeNode key={node.id} node={node} onSelectTopic={onSelectTopic} />)}
    </div>
  );
}

function TopicTreeNode({ node, onSelectTopic }: { node: TopicNode, onSelectTopic?: (id: string, selected: boolean) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [cards, setCards] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  
  const statusColors = {
    gray: 'text-gray-400',
    red: 'text-red-400',
    green: 'text-green-400'
  };

  const handleExpand = async () => {
    const nextState = !expanded;
    setExpanded(nextState);
    if (nextState && cards === null) {
      setLoading(true);
      try {
        const data = await getTopicCards(node.id);
        setCards(data);
      } catch (e) { console.error(e); }
      setLoading(false);
    }
  };

  return (
    <div className="pl-4 border-l border-gray-700 ml-2 mt-1">
      <div className="flex items-center space-x-2 py-1 cursor-pointer">
        <span onClick={handleExpand} className="text-gray-400 select-none w-4 text-center hover:text-white transition-colors">
          {expanded ? '▼' : '▶'}
        </span>
        
        {onSelectTopic && (
          <input 
            type="checkbox" 
            onChange={(e) => onSelectTopic(node.id, e.target.checked)} 
            className="bg-gray-800 rounded border-gray-600 accent-blue-500 cursor-pointer" 
          />
        )}
        
        <span 
          onClick={handleExpand}
          className={`font-medium ${statusColors[node.status] || 'text-gray-400'}`}
        >
          {node.title}
        </span>
        
        {onSelectTopic && node.status !== 'gray' && (
          <span className="text-[10px] font-black tracking-widest uppercase bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded ml-2 border border-emerald-500/30">Assigned</span>
        )}
      </div>
      
      {expanded && (
          <div className="ml-6 border-l-2 border-slate-700/50 pl-4 py-2 mt-2 mb-2 bg-slate-800/20 rounded-r-xl max-h-64 overflow-y-auto custom-scrollbar">
            {loading && <div className="text-xs text-gray-500 italic">Scanning topic boundaries...</div>}
            {!loading && cards && cards.length === 0 && node.children.length === 0 && <div className="text-xs text-gray-500 italic">No assigned flashcards found for this node.</div>}
            
            {!loading && cards && cards.length > 0 && (
                <div className="space-y-2 mb-4">
                  <h4 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">Topic Inspect: {cards.length} Question(s)</h4>
                  {cards.map((c: any) => (
                    <div key={c.id} className="text-sm text-slate-300 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 italic font-medium">
                      "{c.question}"
                    </div>
                  ))}
                </div>
            )}
            
            {node.children.length > 0 && (
                <div className="mt-2">
                    <TopicTree data={node.children} onSelectTopic={onSelectTopic} />
                </div>
            )}
          </div>
      )}
    </div>
  );
}
