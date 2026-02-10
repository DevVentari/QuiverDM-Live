import { useCallback, useState } from 'react';
import { trpc } from '@/lib/trpc';

export interface Action {
  name: string;
  description: string;
  attackType?: string;
  attackBonus?: string;
  reach?: string;
  range?: string;
  damageCount?: string;
  diceSize?: string;
  damageModifier?: string;
  damageType?: string;
}

export interface CreatureFormData {
  name: string;
  size: string;
  type: string;
  alignment: string;
  ac: string;
  acType: string;
  hpAverage: string;
  hpDiceCount: string;
  hpDiceSize: string;
  hpModifier: string;
  speedWalk: string;
  speedFly: string;
  speedSwim: string;
  speedBurrow: string;
  speedClimb: string;
  hover: boolean;
  abilities: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  savingThrows: string[];
  skills: Record<string, number>;
  damageVulnerabilities: string;
  damageResistances: string;
  damageImmunities: string;
  conditionImmunities: string;
  darkvision: string;
  blindsight: string;
  truesight: string;
  tremorsense: string;
  passivePerception: string;
  languages: string;
  cr: string;
  proficiencyBonus: string;
  traits: Array<{ name: string; description: string }>;
  actions: Action[];
  reactions: Array<{ name: string; description: string }>;
  hasLegendaryActions: boolean;
  legendaryActionsPerRound: string;
  legendaryActionDescription: string;
  legendaryActions: Array<{ name: string; cost: number; description: string }>;
  description: string;
  lore: string;
  tags: string[];
}

const initialCreatureData: CreatureFormData = {
  name: '',
  size: 'Medium',
  type: 'humanoid',
  alignment: 'unaligned',
  ac: '10',
  acType: '',
  hpAverage: '10',
  hpDiceCount: '2',
  hpDiceSize: '8',
  hpModifier: '0',
  speedWalk: '30',
  speedFly: '',
  speedSwim: '',
  speedBurrow: '',
  speedClimb: '',
  hover: false,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  savingThrows: [],
  skills: {},
  damageVulnerabilities: '',
  damageResistances: '',
  damageImmunities: '',
  conditionImmunities: '',
  darkvision: '',
  blindsight: '',
  truesight: '',
  tremorsense: '',
  passivePerception: '10',
  languages: '',
  cr: '1',
  proficiencyBonus: '2',
  traits: [],
  actions: [{ name: '', description: '' }],
  reactions: [],
  hasLegendaryActions: false,
  legendaryActionsPerRound: '3',
  legendaryActionDescription: '',
  legendaryActions: [],
  description: '',
  lore: '',
  tags: [],
};

export function useCreatureForm(options?: {
  onSuccess?: () => void;
  onError?: (message: string) => void;
}) {
  const [formData, setFormData] = useState<CreatureFormData>(initialCreatureData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createContentMutation = trpc.homebrew.createContent.useMutation({
    onSuccess: () => options?.onSuccess?.(),
  });

  const updateField = useCallback(
    <K extends keyof CreatureFormData>(field: K, value: CreatureFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const addItem = useCallback(
    (field: 'traits' | 'actions' | 'reactions' | 'legendaryActions') => {
      const newItem =
        field === 'legendaryActions'
          ? { name: '', cost: 1, description: '' }
          : { name: '', description: '' };
      updateField(field, [...formData[field], newItem] as any);
    },
    [formData, updateField]
  );

  const updateItem = useCallback(
    (
      field: 'traits' | 'actions' | 'reactions' | 'legendaryActions',
      index: number,
      key: string,
      value: any
    ) => {
      const items = [...formData[field]];
      (items[index] as any)[key] = value;
      updateField(field, items as any);
    },
    [formData, updateField]
  );

  const removeItem = useCallback(
    (field: 'traits' | 'actions' | 'reactions' | 'legendaryActions', index: number) => {
      const items = [...formData[field]];
      items.splice(index, 1);
      updateField(field, items as any);
    },
    [formData, updateField]
  );

  const reset = useCallback(() => {
    setFormData(initialCreatureData);
  }, []);

  const submit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const creatureData: any = {
        size: formData.size,
        type: formData.type,
        alignment: formData.alignment,
        ac: parseInt(formData.ac, 10),
        acType: formData.acType || undefined,
        hitPoints: {
          average: parseInt(formData.hpAverage, 10),
          diceCount: parseInt(formData.hpDiceCount, 10),
          diceSize: parseInt(formData.hpDiceSize, 10),
          modifier: parseInt(formData.hpModifier, 10),
        },
        speed: {
          walk: parseInt(formData.speedWalk, 10) || undefined,
          fly: parseInt(formData.speedFly, 10) || undefined,
          swim: parseInt(formData.speedSwim, 10) || undefined,
          burrow: parseInt(formData.speedBurrow, 10) || undefined,
          climb: parseInt(formData.speedClimb, 10) || undefined,
          hover: formData.hover,
        },
        abilities: formData.abilities,
        challengeRating: formData.cr,
        proficiencyBonus: parseInt(formData.proficiencyBonus, 10),
        description: formData.description,
        lore: formData.lore || undefined,
      };

      if (formData.savingThrows.length > 0) {
        creatureData.savingThrows = {};
        formData.savingThrows.forEach((save) => {
          creatureData.savingThrows[save.toLowerCase()] = parseInt(
            formData.proficiencyBonus,
            10
          );
        });
      }

      if (Object.keys(formData.skills).length > 0) {
        creatureData.skills = formData.skills;
      }

      if (formData.damageVulnerabilities) {
        creatureData.damageVulnerabilities = formData.damageVulnerabilities
          .split(',')
          .map((s) => s.trim());
      }
      if (formData.damageResistances) {
        creatureData.damageResistances = formData.damageResistances
          .split(',')
          .map((s) => s.trim());
      }
      if (formData.damageImmunities) {
        creatureData.damageImmunities = formData.damageImmunities
          .split(',')
          .map((s) => s.trim());
      }
      if (formData.conditionImmunities) {
        creatureData.conditionImmunities = formData.conditionImmunities
          .split(',')
          .map((s) => s.trim());
      }

      creatureData.senses = {
        passivePerception: parseInt(formData.passivePerception, 10),
        darkvision: parseInt(formData.darkvision, 10) || undefined,
        blindsight: parseInt(formData.blindsight, 10) || undefined,
        truesight: parseInt(formData.truesight, 10) || undefined,
        tremorsense: parseInt(formData.tremorsense, 10) || undefined,
      };

      creatureData.languages = formData.languages
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (formData.traits.length > 0) {
        creatureData.traits = formData.traits.filter(
          (t) => t.name.trim() !== ''
        );
      }

      creatureData.actions = formData.actions.filter((a) => a.name.trim() !== '');

      if (formData.reactions.length > 0) {
        creatureData.reactions = formData.reactions.filter(
          (r) => r.name.trim() !== ''
        );
      }

      if (formData.hasLegendaryActions && formData.legendaryActions.length > 0) {
        creatureData.legendaryActions = {
          description:
            formData.legendaryActionDescription ||
            `The creature can take ${formData.legendaryActionsPerRound} legendary actions, choosing from the options below.`,
          actions: formData.legendaryActions.filter(
            (la) => la.name.trim() !== ''
          ),
        };
      }

      await createContentMutation.mutateAsync({
        type: 'creature',
        name: formData.name,
        data: creatureData,
        tags: formData.tags,
        sourceType: 'manual',
      });
    } catch (error) {
      options?.onError?.('Failed to create creature. Please try again.');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, createContentMutation, options]);

  return {
    formData,
    updateField,
    addItem,
    updateItem,
    removeItem,
    submit,
    reset,
    isSubmitting,
  };
}
