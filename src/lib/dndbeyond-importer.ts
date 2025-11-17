/**
 * D&D Beyond Character Importer
 *
 * Imports character data from PUBLIC D&D Beyond character sheets.
 * Only works with characters that have been made publicly shareable.
 *
 * Similar to FoundryVTT's D&D Importer.
 *
 * Uses Crawl4AI (Python) via subprocess to handle JavaScript-rendered content.
 */

import { spawn } from 'child_process';
import path from 'path';

export interface DndBeyondCharacterData {
  characterName: string;
  playerName?: string;
  race: string;
  class: string;
  level: number;
  imageUrl?: string;
  backstory?: string;
  abilityScores: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  skills: Record<string, number>;
  proficiencyBonus: number;
  armorClass: number;
  hitPoints: {
    current: number;
    max: number;
    temp: number;
  };
  speed: string;
  features: Array<{
    name: string;
    description: string;
  }>;
  equipment: string[];
}

/**
 * Validates if a URL is a public D&D Beyond character URL
 */
export function isValidDndBeyondUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'www.dndbeyond.com' ||
      parsed.hostname === 'dndbeyond.com'
    ) && parsed.pathname.startsWith('/characters/');
  } catch {
    return false;
  }
}

/**
 * Fetches and parses a public D&D Beyond character sheet using Crawl4AI
 */
export async function importFromDndBeyond(url: string): Promise<DndBeyondCharacterData> {
  if (!isValidDndBeyondUrl(url)) {
    throw new Error('Invalid D&D Beyond character URL');
  }

  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'crawl_dndbeyond.py');
    const python = spawn('python', [scriptPath, url]);

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        console.error('Python script error:', stderr);
        reject(new Error(stderr || 'Failed to scrape character from D&D Beyond'));
        return;
      }

      try {
        const result = JSON.parse(stdout);

        if (result.error) {
          reject(new Error(result.error));
          return;
        }

        // Validate required fields
        if (!result.characterName || result.characterName === 'Unknown Character') {
          reject(new Error('Character not found or not public. Make sure the character is set to public.'));
          return;
        }

        resolve(result as DndBeyondCharacterData);
      } catch (error) {
        console.error('Failed to parse Python output:', stdout);
        reject(new Error('Failed to parse character data from scraper'));
      }
    });

    python.on('error', (error) => {
      reject(new Error(`Failed to run Python script: ${error.message}. Make sure Python and crawl4ai are installed.`));
    });
  });
}

