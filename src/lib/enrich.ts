import type { EnrichedInventar } from '@/types/enriched';
import type { Inventar, Kategorien, Lieferanten } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface InventarMaps {
  kategorienMap: Map<string, Kategorien>;
  lieferantenMap: Map<string, Lieferanten>;
}

export function enrichInventar(
  inventar: Inventar[],
  maps: InventarMaps
): EnrichedInventar[] {
  return inventar.map(r => ({
    ...r,
    kategorieName: resolveDisplay(r.fields.kategorie, maps.kategorienMap, 'kategoriename'),
    lieferantName: resolveDisplay(r.fields.lieferant, maps.lieferantenMap, 'firmenname'),
  }));
}
