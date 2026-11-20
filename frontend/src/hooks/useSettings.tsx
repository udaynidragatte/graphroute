import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface Preferences {
  animationSpeed: number;
  canvasHeight: number;
  showEdgeWeights: boolean;
  confirmDestructive: boolean;
}

const DEFAULTS: Preferences = {
  animationSpeed: 700,
  canvasHeight: 480,
  showEdgeWeights: true,
  confirmDestructive: true,
};

const STORAGE_KEY = 'graphroute.preferences';

interface SettingsContextValue {
  preferences: Preferences;
  update: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  reset: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function load(): Preferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Preferences>) };
  } catch {
    return DEFAULTS;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(load);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences]);

  const update = useCallback<SettingsContextValue['update']>((key, value) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  }, []);

  const reset = useCallback(() => {
    setPreferences(DEFAULTS);
  }, []);

  const value = useMemo(() => ({ preferences, update, reset }), [preferences, update, reset]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside SettingsProvider');
  return context;
}
