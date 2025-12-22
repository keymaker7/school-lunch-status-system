
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export type LunchStatus = 'WAITING' | 'GO' | 'EATING' | 'DINING' | 'FINISHED';

export interface ClassData {
  id: string;
  grade: number;
  classNum: number;
  status: LunchStatus;
}

export interface SchoolConfig {
  gradeCounts: { [key: number]: number };
}

// Fix: Add missing types and constants required by the Comic Creator components (Book, Panel, Setup)

/**
 * Represents a person or character in the comic, including their image data.
 */
export interface Persona {
  base64: string;
}

/**
 * Represents a single panel or "face" of a page in the comic book.
 */
export interface ComicFace {
  pageIndex?: number;
  type: 'cover' | 'story' | 'back_cover';
  imageUrl?: string;
  isLoading?: boolean;
  isDecisionPage?: boolean;
  choices: string[];
  resolvedChoice?: string;
}

/**
 * Total number of story pages in a comic issue.
 */
export const TOTAL_PAGES = 8;

/**
 * Number of initial pages that must be ready before the comic can be opened.
 */
export const INITIAL_PAGES = 4;

/**
 * The specific page index that acts as a gatekeeper for opening the book.
 */
export const GATE_PAGE = 1;

/**
 * Available story genres for comic generation.
 */
export const GENRES = [
  'Superhero',
  'Sci-Fi',
  'Fantasy',
  'Noir',
  'Comedy',
  'Cyberpunk',
  'Custom'
];

/**
 * Supported languages for comic dialogue and narration.
 */
export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'ko', name: 'Korean' },
  { code: 'ja', name: 'Japanese' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' }
];
