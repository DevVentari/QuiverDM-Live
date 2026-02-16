import { Wand2, Sparkles, Skull, Shield, Star, BookOpen, Swords, Users, type LucideIcon } from 'lucide-react';

export const typeStyleMap: Record<string, { label: string; color: string; gradient: string; icon: LucideIcon }> = {
  item: { label: 'Item', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', gradient: 'from-amber-900/70 to-amber-700/40', icon: Wand2 },
  spell: { label: 'Spell', color: 'bg-sky-500/10 text-sky-500 border-sky-500/20', gradient: 'from-sky-900/70 to-sky-700/40', icon: Sparkles },
  creature: { label: 'Creature', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', gradient: 'from-emerald-900/70 to-emerald-700/40', icon: Skull },
  class: { label: 'Class', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20', gradient: 'from-indigo-900/70 to-indigo-700/40', icon: Shield },
  subclass: { label: 'Subclass', color: 'bg-indigo-400/10 text-indigo-400 border-indigo-400/20', gradient: 'from-indigo-900/70 to-indigo-700/40', icon: Shield },
  feat: { label: 'Feat', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', gradient: 'from-emerald-900/70 to-emerald-700/40', icon: Star },
  race: { label: 'Race', color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20', gradient: 'from-cyan-900/70 to-cyan-700/40', icon: Users },
  background: { label: 'Background', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20', gradient: 'from-orange-900/70 to-orange-700/40', icon: BookOpen },
  location: { label: 'Location', color: 'bg-green-500/10 text-green-500 border-green-500/20', gradient: 'from-green-900/70 to-green-700/40', icon: BookOpen },
  rule: { label: 'Rule', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20', gradient: 'from-gray-900/70 to-gray-700/40', icon: BookOpen },
};

const defaultStyle = { label: 'Content', color: 'bg-muted text-muted-foreground border-border', gradient: 'from-gray-900/70 to-gray-700/40', icon: Swords };

export function getTypeStyle(type: string) {
  return typeStyleMap[type] || defaultStyle;
}

export function getSourceLabel(sourceType: string) {
  switch (sourceType) {
    case 'pdf_extraction': return 'Extracted from PDF';
    case 'dndbeyond_import': return 'D&D Beyond';
    case 'manual': return 'Manual';
    default: return sourceType;
  }
}
