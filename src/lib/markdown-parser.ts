/**
 * Markdown Parser for D&D Content Extraction
 *
 * Parses Marker-generated markdown to identify and extract:
 * - Spells
 * - Items (magic items, equipment)
 * - Monsters/Creatures
 * - Class features
 * - Feats
 * - Other homebrew content
 *
 * This provides structured sections that can then be processed by Ollama
 * to extract specific D&D attributes (stats, damage dice, ranges, etc.)
 */

export interface MarkdownSection {
  type: 'spell' | 'item' | 'monster' | 'class_feature' | 'feat' | 'race' | 'background' | 'unknown';
  title: string;
  content: string;
  level?: number; // Header level (1-6)
  startLine: number;
  endLine: number;
  subsections?: MarkdownSection[];
}

export interface ParsedMarkdown {
  sections: MarkdownSection[];
  metadata: {
    totalSections: number;
    spellCount: number;
    itemCount: number;
    monsterCount: number;
    classFeatureCount: number;
    featCount: number;
    unknownCount: number;
  };
}

/**
 * Parse markdown content into structured sections
 */
export function parseMarkdown(markdown: string): ParsedMarkdown {
  const lines = markdown.split('\n');
  const sections: MarkdownSection[] = [];

  let currentSection: MarkdownSection | null = null;
  let currentContent: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headerMatch) {
      // Save previous section if it exists
      if (currentSection) {
        currentSection.content = currentContent.join('\n').trim();
        currentSection.endLine = i - 1;
        sections.push(currentSection);
      }

      // Start new section
      const level = headerMatch[1].length;
      const title = headerMatch[2].trim();
      const type = detectSectionType(title, lines.slice(i, Math.min(i + 20, lines.length)));

      currentSection = {
        type,
        title,
        level,
        startLine: i,
        endLine: i, // Will be updated when section ends
        content: '',
      };
      currentContent = [];
    } else if (currentSection) {
      // Add line to current section content
      currentContent.push(line);
    }
  }

  // Save final section
  if (currentSection) {
    currentSection.content = currentContent.join('\n').trim();
    currentSection.endLine = lines.length - 1;
    sections.push(currentSection);
  }

  // Build hierarchical structure (nest subsections under parent sections)
  const hierarchicalSections = buildHierarchy(sections);

  // Calculate metadata
  const metadata = {
    totalSections: hierarchicalSections.length,
    spellCount: countByType(hierarchicalSections, 'spell'),
    itemCount: countByType(hierarchicalSections, 'item'),
    monsterCount: countByType(hierarchicalSections, 'monster'),
    classFeatureCount: countByType(hierarchicalSections, 'class_feature'),
    featCount: countByType(hierarchicalSections, 'feat'),
    unknownCount: countByType(hierarchicalSections, 'unknown'),
  };

  return {
    sections: hierarchicalSections,
    metadata,
  };
}

/**
 * Detect the type of D&D content based on title and content
 */
function detectSectionType(title: string, contentPreview: string[]): MarkdownSection['type'] {
  const titleLower = title.toLowerCase();
  const contentText = contentPreview.join(' ').toLowerCase();

  // Spell detection
  const spellIndicators = [
    'cantrip', 'spell level', 'casting time', 'verbal', 'somatic', 'material',
    'concentration', 'ritual', 'evocation', 'abjuration', 'conjuration',
    'divination', 'enchantment', 'illusion', 'necromancy', 'transmutation'
  ];

  if (
    titleLower.includes('spell') ||
    titleLower.includes('cantrip') ||
    spellIndicators.some(indicator => contentText.includes(indicator))
  ) {
    return 'spell';
  }

  // Monster detection
  const monsterIndicators = [
    'armor class', 'hit points', 'speed', 'str', 'dex', 'con', 'int', 'wis', 'cha',
    'challenge rating', 'cr ', 'legendary actions', 'lair actions', 'multiattack'
  ];

  if (
    titleLower.match(/\b(dragon|goblin|orc|undead|fiend|elemental|beast|aberration)\b/) ||
    monsterIndicators.filter(indicator => contentText.includes(indicator)).length >= 3
  ) {
    return 'monster';
  }

  // Item detection
  const itemIndicators = [
    'requires attunement', 'rarity', 'uncommon', 'rare', 'very rare', 'legendary',
    'artifact', 'weapon', 'armor', 'wondrous item', 'potion', 'scroll', 'ring',
    'rod', 'staff', 'wand'
  ];

  if (
    titleLower.includes('item') ||
    titleLower.includes('weapon') ||
    titleLower.includes('armor') ||
    itemIndicators.some(indicator => contentText.includes(indicator))
  ) {
    return 'item';
  }

  // Class feature detection
  const classFeatureIndicators = [
    'class feature', 'subclass', 'archetype', 'level',
    'proficiency bonus', 'spell slots'
  ];

  if (
    titleLower.match(/\b(barbarian|bard|cleric|druid|fighter|monk|paladin|ranger|rogue|sorcerer|warlock|wizard)\b/) ||
    classFeatureIndicators.some(indicator => contentText.includes(indicator))
  ) {
    return 'class_feature';
  }

  // Feat detection
  if (
    titleLower.includes('feat') ||
    contentText.includes('prerequisite') && contentText.includes('benefit')
  ) {
    return 'feat';
  }

  // Race detection
  if (
    titleLower.match(/\b(elf|dwarf|human|halfling|dragonborn|gnome|half-elf|half-orc|tiefling)\b/) ||
    contentText.includes('ability score increase') && contentText.includes('age') && contentText.includes('alignment')
  ) {
    return 'race';
  }

  // Background detection
  if (
    titleLower.includes('background') ||
    contentText.includes('skill proficiencies') && contentText.includes('equipment')
  ) {
    return 'background';
  }

  return 'unknown';
}

/**
 * Build hierarchical structure from flat sections
 */
function buildHierarchy(sections: MarkdownSection[]): MarkdownSection[] {
  const result: MarkdownSection[] = [];
  const stack: MarkdownSection[] = [];

  for (const section of sections) {
    // Pop sections from stack that are not parents of current section
    while (stack.length > 0 && stack[stack.length - 1].level! >= section.level!) {
      stack.pop();
    }

    if (stack.length === 0) {
      // Top-level section
      result.push(section);
    } else {
      // Nested section
      const parent = stack[stack.length - 1];
      if (!parent.subsections) {
        parent.subsections = [];
      }
      parent.subsections.push(section);
    }

    stack.push(section);
  }

  return result;
}

/**
 * Count sections by type (including nested sections)
 */
function countByType(sections: MarkdownSection[], type: MarkdownSection['type']): number {
  let count = 0;

  for (const section of sections) {
    if (section.type === type) {
      count++;
    }
    if (section.subsections) {
      count += countByType(section.subsections, type);
    }
  }

  return count;
}

/**
 * Extract all sections of a specific type (flattened)
 */
export function getSectionsByType(
  sections: MarkdownSection[],
  type: MarkdownSection['type']
): MarkdownSection[] {
  const results: MarkdownSection[] = [];

  for (const section of sections) {
    if (section.type === type) {
      results.push(section);
    }
    if (section.subsections) {
      results.push(...getSectionsByType(section.subsections, type));
    }
  }

  return results;
}

/**
 * Format section content for Ollama processing
 * Adds context and instructions for better extraction
 */
export function formatSectionForOllama(section: MarkdownSection): string {
  const typeInstructions = {
    spell: 'Extract spell attributes: name, level, school, casting time, range, components, duration, description, and any special effects or damage.',
    item: 'Extract item attributes: name, type, rarity, requires attunement, description, magical properties, and any special abilities or bonuses.',
    monster: 'Extract creature attributes: name, size, type, alignment, AC, HP, speed, ability scores, skills, resistances, immunities, senses, languages, CR, traits, actions, and legendary actions.',
    class_feature: 'Extract class feature attributes: name, class, level requirement, description, and mechanical benefits.',
    feat: 'Extract feat attributes: name, prerequisites, description, and benefits.',
    race: 'Extract race attributes: name, ability score increases, age, alignment, size, speed, languages, and racial traits.',
    background: 'Extract background attributes: name, skill proficiencies, tool proficiencies, languages, equipment, feature, and personality traits.',
    unknown: 'Extract any D&D-relevant information from this content.',
  };

  return `
# ${section.title}

Type: ${section.type}

Instructions: ${typeInstructions[section.type]}

Content:
${section.content}
`.trim();
}

/**
 * Split large markdown into smaller chunks for processing
 * Useful when dealing with large PDFs that need to be processed in batches
 */
export function splitMarkdownIntoChunks(
  markdown: string,
  maxChunkSize: number = 8000 // characters
): string[] {
  const parsed = parseMarkdown(markdown);
  const chunks: string[] = [];
  let currentChunk: MarkdownSection[] = [];
  let currentSize = 0;

  for (const section of parsed.sections) {
    const sectionText = `# ${section.title}\n\n${section.content}`;
    const sectionSize = sectionText.length;

    if (currentSize + sectionSize > maxChunkSize && currentChunk.length > 0) {
      // Save current chunk
      chunks.push(currentChunk.map(s => `# ${s.title}\n\n${s.content}`).join('\n\n---\n\n'));
      currentChunk = [];
      currentSize = 0;
    }

    currentChunk.push(section);
    currentSize += sectionSize;
  }

  // Save final chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.map(s => `# ${s.title}\n\n${s.content}`).join('\n\n---\n\n'));
  }

  return chunks;
}

/**
 * Generate summary of parsed markdown
 */
export function generateSummary(parsed: ParsedMarkdown): string {
  const lines = [
    `Found ${parsed.metadata.totalSections} sections:`,
  ];

  if (parsed.metadata.spellCount > 0) {
    lines.push(`  - ${parsed.metadata.spellCount} spells`);
  }
  if (parsed.metadata.itemCount > 0) {
    lines.push(`  - ${parsed.metadata.itemCount} items`);
  }
  if (parsed.metadata.monsterCount > 0) {
    lines.push(`  - ${parsed.metadata.monsterCount} monsters`);
  }
  if (parsed.metadata.classFeatureCount > 0) {
    lines.push(`  - ${parsed.metadata.classFeatureCount} class features`);
  }
  if (parsed.metadata.featCount > 0) {
    lines.push(`  - ${parsed.metadata.featCount} feats`);
  }
  if (parsed.metadata.unknownCount > 0) {
    lines.push(`  - ${parsed.metadata.unknownCount} unknown sections`);
  }

  return lines.join('\n');
}
