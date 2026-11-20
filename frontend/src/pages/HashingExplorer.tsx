import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Boxes,
  DollarSign,
  Hash,
  Info,
  KeyRound,
  Link2,
  Search,
  TableProperties,
  Timer,
  TriangleAlert,
} from 'lucide-react';
import { Badge, Card, EmptyState, PageHeader, SectionTitle, Spinner, StatCard } from '../components/ui';
import { useToast } from '../components/Toast';
import { useGraph } from '../hooks/useGraph';
import { apiError, hashLookup } from '../services/api';
import { formatWeight } from '../lib/format';
import type { HashLookup } from '../types';

export default function HashingExplorer() {
  const { graph, loading } = useGraph();
  const { error: toastError } = useToast();

  const [query, setQuery] = useState('');
  const [result, setResult] = useState<HashLookup | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setResult(null);
    setQuery('');
  }, [graph?.id]);

  const search = async (term?: string) => {
    if (!graph) return;
    const value = (term ?? query).trim();
    if (!value) {
      toastError('Type a node id to look up');
      return;
    }
    setBusy(true);
    try {
      const data = await hashLookup(graph.id, value);
      setResult(data);
      setQuery(value);
    } catch (err) {
      toastError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const suggestions = useMemo(
    () =>
      (graph?.nodes ?? []).filter((node) =>
        node.label.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [graph, query],
  );

  if (loading && !graph) {
    return <Card className="p-6"><Spinner /></Card>;
  }

  if (!graph) {
    return (
      <Card>
        <EmptyState
          icon={<Hash className="h-5 w-5" />}
          title="No graph selected"
          message="Select a graph to explore hash-based node lookups."
          action={<Link to="/graphs" className="btn-primary">Open Graph Management</Link>}
        />
      </Card>
    );
  }

  const occupiedBuckets = result?.buckets.filter((bucket) => bucket.nodes.length > 0).length ?? 0;

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Hashing Explorer"
        subtitle="How does a graph find a node without scanning every entry? The adjacency list is a hash table: node id → neighbour map. Look up any node and see the O(1) average-time lookup in action."
        actions={<Badge tone="cyan">avg O(1) · worst O(n)</Badge>}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <SectionTitle>Look up a node</SectionTitle>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className="field pl-9"
                placeholder={`Search ${graph.nodes.length} nodes — e.g. ${graph.nodes[0]?.label ?? 'Node 1'}`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void search();
                }}
                list="hash-node-suggestions"
              />
              <datalist id="hash-node-suggestions">
                {suggestions.slice(0, 25).map((node) => (
                  <option key={node.id} value={node.label} />
                ))}
              </datalist>
            </div>
            <button className="btn-primary" onClick={() => void search()} disabled={busy || !query.trim()}>
              {busy ? <Spinner className="h-4 w-4" /> : <Search className="h-4 w-4" />}
              Search
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {graph.nodes.slice(0, 8).map((node) => (
              <button
                key={node.id}
                className="chip transition hover:border-cyan-400/40 hover:text-cyan-200"
                onClick={() => void search(node.label)}
              >
                {node.label}
              </button>
            ))}
            {graph.nodes.length > 8 && <span className="chip">+{graph.nodes.length - 8} more</span>}
          </div>

          {!result ? (
            <div className="mt-4">
              <EmptyState
                icon={<KeyRound className="h-4 w-4" />}
                title="No lookup performed"
                message="Search a node id. The backend measures the dict lookup and returns the neighbours, degree and metadata."
              />
            </div>
          ) : result.found ? (
            <div className="mt-4 animate-fade-up space-y-3">
              <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/5 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-medium text-emerald-200">
                    <KeyRound className="h-4 w-4" /> Key found: {result.node?.label}
                  </p>
                  <Badge tone="emerald">lookup {result.lookup_time_us.toFixed(2)} µs</Badge>
                </div>
                <p className="mt-1.5 text-[11px] text-emerald-200/70">
                  {result.lookup_type} — the hash of the node id maps straight to its neighbour dictionary.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Degree</p>
                  <p className="mt-1 text-xl font-semibold text-white">{result.degree}</p>
                </div>
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Neighbours</p>
                  <p className="mt-1 text-xl font-semibold text-white">{result.neighbor_count}</p>
                </div>
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Demo bucket</p>
                  <p className="mt-1 text-xl font-semibold text-white">#{result.bucket}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <p className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">Adjacency (value lookup)</p>
                  {Object.keys(result.neighbors).length === 0 ? (
                    <p className="text-xs text-slate-500">Isolated node — empty neighbour map.</p>
                  ) : (
                    <div className="space-y-1">
                      {Object.entries(result.neighbors).map(([neighbour, weight]) => (
                        <div key={neighbour} className="flex items-center justify-between rounded bg-white/[0.03] px-2 py-1 text-[11px]">
                          <span className="text-slate-300">{neighbour}</span>
                          <span className="font-mono text-cyan-300">{graph.weighted ? formatWeight(weight) : '—'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {result.directed && result.incoming.length > 0 && (
                    <p className="mt-2 text-[10px] text-slate-500">Incoming from: {result.incoming.join(', ')}</p>
                  )}
                </div>
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <p className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">Metadata</p>
                  {result.node && Object.keys(result.node.metadata).length > 0 ? (
                    <pre className="overflow-x-auto rounded bg-ink-950/60 p-2 font-mono text-[10px] text-slate-300">
                      {JSON.stringify(result.node.metadata, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-xs text-slate-500">No metadata stored for this node.</p>
                  )}
                  <p className="mt-2 font-mono text-[10px] text-slate-500">
                    demo_hash("{result.query}") = {result.demo_hash} → bucket {result.bucket}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-rose-400/25 bg-rose-500/5 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-rose-200">
                <TriangleAlert className="h-4 w-4" /> “{result.query}” is not a key in this graph
              </p>
              <p className="mt-1 text-[11px] text-rose-200/70">
                The dictionary lookup returned nothing after {result.lookup_time_us.toFixed(2)} µs. A miss is also O(1) on average —
                the hash function points to an empty bucket or a bucket without this key.
              </p>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <SectionTitle>Why hashing matters here</SectionTitle>
            <ul className="space-y-2.5 text-[11px] leading-relaxed text-slate-400">
              <li className="flex gap-2"><Boxes className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" />The adjacency list is a dict of dicts: <code className="text-slate-300">{'{ "A": { "B": 5 } }'}</code>.</li>
              <li className="flex gap-2"><Hash className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" />Python hashes the key, derives a bucket index, and compares keys inside that bucket.</li>
              <li className="flex gap-2"><Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />Edge existence and weight updates therefore avoid scanning all edges.</li>
              <li className="flex gap-2"><Timer className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />Average O(1); worst case O(n) if every key collides into one bucket.</li>
            </ul>
          </Card>

          <Card className="p-5">
            <SectionTitle>Bucket illustration</SectionTitle>
            {result ? (
              <>
                <div className="mb-2 flex items-center justify-between text-[10px] text-slate-500">
                  <span>8 demo buckets</span>
                  <span>{occupiedBuckets} occupied</span>
                </div>
                <div className="space-y-1.5">
                  {result.buckets.map((bucket) => (
                    <div
                      key={bucket.index}
                      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${
                        bucket.index === result.bucket
                          ? 'border-cyan-400/50 bg-cyan-500/10'
                          : 'border-white/[0.06] bg-white/[0.02]'
                      }`}
                    >
                      <span className="w-8 shrink-0 font-mono text-[10px] text-slate-500">#{bucket.index}</span>
                      <div className="flex flex-wrap gap-1">
                        {bucket.nodes.length === 0 ? (
                          <span className="text-[10px] text-slate-600">empty</span>
                        ) : (
                          bucket.nodes.map((node) => (
                            <span
                              key={node}
                              className={`rounded px-1.5 py-0.5 text-[10px] ${
                                node === result.query ? 'bg-cyan-400/20 text-cyan-100' : 'bg-white/5 text-slate-300'
                              }`}
                            >
                              {node}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                  Bucket index uses a deterministic djb2 hash mod 8, shown only for teaching. Python's built-in string hash is
                  randomised per process, so the real dict buckets are not displayed.
                </p>
              </>
            ) : (
              <p className="text-[11px] text-slate-500">Run a lookup to see how keys distribute across buckets.</p>
            )}
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Nodes in table" value={result?.node_count ?? graph.nodes.length} hint="keys in the adjacency dict" icon={<Boxes className="h-5 w-5" />} tone="purple" />
        <StatCard label="Edges in table" value={result?.edge_count ?? graph.edges.length} hint="entries in neighbour maps" icon={<Link2 className="h-5 w-5" />} tone="cyan" />
        <StatCard label="Average lookup" value="O(1)" hint="hash + bucket compare" icon={<Timer className="h-5 w-5" />} tone="emerald" />
        <StatCard label="Worst-case lookup" value="O(n)" hint="all keys in one bucket" icon={<TriangleAlert className="h-5 w-5" />} tone="amber" />
      </div>

      <Card className="p-5">
        <SectionTitle
          action={<Badge tone="amber"><Info className="h-3 w-3" /> academic note</Badge>}
        >
          Built-in dict vs a custom hash table
        </SectionTitle>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-3.5">
            <p className="flex items-center gap-2 text-xs font-medium text-cyan-200">
              <DollarSign className="h-3.5 w-3.5" /> What this project uses
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
              Python's built-in <code className="text-slate-300">dict</code>. It is a production hash table (open addressing with
              randomised hashing) implemented in CPython, not written by this project. We use it for the adjacency list because it
              gives average O(1) node/edge lookup.
            </p>
          </div>
          <div className="rounded-xl border border-violet-400/20 bg-violet-500/5 p-3.5">
            <p className="flex items-center gap-2 text-xs font-medium text-violet-200">
              <Hash className="h-3.5 w-3.5" /> What is demonstrated
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
              The bucketing panel above applies a small djb2 hash function and modulo indexing so collisions and bucket placement
              are visible. It is a teaching visualisation, not the storage engine of the application.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle>Full adjacency table</SectionTitle>
        {!result ? (
          <p className="text-[11px] text-slate-500">Search a node to load the adjacency table snapshot.</p>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-lg border border-white/[0.06]">
            <table className="table-base">
              <thead className="sticky top-0 bg-ink-850">
                <tr>
                  <th>Node (key)</th>
                  <th>Neighbours (value)</th>
                  <th>Degree</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(result.adjacency_table).map(([node, neighbours]) => (
                  <tr key={node} className={node === result.query ? 'bg-cyan-500/5' : ''}>
                    <td className="font-mono text-xs text-slate-200">{node}</td>
                    <td className="font-mono text-[11px] text-slate-400">
                      {Object.keys(neighbours).length
                        ? Object.entries(neighbours)
                            .map(([neighbour, weight]) => `${neighbour}:${formatWeight(weight)}`)
                            .join(', ')
                        : '∅'}
                    </td>
                    <td>{Object.keys(neighbours).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500">
          <TableProperties className="h-3 w-3" /> TableProperties: the full table is included with each lookup response for teaching
          purposes only.
        </p>
      </Card>
    </div>
  );
}
