/**
 * Deterministic pseudo-random utilities for CAPFLUX sandbox seeding.
 *
 * mulberry32 — small, fast, fully deterministic PRNG. Given the same seed,
 * the same call sequence always yields the same values, so resetting the
 * sandbox reproduces byte-identical demo content (names, amounts, dates).
 */

export interface DeterministicRandom {
  next(): number;
  int(minInclusive: number, maxInclusive: number): number;
  pick<T>(items: readonly T[]): T;
  chance(probability: number): boolean;
  shuffle<T>(items: readonly T[]): T[];
}

export function createDeterministicRandom(seed: number): DeterministicRandom {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(minInclusive, maxInclusive) {
      return minInclusive + Math.floor(next() * (maxInclusive - minInclusive + 1));
    },
    pick<T>(items: readonly T[]): T {
      const index = Math.floor(next() * items.length);
      const item = items[index];
      if (item === undefined) {
        throw new Error(`Deterministic pick out of range for ${items.length} items`);
      }
      return item;
    },
    chance(probability) {
      return next() < probability;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = copy[i]!;
        copy[i] = copy[j]!;
        copy[j] = tmp;
      }
      return copy;
    },
  };
}

/** Stable FNV-1a hash for content-addressed demo ids. */
export function stableHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
