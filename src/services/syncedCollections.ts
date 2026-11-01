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

// =====================================================================
// COLETAS IGNORADAS — separado das sincronizadas, de propósito
// ---------------------------------------------------------------------
// "Ignorada" e "já enviada" são coisas diferentes e estavam na mesma lista.
// Consequência: uma coleta ignorada por engano sumia para sempre naquele
// aparelho, sem aviso e sem volta, e o app dizia "tudo sincronizado" — o que
// era falso. Pior tipo de erro: o que se apresenta como sucesso.
//
// Com listas separadas, o app consegue dizer "X ignoradas por você" e oferecer
// restaurar.
// =====================================================================
const IGNORED_KEY = 'ignored_collections';

async function readIgnored(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(IGNORED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export async function isCollectionIgnored(pointId: number, measuredAt: string): Promise<boolean> {
  const set = await readIgnored();
  return set.has(makeKey(pointId, measuredAt));
}

export async function markCollectionIgnored(pointId: number, measuredAt: string): Promise<void> {
  try {
    const set = await readIgnored();
    set.add(makeKey(pointId, measuredAt));
    await AsyncStorage.setItem(IGNORED_KEY, JSON.stringify([...set]));
  } catch {
    /* ignorar falha de armazenamento */
  }
}

/** Quantas coletas foram ignoradas neste aparelho. */
export async function countIgnored(): Promise<number> {
  return (await readIgnored()).size;
}

/** Desfaz TODAS as ignorâncias: elas voltam a aparecer na próxima importação. */
export async function clearIgnored(): Promise<void> {
  try {
    await AsyncStorage.removeItem(IGNORED_KEY);
  } catch {
    /* ignorar */
  }
}
