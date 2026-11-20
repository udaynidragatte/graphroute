import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getGraph, listGraphs } from '../services/api';
import type { GraphDetail, GraphSummary } from '../types';

interface GraphContextValue {
  graphs: GraphSummary[];
  graph: GraphDetail | null;
  loading: boolean;
  listLoading: boolean;
  error: string | null;
  selectGraph: (id: number) => void;
  refreshList: () => Promise<GraphSummary[]>;
  reload: () => Promise<void>;
  setGraph: (graph: GraphDetail) => void;
}

const GraphContext = createContext<GraphContextValue | null>(null);
const STORAGE_KEY = 'graphroute.currentGraphId';

export function GraphProvider({ children }: { children: ReactNode }) {
  const [graphs, setGraphs] = useState<GraphSummary[]>([]);
  const [graph, setGraphState] = useState<GraphDetail | null>(null);
  const [currentId, setCurrentId] = useState<number | null>(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? Number(stored) : null;
  });
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshList = useCallback(async () => {
    const items = await listGraphs();
    setGraphs(items);
    setListLoading(false);
    return items;
  }, []);

  const loadGraph = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const detail = await getGraph(id);
      setGraphState(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load graph');
      setGraphState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectGraph = useCallback(
    (id: number) => {
      setCurrentId(id);
      window.localStorage.setItem(STORAGE_KEY, String(id));
      void loadGraph(id);
    },
    [loadGraph],
  );

  const reload = useCallback(async () => {
    if (currentId == null) return;
    await loadGraph(currentId);
  }, [currentId, loadGraph]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const items = await refreshList();
        if (cancelled) return;
        const stored = window.localStorage.getItem(STORAGE_KEY);
        const preferred = stored ? Number(stored) : null;
        const chosen = items.find((item) => item.id === preferred) ?? items[0];
        if (chosen) {
          setCurrentId(chosen.id);
          window.localStorage.setItem(STORAGE_KEY, String(chosen.id));
          await loadGraph(chosen.id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not reach the backend');
        setLoading(false);
        setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setGraph = useCallback((next: GraphDetail) => {
    setGraphState(next);
    setGraphs((current) =>
      current.map((item) =>
        item.id === next.id
          ? {
              ...item,
              name: next.name,
              description: next.description,
              directed: next.directed,
              weighted: next.weighted,
              node_count: next.nodes.length,
              edge_count: next.edges.length,
              updated_at: next.updated_at,
            }
          : item,
      ),
    );
  }, []);

  const value = useMemo<GraphContextValue>(
    () => ({
      graphs,
      graph,
      loading,
      listLoading,
      error,
      selectGraph,
      refreshList,
      reload,
      setGraph,
    }),
    [graphs, graph, loading, listLoading, error, selectGraph, refreshList, reload, setGraph],
  );

  return <GraphContext.Provider value={value}>{children}</GraphContext.Provider>;
}

export function useGraph(): GraphContextValue {
  const context = useContext(GraphContext);
  if (!context) throw new Error('useGraph must be used inside GraphProvider');
  return context;
}
