import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Cpu,
  Database,
  ExternalLink,
  Gauge,
  Github,
  Info,
  RotateCcw,
  Server,
  Sliders,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Badge, Card, ConfirmDialog, PageHeader, SectionTitle, Spinner, Toggle } from '../components/ui';
import { useSettings } from '../hooks/useSettings';
import { useToast } from '../components/Toast';
import { apiError, getHealth } from '../services/api';
import type { HealthStatus } from '../types';

export default function Settings() {
  const { preferences, update, reset } = useSettings();
  const { success, error: toastError } = useToast();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const checkHealth = async () => {
    setChecking(true);
    setHealthError(null);
    try {
      setHealth(await getHealth());
      success('Backend reachable');
    } catch (err) {
      setHealth(null);
      setHealthError(apiError(err));
      toastError(apiError(err));
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch((err) => setHealthError(apiError(err)));
  }, []);

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Settings"
        subtitle="Preferences are stored in your browser (localStorage). Nothing here is required for the algorithms — they run entirely on the backend."
        actions={
          <button className="btn-ghost" onClick={() => void checkHealth()} disabled={checking}>
            {checking ? <Spinner className="h-4 w-4" /> : <Wifi className="h-4 w-4" />} Test connection
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <SectionTitle>Visualisation preferences</SectionTitle>
          <div className="space-y-3">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium text-slate-200">
                    <Gauge className="h-4 w-4 text-violet-300" /> Traversal animation speed
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">Delay between automatic traversal steps.</p>
                </div>
                <span className="font-mono text-xs text-slate-300">{preferences.animationSpeed} ms</span>
              </div>
              <input
                type="range"
                min={150}
                max={2000}
                step={50}
                value={2150 - preferences.animationSpeed}
                onChange={(event) => update('animationSpeed', 2150 - Number(event.target.value))}
                className="mt-3 w-full accent-violet-500"
              />
            </div>

            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium text-slate-200">
                    <Sliders className="h-4 w-4 text-cyan-300" /> Canvas height
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">Height of graph canvases on the visualizer and traversal pages.</p>
                </div>
                <span className="font-mono text-xs text-slate-300">{preferences.canvasHeight} px</span>
              </div>
              <input
                type="range"
                min={320}
                max={760}
                step={20}
                value={preferences.canvasHeight}
                onChange={(event) => update('canvasHeight', Number(event.target.value))}
                className="mt-3 w-full accent-cyan-500"
              />
            </div>

            <Toggle
              checked={preferences.showEdgeWeights}
              onChange={(value) => update('showEdgeWeights', value)}
              label="Show edge weights"
              hint="Display weight labels on canvas edges by default (the visualizer toolbar can still override)."
            />
            <Toggle
              checked={preferences.confirmDestructive}
              onChange={(value) => update('confirmDestructive', value)}
              label="Confirmation for destructive actions"
              hint="Delete and clear actions always ask first in this build; this records your preference for clarity."
            />
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
            <p className="text-xs text-slate-400">Restore all preferences to their defaults.</p>
            <button className="btn-ghost !py-1.5 !text-xs" onClick={() => setResetOpen(true)}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <SectionTitle>Backend status</SectionTitle>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">State</span>
                {health ? (
                  <Badge tone="emerald"><Wifi className="h-3 w-3" /> online</Badge>
                ) : healthError ? (
                  <Badge tone="rose"><WifiOff className="h-3 w-3" /> offline</Badge>
                ) : (
                  <Spinner className="h-3.5 w-3.5 text-slate-400" />
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Version</span>
                <span className="text-slate-200">{health?.version ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Graphs stored</span>
                <span className="text-slate-200">{health?.graphs ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Nodes stored</span>
                <span className="text-slate-200">{health?.nodes ?? '—'}</span>
              </div>
              {healthError && <p className="rounded-lg border border-rose-400/20 bg-rose-500/5 p-2 text-[11px] text-rose-200">{healthError}</p>}
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 font-mono text-[10px] leading-relaxed text-slate-500">
                API: http://127.0.0.1:8000<br />
                Docs: /docs · Frontend proxy: /api
              </div>
              <div className="flex gap-2">
                <a href="http://127.0.0.1:8000/docs" target="_blank" rel="noreferrer" className="btn-ghost flex-1 !py-1.5 !text-[11px]">
                  <BookOpen className="h-3.5 w-3.5" /> API docs <ExternalLink className="h-3 w-3" />
                </a>
                <Link to="/graphs" className="btn-ghost flex-1 !py-1.5 !text-[11px]">
                  <Database className="h-3.5 w-3.5" /> Graphs
                </Link>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle>About</SectionTitle>
            <div className="space-y-2.5 text-[11px] leading-relaxed text-slate-400">
              <p className="flex items-center gap-2 text-xs font-medium text-slate-200">
                <Cpu className="h-4 w-4 text-violet-300" /> GraphRoute · v1.0.0
              </p>
              <p>DSA semester project: adjacency-list graphs, BFS, DFS, Dijkstra, Bellman-Ford, network analysis and benchmarking.</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="chip">React + Vite</span>
                <span className="chip">TypeScript</span>
                <span className="chip">Tailwind</span>
                <span className="chip">React Flow</span>
                <span className="chip">Recharts</span>
                <span className="chip">FastAPI</span>
                <span className="chip">SQLAlchemy</span>
                <span className="chip">SQLite</span>
              </div>
              <p className="flex items-start gap-2 pt-1 text-[10px] text-slate-500">
                <Server className="mt-0.5 h-3 w-3 shrink-0" />
                Algorithms are implemented by hand in Python (no NetworkX dependency). Sample distances and latencies are demo data.
              </p>
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle>Academic notes</SectionTitle>
            <div className="space-y-2 text-[11px] leading-relaxed text-slate-400">
              <p className="flex gap-2"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" />Adjacency list = dict of dicts. Node lookup is O(1) average via Python's built-in hash table.</p>
              <p className="flex gap-2"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" />All algorithm results are computed live from the stored graph; no hardcoded paths.</p>
              <p className="flex gap-2"><Github className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />See README.md for architecture, complexity tables and viva notes.</p>
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={resetOpen}
        title="Restore default preferences?"
        message="Animation speed, canvas height and display toggles return to their defaults. Your graphs and saved data are not affected."
        confirmLabel="Restore defaults"
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          reset();
          setResetOpen(false);
          success('Preferences restored');
        }}
      />
    </div>
  );
}
