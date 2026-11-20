import { NavLink } from 'react-router-dom';
import {
  Activity,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Database,
  GitBranch,
  Hash,
  LayoutDashboard,
  Network,
  Route,
  Settings,
  Timer,
  Workflow,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const PRIMARY: NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/visualizer', label: 'Graph Visualizer', icon: Workflow },
  { to: '/route-finder', label: 'Route Finder', icon: Route },
  { to: '/traversal', label: 'Traversal Explorer', icon: GitBranch },
  { to: '/analysis', label: 'Network Analysis', icon: Network },
];

const TOOLS: NavItem[] = [
  { to: '/benchmark', label: 'Algorithm Benchmark', icon: Timer },
  { to: '/hashing', label: 'Hashing Explorer', icon: Hash },
  { to: '/graphs', label: 'Graph Management', icon: Database },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function NavSection({
  title,
  items,
  collapsed,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  collapsed: boolean;
  onNavigate: () => void;
}) {
  return (
    <div className="mb-5">
      {!collapsed && (
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
      )}
      <nav className="space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-violet-500/20 to-blue-500/10 text-white'
                  : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100'
              } ${collapsed ? 'justify-center' : ''}`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-gradient-to-b from-violet-400 to-cyan-400" />
                )}
                <item.icon
                  className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-violet-300' : 'text-slate-500 group-hover:text-slate-300'}`}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onCloseMobile} />
      )}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-full flex-col border-r border-white/[0.06] bg-ink-900/95 backdrop-blur-xl transition-all duration-300 lg:translate-x-0 ${
          collapsed ? 'w-[76px]' : 'w-[248px]'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className={`flex h-16 items-center border-b border-white/[0.06] ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 shadow-glow">
              <Activity className="h-5 w-5 text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-tight text-white">GraphRoute</p>
                <p className="truncate text-[10px] uppercase tracking-[0.16em] text-slate-500">DSA Lab Project</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <button onClick={onCloseMobile} className="rounded-lg p-1 text-slate-400 hover:bg-white/5 lg:hidden">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2.5 py-4">
          <NavSection title="Workspace" items={PRIMARY} collapsed={collapsed} onNavigate={onCloseMobile} />
          <NavSection title="Tools & Data" items={TOOLS} collapsed={collapsed} onNavigate={onCloseMobile} />
        </div>

        <div className="border-t border-white/[0.06] p-3">
          {!collapsed && (
            <div className="mb-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="flex items-center gap-2 text-[11px] font-medium text-slate-300">
                <ArrowLeftRight className="h-3.5 w-3.5 text-cyan-400" />
                Adjacency list graph
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                Weighted · directed switchable · O(1) dict lookups
              </p>
            </div>
          )}
          <button
            onClick={onToggle}
            className="hidden w-full items-center justify-center gap-2 rounded-lg border border-white/[0.07] py-2 text-xs text-slate-400 transition hover:bg-white/5 hover:text-white lg:flex"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!collapsed && 'Collapse'}
          </button>
        </div>
      </aside>
    </>
  );
}
