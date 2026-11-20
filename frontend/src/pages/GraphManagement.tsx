import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpFromLine,
  Check,
  Copy,
  Database,
  Download,
  FolderOpen,
  Layers,
  Network,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import { Badge, Card, ConfirmDialog, EmptyState, Modal, PageHeader, SectionTitle, Spinner } from '../components/ui';
import { useToast } from '../components/Toast';
import { useGraph } from '../hooks/useGraph';
import {
  apiError,
  createGraph,
  deleteGraph,
  duplicateGraph,
  exportGraphText,
  importGraph,
  listSamples,
  loadSample,
  resetGraph,
  updateGraph,
} from '../services/api';
import { downloadFile, relativeTime } from '../lib/format';
import type { SampleInfo } from '../types';

export default function GraphManagement() {
  const { graphs, graph, refreshList, selectGraph, listLoading } = useGraph();
  const { success, error: toastError, info } = useToast();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [samples, setSamples] = useState<SampleInfo[]>([]);
  const [samplesLoading, setSamplesLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDirected, setNewDirected] = useState(false);
  const [newWeighted, setNewWeighted] = useState(true);

  const [renameTarget, setRenameTarget] = useState<{ id: number; name: string; description: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [resetTarget, setResetTarget] = useState<{ id: number; name: string } | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importName, setImportName] = useState('');
  const [importText, setImportText] = useState('');

  const refreshSamples = useCallback(async () => {
    setSamplesLoading(true);
    try {
      setSamples(await listSamples());
    } catch (err) {
      toastError(apiError(err));
    } finally {
      setSamplesLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    void refreshSamples();
  }, [refreshSamples]);

  const afterChange = async (selectId?: number) => {
    const items = await refreshList();
    await refreshSamples();
    if (selectId) selectGraph(selectId);
    else if (items.length > 0) selectGraph(items[0].id);
  };

  const submitCreate = async () => {
    if (!newName.trim()) {
      toastError('Give the graph a name');
      return;
    }
    setBusy(true);
    try {
      const created = await createGraph({
        name: newName.trim(),
        description: newDescription.trim(),
        directed: newDirected,
        weighted: newWeighted,
      });
      setCreateOpen(false);
      setNewName('');
      setNewDescription('');
      await afterChange(created.id);
      success(`Graph “${created.name}” created`);
    } catch (err) {
      toastError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const submitRename = async () => {
    if (!renameTarget) return;
    setBusy(true);
    try {
      const updated = await updateGraph(renameTarget.id, {
        name: renameTarget.name.trim(),
        description: renameTarget.description,
      });
      await afterChange(updated.id);
      setRenameTarget(null);
      success('Graph updated');
    } catch (err) {
      toastError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteGraph(deleteTarget.id);
      setDeleteTarget(null);
      await afterChange();
      success('Graph deleted');
    } catch (err) {
      toastError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmReset = async () => {
    if (!resetTarget) return;
    setBusy(true);
    try {
      const cleared = await resetGraph(resetTarget.id);
      await afterChange(cleared.id);
      setResetTarget(null);
      success(`“${cleared.name}” cleared`);
    } catch (err) {
      toastError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async (id: number) => {
    setBusy(true);
    try {
      const clone = await duplicateGraph(id);
      await afterChange(clone.id);
      success(`Duplicated as “${clone.name}”`);
    } catch (err) {
      toastError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const exportOne = async (id: number, name: string) => {
    try {
      const data = await exportGraphText(id);
      downloadFile(`${name.replace(/\s+/g, '-').toLowerCase()}.json`, JSON.stringify(data, null, 2));
      success('Export downloaded');
    } catch (err) {
      toastError(apiError(err));
    }
  };

  const openSample = async (key: string) => {
    setBusy(true);
    try {
      const loaded = await loadSample(key);
      await afterChange(loaded.id);
      success(`Sample “${loaded.name}” loaded with ${loaded.node_count} nodes`);
    } catch (err) {
      toastError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const submitImport = async () => {
    setBusy(true);
    try {
      const parsed = JSON.parse(importText) as Record<string, unknown>;
      const payload = {
        name: importName.trim() || `Imported ${new Date().toLocaleTimeString()}`,
        description: typeof parsed.description === 'string' ? parsed.description : 'Imported from JSON',
        directed: Boolean(parsed.directed),
        weighted: parsed.weighted === undefined ? true : Boolean(parsed.weighted),
        nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
        edges: Array.isArray(parsed.edges) ? parsed.edges : [],
      };
      if (payload.nodes.length === 0) {
        throw new Error('The JSON must contain a non-empty "nodes" array');
      }
      const created = await importGraph(payload);
      await afterChange(created.id);
      setImportOpen(false);
      setImportText('');
      setImportName('');
      success('Graph imported');
    } catch (err) {
      const message = err instanceof SyntaxError ? 'That is not valid JSON' : err instanceof Error ? err.message : 'Import failed';
      toastError(err instanceof SyntaxError || err instanceof Error ? message : apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      setImportText(text);
      if (!importName) setImportName(file.name.replace(/\.json$/i, ''));
      info(`Loaded ${file.name} into the editor`);
    } catch {
      toastError('Could not read that file');
    }
  };

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Graph Management"
        subtitle="Create, rename, duplicate, export and delete stored graphs. All graphs live in SQLite; the three sample networks plus an empty custom graph are seeded on first run."
        actions={
          <>
            <button className="btn-ghost" onClick={() => void afterChange(graph?.id)} disabled={busy}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button className="btn-ghost" onClick={() => setImportOpen(true)}>
              <ArrowUpFromLine className="h-4 w-4" /> Import JSON
            </button>
            <button className="btn-primary" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New graph
            </button>
          </>
        }
      />

      <Card className="p-5">
        <SectionTitle
          action={
            samplesLoading ? <Spinner className="h-4 w-4 text-violet-300" /> : <Badge tone="violet">{samples.length} samples</Badge>
          }
        >
          Sample networks
        </SectionTitle>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {samples.map((sample) => (
            <div key={sample.key} className="flex flex-col rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-100">{sample.name}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{sample.description}</p>
                </div>
                <Layers className="h-4 w-4 shrink-0 text-violet-300" />
              </div>
              <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500">
                <span>{sample.node_count} nodes</span>
                <span>·</span>
                <span>{sample.edge_count} edges</span>
                <span>·</span>
                <span>{sample.directed ? 'directed' : 'undirected'}</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] text-slate-600">Distances/latencies are demo data</span>
                <button className="btn-ghost !px-2.5 !py-1 !text-[11px]" onClick={() => void openSample(sample.key)} disabled={busy}>
                  {sample.already_loaded ? 'Load again' : 'Load'}
                </button>
              </div>
            </div>
          ))}
          {samples.length === 0 && !samplesLoading && (
            <p className="text-xs text-slate-500">Samples are unavailable — is the backend running?</p>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <SectionTitle>Stored graphs ({graphs.length})</SectionTitle>
          <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <Database className="h-3 w-3" /> SQLite · graphs / nodes / edges
          </span>
        </div>
        {listLoading ? (
          <div className="flex justify-center p-10"><Spinner className="h-6 w-6 text-violet-400" /></div>
        ) : graphs.length === 0 ? (
          <EmptyState
            icon={<Network className="h-5 w-5" />}
            title="No graphs stored"
            message="Create a new graph or load a sample network to get started."
            action={<button className="btn-primary" onClick={() => setCreateOpen(true)}>Create graph</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[840px]">
              <thead>
                <tr>
                  <th>Graph</th>
                  <th>Type</th>
                  <th>Nodes</th>
                  <th>Edges</th>
                  <th>Updated</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {graphs.map((item) => (
                  <tr key={item.id} className={item.id === graph?.id ? 'bg-violet-500/[0.06]' : ''}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-100">{item.name}</span>
                        {item.id === graph?.id && <Badge tone="violet"><Check className="h-3 w-3" /> active</Badge>}
                      </div>
                      <p className="max-w-md truncate text-[10px] text-slate-500">{item.description || 'No description'}</p>
                    </td>
                    <td className="text-[11px] text-slate-400">
                      {item.directed ? 'Directed' : 'Undirected'} · {item.weighted ? 'weighted' : 'unweighted'}
                    </td>
                    <td>{item.node_count}</td>
                    <td>{item.edge_count}</td>
                    <td className="text-[11px] text-slate-500">{relativeTime(item.updated_at)}</td>
                    <td>
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <button
                          className="btn-ghost !px-2 !py-1 !text-[11px]"
                          onClick={() => {
                            selectGraph(item.id);
                            navigate('/visualizer');
                          }}
                        >
                          <FolderOpen className="h-3 w-3" /> Open
                        </button>
                        <button
                          className="btn-ghost !px-2 !py-1 !text-[11px]"
                          onClick={() => setRenameTarget({ id: item.id, name: item.name, description: item.description })}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button className="btn-ghost !px-2 !py-1 !text-[11px]" onClick={() => void duplicate(item.id)} disabled={busy} title="Duplicate">
                          <Copy className="h-3 w-3" />
                        </button>
                        <button className="btn-ghost !px-2 !py-1 !text-[11px]" onClick={() => void exportOne(item.id, item.name)} title="Export JSON">
                          <Download className="h-3 w-3" />
                        </button>
                        <button className="btn-ghost !px-2 !py-1 !text-[11px]" onClick={() => setResetTarget({ id: item.id, name: item.name })} title="Clear nodes & edges">
                          <RotateCcw className="h-3 w-3" />
                        </button>
                        <button className="btn-danger !px-2 !py-1 !text-[11px]" onClick={() => setDeleteTarget({ id: item.id, name: item.name })} title="Delete graph">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={createOpen}
        title="Create graph"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={() => void submitCreate()} disabled={busy}>
              <Plus className="h-4 w-4" /> Create
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="new-graph-name">Name</label>
            <input id="new-graph-name" className="field" value={newName} maxLength={120} onChange={(event) => setNewName(event.target.value)} placeholder="My Network" autoFocus />
          </div>
          <div>
            <label className="label" htmlFor="new-graph-description">Description</label>
            <textarea id="new-graph-description" className="field h-20" value={newDescription} onChange={(event) => setNewDescription(event.target.value)} placeholder="What does this network model?" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setNewDirected((value) => !value)}
              className={`rounded-lg border px-3 py-2 text-xs ${newDirected ? 'border-blue-400/40 bg-blue-500/10 text-blue-200' : 'border-white/10 text-slate-400'}`}
            >
              {newDirected ? 'Directed' : 'Undirected'}
            </button>
            <button
              onClick={() => setNewWeighted((value) => !value)}
              className={`rounded-lg border px-3 py-2 text-xs ${newWeighted ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200' : 'border-white/10 text-slate-400'}`}
            >
              {newWeighted ? 'Weighted' : 'Unweighted'}
            </button>
          </div>
          <p className="text-[11px] text-slate-500">The new graph starts empty. Add nodes in the visualizer.</p>
        </div>
      </Modal>

      <Modal
        open={renameTarget !== null}
        title="Rename graph"
        onClose={() => setRenameTarget(null)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setRenameTarget(null)}>Cancel</button>
            <button className="btn-primary" onClick={() => void submitRename()} disabled={busy}>Save</button>
          </>
        }
      >
        {renameTarget && (
          <div className="space-y-3">
            <div>
              <label className="label" htmlFor="rename-input">Name</label>
              <input id="rename-input" className="field" value={renameTarget.name} onChange={(event) => setRenameTarget({ ...renameTarget, name: event.target.value })} autoFocus />
            </div>
            <div>
              <label className="label" htmlFor="rename-description">Description</label>
              <textarea id="rename-description" className="field h-24" value={renameTarget.description} onChange={(event) => setRenameTarget({ ...renameTarget, description: event.target.value })} />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={importOpen}
        title="Import graph from JSON"
        width="max-w-2xl"
        onClose={() => setImportOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setImportOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={() => void submitImport()} disabled={busy || !importText.trim()}>
              <Upload className="h-4 w-4" /> Import as new graph
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="import-name">Graph name</label>
              <input id="import-name" className="field" value={importName} onChange={(event) => setImportName(event.target.value)} placeholder="Imported graph" />
            </div>
            <div className="flex items-end">
              <button className="btn-ghost w-full" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" /> Choose .json file
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => void onFile(event.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <textarea
            className="field h-64 font-mono text-xs"
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder={'{\n  "directed": false,\n  "weighted": true,\n  "nodes": [{"label": "A", "x_position": 100, "y_position": 100}],\n  "edges": [{"source_node": "A", "target_node": "B", "weight": 4}]\n}'}
          />
          <p className="text-[11px] text-slate-500">
            A new graph is created, so existing graphs are untouched. Node labels must be unique and edge endpoints must exist.
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete graph?"
        message={`“${deleteTarget?.name ?? ''}” and all its nodes and edges will be permanently removed from the database. This cannot be undone.`}
        confirmLabel="Delete graph"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />

      <ConfirmDialog
        open={resetTarget !== null}
        title="Clear nodes and edges?"
        message={`“${resetTarget?.name ?? ''}” keeps its name and settings but loses every node and edge. Export first if you need a backup.`}
        confirmLabel="Clear graph"
        danger
        onCancel={() => setResetTarget(null)}
        onConfirm={() => void confirmReset()}
      />
    </div>
  );
}
