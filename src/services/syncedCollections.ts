import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Memoria local de coletas ja sincronizadas, por (ponto, data/hora).
 * Funciona no iOS/PWA, onde nao e' possivel apagar o arquivo local:
 * evita reprocessar, reperguntar e reenviar coletas ja enviadas.
 * A chave e' a mesma da trava anti-duplicidade do banco: point_id + measured_at.
 */
const STORAGE_KEY = 'synced_collections';

function makeKey(pointId: number, measuredAt: string): string {
  return `${pointId}|${measuredAt}`;
}

async function readAll(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

/** Retorna true se a coleta (ponto + data/hora) ja foi sincronizada neste dispositivo. */
export async function isCollectionSynced(pointId: number, measuredAt: string): Promise<boolean> {
  const set = await readAll();
  return set.has(makeKey(pointId, measuredAt));
}

/** Marca a coleta como sincronizada. */
export async function markCollectionSynced(pointId: number, measuredAt: string): Promise<void> {
  try {
    const set = await readAll();
    set.add(makeKey(pointId, measuredAt));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // ignorar falha de armazenamento (a trava do servidor ainda protege o banco)
  }
}
