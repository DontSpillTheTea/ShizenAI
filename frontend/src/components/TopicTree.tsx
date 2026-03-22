import { useState } from 'react';
import { getTopicCards } from '../api';

export interface TopicNode {
  id: string;
  title: string;
  path: string;
  parent_id: string | null;
  status: 'unchecked' | 'in_progress' | 'verified';
  source_type?: 'formal' | 'informal';
  assigned?: boolean;
  children: TopicNode[];
}

/** Maps legacy backend color strings to semantic status values safely. */
export function normalizeStatus(raw: string): TopicNode['status'] {
  if (raw === 'green') return 'verified';
  if (raw === 'red') return 'in_progress';
  return 'unchecked'; // gray, missing, unknown -> unchecked
}

export function buildTree(flat: any[]): TopicNode[] {
  const map = new Map<string, TopicNode>();
  const roots: TopicNode[] = [];

  flat.forEach(f => {
    map.set(f.id, {
      ...f,
      status: normalizeStatus(f.status),
      assigned: f.assigned ?? undefined,
      source_type: f.source_type ?? undefined,
      children: []
    });
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

/** Recursively count statuses in a tree — use for progress summary cards. */
export function countTopicStatuses(nodes: TopicNode[]): { verified: number; in_progress: number; unchecked: number } {
  let verified = 0, in_progress = 0, unchecked = 0;
  function walk(list: TopicNode[]) {
    for (const n of list) {
      if (n.status === 'verified') verified++;
      else if (n.status === 'in_progress') in_progress++;
      else unchecked++;
      walk(n.children);
    }
  }
  walk(nodes);
  return { verified, in_progress, unchecked };
}

export function TopicTree({ data, onSelectTopic }: { data: TopicNode[], onSelectTopic?: (id: string, selected: boolean) => void }) {
  if (!data || data.length === 0) return <div className="text-gray-500 italic ml-4 text-sm">No topics assigned yet.</div>;

  return (
    <div className="space-y-1">
      {data.map(node => <TopicTreeNode key={node.id} node={node} onSelectTopic={onSelectTopic} />)}
    </div>
  );
}

// ── Status badge config ───────────────────────────────────────────────────────
const STATUS_CONFIG: Record<TopicNode['status'], { label: string; chip: string }> = {
  verified:    { label: 'Verified',     chip: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  in_progress: { label: 'In Progress',  chip: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  unchecked:   { label: 'Unchecked',    chip: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
};

const SOURCE_CONFIG: Record<'formal' | 'informal', { label: string; chip: string }> = {
  formal:   { label: 'Formal',   chip: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  informal: { label: 'Informal', chip: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
};

function Chip({ label, className }: { label: string; className: string }) {
  return (
    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border select-none ${className}`}>
      {label}
    </span>
  );
}

function TopicTreeNode({ node, onSelectTopic }: { node: TopicNode, onSelectTopic?: (id: string, selected: boolean) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [cards, setCards] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  const statusCfg = STATUS_CONFIG[node.status];

  const handleExpand = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && cards === null) {
      setLoading(true);
      try {
        const data = await getTopicCards(node.id);
        setCards(data);
      } catch (e) { console.error(e); }
      setLoading(false);
    }
  };

  return (
    <div className="pl-4 border-l border-slate-700/60 ml-2 mt-1">
      {/* ── Row ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 py-1.5">
        {onSelectTopic && (
          <input
            type="checkbox"
            onChange={e => onSelectTopic(node.id, e.target.checked)}
            className="bg-gray-800 rounded border-gray-600 accent-blue-500 cursor-pointer flex-shrink-0"
          />
        )}

        <span
          onClick={handleExpand}
          className="font-medium text-gray-200 hover:text-white transition-colors select-none cursor-pointer text-sm"
        >
          {node.title}
        </span>

        {/* Status badge */}
        <Chip label={statusCfg.label} className={statusCfg.chip} />

        {/* Source type badge — only when available */}
        {node.source_type && (
          <Chip label={SOURCE_CONFIG[node.source_type].label} className={SOURCE_CONFIG[node.source_type].chip} />
        )}

        {/* Assigned badge — only when explicitly assigned */}
        {node.assigned === true && (
          <Chip label="Assigned" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30" />
        )}
      </div>

      {/* ── Expansion panel ─────────────────────────────────────────────── */}
      {expanded && (
        <div className="ml-6 border-l-2 border-slate-700/50 pl-4 py-2 mt-1 mb-2 bg-slate-800/20 rounded-r-xl max-h-64 overflow-y-auto">
          {loading && <div className="text-xs text-gray-500 italic">Loading topic evidence...</div>}

          {!loading && cards && cards.length === 0 && node.children.length === 0 && (
            <div className="text-xs text-gray-500 italic">No questions or child topics found.</div>
          )}

          {!loading && cards && cards.length > 0 && (
            <div className="space-y-2 mb-4">
              <h4 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">
                Verification Prompts ({cards.length})
              </h4>
              {cards.map((c: any) => (
                <div key={c.id} className="text-sm text-slate-300 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 italic">
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
