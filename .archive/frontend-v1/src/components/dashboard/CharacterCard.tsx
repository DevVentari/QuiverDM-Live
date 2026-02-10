'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  Swords,
  Music,
  Sparkles,
  Leaf,
  Sword,
  Hand,
  Shield,
  Crosshair,
  Key,
  Wand,
  Eye,
  BookOpen,
  Cog,
  Droplet,
  User,
} from 'lucide-react';
import { DashboardCharacter } from '@/types/dashboard';
import { Card } from '@/components/ui/Card'; // Our custom Card

interface CharacterCardProps {
  character: DashboardCharacter;
}

// Class icon mapping
const CLASS_ICONS: Record<string, React.ReactNode> = {
  barbarian: <Swords className="w-8 h-8" />,
  bard: <Music className="w-8 h-8" />,
  cleric: <Sparkles className="w-8 h-8" />,
  druid: <Leaf className="w-8 h-8" />,
  fighter: <Sword className="w-8 h-8" />,
  monk: <Hand className="w-8 h-8" />,
  paladin: <Shield className="w-8 h-8" />,
  ranger: <Crosshair className="w-8 h-8" />,
  rogue: <Key className="w-8 h-8" />,
  sorcerer: <Wand className="w-8 h-8" />,
  warlock: <Eye className="w-8 h-8" />,
  wizard: <BookOpen className="w-8 h-8" />,
  artificer: <Cog className="w-8 h-8" />,
  blood_hunter: <Droplet className="w-8 h-8" />,
};

function getClassIcon(className: string | null): React.ReactNode {
  if (!className) return <User className="w-8 h-8" />;
  const normalizedClass = className.toLowerCase().replace(/\s+/g, '_');
  return CLASS_ICONS[normalizedClass] || <User className="w-8 h-8" />;
}

export function CharacterCard({ character }: CharacterCardProps) {
  const primaryCampaign = character.campaignCharacters[0]?.campaign;
  const campaignAbbrev = primaryCampaign
    ? primaryCampaign.name.substring(0, 8) + (primaryCampaign.name.length > 8 ? '…' : '')
    : null;

  return (
    <Link href={`/characters/${character.id}`}>
      <Card className="bg-cream-white border border-cream-border hover:border-accent-warm transition-all p-4 cursor-pointer group w-[140px] flex-shrink-0">
        <div className="flex flex-col items-center text-center gap-2">
          {/* Portrait or Class Icon */}
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent-warm to-accent-dark flex items-center justify-center text-text-primary group-hover:from-accent-light group-hover:to-accent-warm transition-colors overflow-hidden">
            {character.portraitUrl ? (
               <Image
                src={character.portraitUrl}
                alt={character.name}
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            ) : (
              <>{getClassIcon(character.class)}</>
            )}
          </div>

          {/* Character Name */}
          <span className="text-text-primary font-semibold text-sm truncate w-full">
            {character.name}
          </span>

          {/* Race */}
          {character.race && (
            <span className="text-text-secondary text-xs truncate w-full">
              {character.race}
            </span>
          )}

          {/* Class + Level */}
          <span className="text-accent-warm text-xs font-medium">
            {character.class || 'Adventurer'} {character.level}
          </span>

          {/* Campaign Badge */}
          {campaignAbbrev && (
            <span className="inline-flex items-center rounded-full bg-accent-warm/20 px-2.5 py-0.5 text-xs font-medium text-accent-warm truncate max-w-full">
              {campaignAbbrev}
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}

export function CharacterCardSkeleton() {
  return (
    <Card className="bg-cream-white border border-cream-border p-4 w-[140px] flex-shrink-0 animate-pulse">
      <div className="flex flex-col items-center gap-2">
        <div className="w-16 h-16 rounded-full bg-cream-light" />
        <div className="h-4 bg-cream-light rounded w-20" />
        <div className="h-3 bg-cream-light rounded w-16" />
        <div className="h-3 bg-cream-light rounded w-24" />
        <div className="h-5 bg-cream-light rounded w-16" />
      </div>
    </Card>
  );
}

export function CreateCharacterCard() {
  return (
    <Link href="/characters/new">
      <Card className="bg-cream-white/50 border border-dashed border-cream-border hover:border-accent-warm transition-all p-4 cursor-pointer group w-[140px] flex-shrink-0">
        <div className="flex flex-col items-center justify-center text-center gap-2 h-full min-h-[140px]">
          <div className="w-16 h-16 rounded-full bg-cream-light/50 flex items-center justify-center text-2xl group-hover:bg-accent-warm/20 transition-colors">
            <span className="text-text-secondary group-hover:text-accent-warm">+</span>
          </div>
          <span className="text-text-secondary group-hover:text-accent-warm text-sm font-medium transition-colors">
            Create Character
          </span>
        </div>
      </Card>
    </Link>
  );
}
