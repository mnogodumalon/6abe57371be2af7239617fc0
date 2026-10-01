import type { Inventar } from './app';

export type EnrichedInventar = Inventar & {
  kategorieName: string;
  lieferantName: string;
};
