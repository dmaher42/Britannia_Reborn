const STORAGE_KEY = 'britannia_reborn_save';

const hasLocalStorage = () => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch (error) {
    return false;
  }
};

const createMemoryStorage = () => {
  const map = new Map();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
};

const getStorage = () => (hasLocalStorage() ? window.localStorage : createMemoryStorage());

export class SaveManager {
  constructor(storageKey = STORAGE_KEY, storage = getStorage()) {
    this.storageKey = storageKey;
    this.storage = storage;
  }

  save(data) {
    if (!data) return false;
    const payload = {
      ...data,
      timestamp: Date.now(),
    };
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(payload));
      return true;
    } catch (error) {
      console.error('Failed to save game', error);
      return false;
    }
  }

  load() {
    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      console.error('Failed to load game', error);
      return null;
    }
  }

  clear() {
    try {
      this.storage.removeItem(this.storageKey);
    } catch (error) {
      console.error('Failed to clear save data', error);
    }
  }
}

export const buildSaveData = ({ character, player, map, inventory }) => ({
  character: character?.toJSON?.() ?? null,
  player: player?.toJSON?.() ?? null,
  world: map?.toJSON?.() ?? null,
  inventory: inventory?.toJSON?.() ?? [],
  inventoryGold: inventory?.gold ?? 0,
  timestamp: Date.now(),
});

