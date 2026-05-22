import { describe, it, expect } from 'vitest';
import {
  levenshteinDistance,
  simpleMatch,
  fuzzyMatch,
  searchInFields,
  fuzzySearchWithScore
} from '../fuzzySearch';

describe('fuzzySearch utilities', () => {
  describe('levenshteinDistance', () => {
    it('should return 0 for identical strings', () => {
      expect(levenshteinDistance('hello', 'hello')).toBe(0);
    });

    it('should calculate distance for different strings', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    });

    it('should handle empty strings', () => {
      expect(levenshteinDistance('', 'hello')).toBe(5);
      expect(levenshteinDistance('hello', '')).toBe(5);
    });
  });

  describe('simpleMatch', () => {
    it('should match substrings case-insensitively', () => {
      expect(simpleMatch('Hello World', 'world')).toBe(true);
      expect(simpleMatch('Hello World', 'HELLO')).toBe(true);
    });

    it('should return false for non-matches', () => {
      expect(simpleMatch('Hello World', 'foo')).toBe(false);
    });
  });

  describe('fuzzyMatch', () => {
    it('should match exact substrings', () => {
      expect(fuzzyMatch('Motor Oil 5W30', 'motor')).toBe(true);
    });

    it('should match with typos within threshold', () => {
      // 'Motor' vs 'Moter' has distance of 1 (one substitution)
      expect(fuzzyMatch('Motor', 'Moter', 2)).toBe(true);
    });

    it('should not match beyond threshold', () => {
      expect(fuzzyMatch('Motor Oil', 'Xyz', 2)).toBe(false);
    });
  });

  describe('searchInFields', () => {
    const product = {
      id: '1',
      name: 'Motor Oil 5W30',
      sku: 'MO-5W30',
      category: 'Oil'
    };

    it('should search across multiple fields', () => {
      expect(searchInFields(product, 'motor', ['name', 'sku'])).toBe(true);
      expect(searchInFields(product, '5W30', ['name', 'sku'])).toBe(true);
    });

    it('should return false when no field matches', () => {
      expect(searchInFields(product, 'brake', ['name', 'sku'])).toBe(false);
    });

    it('should return true for empty query', () => {
      expect(searchInFields(product, '', ['name'])).toBe(true);
    });
  });

  describe('fuzzySearchWithScore', () => {
    const items = [
      { id: '1', name: 'Motor Oil 5W30' },
      { id: '2', name: 'Motor Oil 10W40' },
      { id: '3', name: 'Brake Fluid' },
    ];

    it('should score exact matches highest', () => {
      const results = fuzzySearchWithScore(items, 'Motor Oil 5W30', ['name']);
      expect(results[0].score).toBeGreaterThan(0); // Exact match should have positive score
      expect(results[0].id).toBe('1');
      expect(results[0].score).toBeGreaterThan(results[1]?.score || 0); // Should be highest
    });

    it('should filter out poor matches', () => {
      const results = fuzzySearchWithScore(items, 'Grease', ['name']);
      expect(results.length).toBeLessThan(items.length);
    });

    it('should return all items with score 0 for empty query', () => {
      const results = fuzzySearchWithScore(items, '', ['name']);
      expect(results.length).toBe(items.length);
      expect(results.every(r => r.score === 0)).toBe(true);
    });
  });
});
