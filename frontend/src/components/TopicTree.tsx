import { useState } from 'react';

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
  
  const statusColors = {
    gray: 'text-gray-400',
    red: 'text-red-400',
    green: 'text-green-400'
  };

  return (
    <div className="pl-4 border-l border-gray-700 ml-2 mt-1">
      <div className="flex items-center space-x-2 py-1 cursor-pointer">
        {node.children.length > 0 ? (
          <span onClick={() => setExpanded(!expanded)} className="text-gray-400 select-none w-4 text-center hover:text-white transition-colors">
            {expanded ? '▼' : '▶'}
          </span>
        ) : <span className="w-4" />}
        
        {onSelectTopic && (
          <input 
            type="checkbox" 
            onChange={(e) => onSelectTopic(node.id, e.target.checked)} 
            className="bg-gray-800 rounded border-gray-600 accent-blue-500 cursor-pointer" 
          />
        )}
        
        <span 
          onClick={() => node.children.length > 0 && setExpanded(!expanded)}
          className={`font-medium ${statusColors[node.status] || 'text-gray-400'}`}
        >
          {node.title}
        </span>
        
        {onSelectTopic && node.status !== 'gray' && (
          <span className="text-[10px] font-black tracking-widest uppercase bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded ml-2 border border-emerald-500/30">Assigned</span>
        )}
      </div>
      
      {expanded && node.children.length > 0 && (
        <TopicTree data={node.children} onSelectTopic={onSelectTopic} />
      )}
    </div>
  );
}
