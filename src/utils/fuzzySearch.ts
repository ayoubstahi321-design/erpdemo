/**
 * Fuzzy Search Utilities
 *
 * Implements Levenshtein distance and fuzzy matching for product/customer search.
 * Provides multiple matching strategies optimized for performance.
 */

/**
 * Calculate Levenshtein distance between two strings
 * @param s1 First string
 * @param s2 Second string
 * @returns Levenshtein distance (number of edits)
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;

  // Create a 2D array for dynamic programming
  const dp: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= len1; i++) dp[i][0] = i;
  for (let j = 0; j <= len2; j++) dp[0][j] = j;

  // Fill the DP table
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],    // deletion
          dp[i][j - 1],    // insertion
          dp[i - 1][j - 1] // substitution
        );
      }
    }
  }

  return dp[len1][len2];
}

/**
 * Simple substring match (case-insensitive)
 * @param text Text to search in
 * @param query Search query
 * @returns True if query is found in text
 */
export function simpleMatch(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

/**
 * Fuzzy match with Levenshtein distance threshold
 * @param text Text to search in
 * @param query Search query
 * @param threshold Maximum distance allowed (default: 2)
 * @returns True if fuzzy match found
 */
export function fuzzyMatch(text: string, query: string, threshold: number = 2): boolean {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // First try simple substring match (fastest)
  if (simpleMatch(text, query)) {
    return true;
  }

  // Try fuzzy matching with sliding window
  for (let i = 0; i <= lowerText.length - lowerQuery.length; i++) {
    const substring = lowerText.substring(i, i + lowerQuery.length);
    if (levenshteinDistance(substring, lowerQuery) <= threshold) {
      return true;
    }
  }

  return false;
}

/**
 * Search in multiple fields with boolean result
 * @param item Single item to search
 * @param query Search query
 * @param fields Fields to search in
 * @returns True if any field matches
 */
export function searchInFields<T extends Record<string, any>>(
  item: T,
  query: string,
  fields: string[]
): boolean {
  if (!query.trim()) return true; // Empty query matches everything

  const queryLower = query.toLowerCase();

  for (const field of fields) {
    const value = String(item[field] || '').toLowerCase();

    // Check for exact match
    if (value === queryLower) return true;
    // Check for substring match
    if (value.includes(queryLower)) return true;
    // Check for fuzzy match
    if (fuzzyMatch(value, query, 2)) return true;
  }

  return false;
}

/**
 * Fuzzy search with scoring (optimized for performance)
 * @param items Array of items to search
 * @param query Search query
 * @param fields Fields to search in
 * @returns Array of items with scores, filtered by relevance
 */
export function fuzzySearchWithScore<T extends Record<string, any>>(
  items: T[],
  query: string,
  fields: (keyof T)[]
): Array<T & { score: number }> {
  if (!query.trim()) {
    // Empty query returns all items with score 0
    return items.map(item => ({ ...item, score: 0 }));
  }

  const queryLower = query.toLowerCase();
  const results = items
    .map((item) => {
      let score = 0;

      for (const field of fields) {
        const value = String(item[field] || '').toLowerCase();

        // Exact match: highest score
        if (value === queryLower) {
          score += 100;
        }
        // Starts with: high score
        else if (value.startsWith(queryLower)) {
          score += 50;
        }
        // Contains: medium score
        else if (value.includes(queryLower)) {
          score += 30;
        }
        // Fuzzy match: lower score
        else if (fuzzyMatch(value, query, 2)) {
          score += 10;
        }
      }

      return { ...item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return results;
}

/**
 * Create a memoized fuzzy search function
 * @param items Array of items
 * @param fields Fields to search
 * @returns Memoized search function
 */
export function createMemoizedSearch<T extends Record<string, any>>(
  items: T[],
  fields: (keyof T)[]
) {
  const cache = new Map<string, T[]>();

  return (query: string): T[] => {
    if (cache.has(query)) {
      return cache.get(query) || [];
    }

    const results = fuzzySearchWithScore(items, query, fields);
    cache.set(query, results);

    return results;
  };
}
