import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BookOpen, ChevronDown, Menu, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { ToastProvider } from './components/Toast';
import { GraphProvider, useGraph } from './hooks/useGraph';
import { SettingsProvider } from './hooks/useSettings';
import { getHealth } from './services/api';
import { apiError } from './services/api';
import { useToast } from './components/Toast';
import Dashboard from './pages/Dashboard';
import GraphVisualizer from './pages/GraphVisualizer';
import RouteFinder from './pages/RouteFinder';
import TraversalExplorer from './pages/TraversalExplorer';
import NetworkAnalysis from './pages/NetworkAnalysis';
import Benchmarks from './pages/Benchmarks';
import HashingExplorer from './pages/HashingExplorer';
import GraphManagement from './pages/GraphManagement';
import Settings from './pages/Settings';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Overview Dashboard',
  '/visualizer': 'Graph Visualizer',
  '/route-finder': 'Route Finder',
  '/traversal': 'Traversal Explorer',
  '/analysis': 'Network Analysis',
  '/benchmark': 'Algorithm Benchmark',
  '/hashing': 'Hashing Explorer',
  '/graphs': 'Graph Management',
  '/settings': 'Settings',
};

function Topbar({ onOpenMobile }: { onOpenMobile: () => void }) {
  const { graphs, graph, selectGraph, reload } = useGraph();
  const { error } = useToast();
  const location = useLocation();
  const [online, setOnline] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getHealth()
      .then(() => !cancelled && setOnline(true))
      .catch(() => !cancelled && setOnline(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await reload();
    } catch (err) {
      error(apiError(err));
    } finally {
      window.setTimeout(() => setRefreshing(false), 400);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-white/[0.06] bg-ink-900/80 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="rounded-lg border border-white/10 p-2 text-slate-300 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-200">
            {PAGE_TITLES[location.pathname] ?? 'GraphRoute'}
          </p>
          <p className="hidden truncate text-[11px] text-slate-500 sm:block">
            Graph-based route optimization &amp; network analysis
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative hidden sm:block">
          <select
            value={graph?.id ?? ''}
            onChange={(event) => selectGraph(Number(event.target.value))}
            className="field max-w-[240px] appearance-none py-1.5 pl-3 pr-8 text-xs"
            aria-label="Select active graph"
          >
            {graphs.length === 0 && <option value="">No graphs yet</option>}
            {graphs.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.node_count} nodes
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
        </div>

        <button onClick={refresh} className="btn-ghost !px-2.5 !py-1.5" title="Reload active graph">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>

        <span
          className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium sm:flex ${
            online === false
              ? 'border-rose-400/30 bg-rose-500/10 text-rose-300'
              : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300'
          }`}
        >
          {online === false ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
          {online === null ? 'Checking API' : online ? 'API online' : 'API offline'}
        </span>

        <Link
          to="/settings"
          className="btn-ghost !px-2.5 !py-1.5"
          title="API documentation is linked from Settings"
        >
          <BookOpen className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}

function Shell() {
  const [collapsed, setCollapsed] = useState(() => window.localStorage.getItem('graphroute.sidebar') === 'collapsed');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem('graphroute.sidebar', collapsed ? 'collapsed' : 'expanded');
  }, [collapsed]);

  return (
    <div className="min-h-screen">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className={`transition-all duration-300 ${collapsed ? 'lg:pl-[76px]' : 'lg:pl-[248px]'}`}>
        <Topbar onOpenMobile={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/visualizer" element={<GraphVisualizer />} />
            <Route path="/route-finder" element={<RouteFinder />} />
            <Route path="/traversal" element={<TraversalExplorer />} />
            <Route path="/analysis" element={<NetworkAnalysis />} />
            <Route path="/benchmark" element={<Benchmarks />} />
            <Route path="/hashing" element={<HashingExplorer />} />
            <Route path="/graphs" element={<GraphManagement />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <GraphProvider>
          <Shell />
        </GraphProvider>
      </ToastProvider>
    </SettingsProvider>
  );
}
