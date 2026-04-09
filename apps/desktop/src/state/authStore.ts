export type LocalAppPreferenceState = {
  lastSelectedServerId: string | null;
  workspaceLayout: 'cards';
};

const LOCAL_PREFERENCE_STORAGE_KEY = 'openclaw.local.preferences';

const defaultPreferenceState: LocalAppPreferenceState = {
  lastSelectedServerId: null,
  workspaceLayout: 'cards',
};

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readLocalAppPreferences(): LocalAppPreferenceState {
  if (!canUseLocalStorage()) {
    return { ...defaultPreferenceState };
  }

  const raw = window.localStorage.getItem(LOCAL_PREFERENCE_STORAGE_KEY);
  if (!raw) {
    return { ...defaultPreferenceState };
  }

  try {
    return {
      ...defaultPreferenceState,
      ...(JSON.parse(raw) as Partial<LocalAppPreferenceState>),
    };
  } catch {
    window.localStorage.removeItem(LOCAL_PREFERENCE_STORAGE_KEY);
    return { ...defaultPreferenceState };
  }
}

export function writeLocalAppPreferences(partial: Partial<LocalAppPreferenceState>) {
  const next = {
    ...readLocalAppPreferences(),
    ...partial,
  };

  if (canUseLocalStorage()) {
    window.localStorage.setItem(LOCAL_PREFERENCE_STORAGE_KEY, JSON.stringify(next));
  }

  return next;
}
