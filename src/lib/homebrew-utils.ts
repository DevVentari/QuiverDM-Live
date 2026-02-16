import { Wand2, Sparkles, Skull, Shield, Star, BookOpen, Swords, Users, type LucideIcon } from 'lucide-react';

export const typeStyleMap: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  item: { label: 'Item', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: Wand2 },
  spell: { label: 'Spell', color: 'bg-violet-500/10 text-violet-500 border-violet-500/20', icon: Sparkles },
  creature: { label: 'Creature', color: 'bg-red-500/10 text-red-500 border-red-500/20', icon: Skull },
  class: { label: 'Class', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', icon: Shield },
  subclass: { label: 'Subclass', color: 'bg-blue-400/10 text-blue-400 border-blue-400/20', icon: Shield },
  feat: { label: 'Feat', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: Star },
  race: { label: 'Race', color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20', icon: Users },
  background: { label: 'Background', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20', icon: BookOpen },
  location: { label: 'Location', color: 'bg-green-500/10 text-green-500 border-green-500/20', icon: BookOpen },
  rule: { label: 'Rule', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20', icon: BookOpen },
};

const defaultStyle = { label: 'Content', color: 'bg-muted text-muted-foreground border-border', icon: Swords };

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
