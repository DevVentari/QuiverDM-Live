import { useCallback, useState } from 'react';
import { trpc } from '@/lib/trpc';

export interface SpellFormData {
  name: string;
  level: number;
  school: string;
  castingTime: string;
  ritual: boolean;
  range: string;
  hasAreaOfEffect: boolean;
  areaType: string;
  areaSize: string;
  componentsVerbal: boolean;
  componentsSomatic: boolean;
  componentsMaterial: boolean;
  materialComponents: string;
  materialCost: string;
  materialConsumed: boolean;
  duration: string;
  concentration: boolean;
  description: string;
  higherLevels: string;
  hasDamage: boolean;
  damageCount: number;
  damageSize: number;
  damageType: string;
  hasHealing: boolean;
  healingCount: number;
  healingSize: number;
  saveType: string;
  saveEffect: string;
  attackType: string;
  classes: string[];
  tags: string[];
}

const initialSpellData: SpellFormData = {
  name: '',
  level: 1,
  school: 'Evocation',
  castingTime: '1 action',
  ritual: false,
  range: '30 feet',
  hasAreaOfEffect: false,
  areaType: 'sphere',
  areaSize: '20',
  componentsVerbal: true,
  componentsSomatic: true,
  componentsMaterial: false,
  materialComponents: '',
  materialCost: '',
  materialConsumed: false,
  duration: 'Instantaneous',
  concentration: false,
  description: '',
  higherLevels: '',
  hasDamage: false,
  damageCount: 1,
  damageSize: 6,
  damageType: 'fire',
  hasHealing: false,
  healingCount: 1,
  healingSize: 8,
  saveType: '',
  saveEffect: '',
  attackType: '',
  classes: [],
  tags: [],
};

export function useSpellForm(options?: {
  onSuccess?: () => void;
  onError?: (message: string) => void;
}) {
  const [formData, setFormData] = useState<SpellFormData>(initialSpellData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createContentMutation = trpc.homebrew.createContent.useMutation({
    onSuccess: () => options?.onSuccess?.(),
  });

  const updateField = useCallback(
    <K extends keyof SpellFormData>(field: K, value: SpellFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const reset = useCallback(() => {
    setFormData(initialSpellData);
  }, []);

  const submit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const spellData: any = {
        level: formData.level,
        school: formData.school,
        castingTime: formData.castingTime,
        ritual: formData.ritual,
        range: formData.range,
        components: {
          verbal: formData.componentsVerbal,
          somatic: formData.componentsSomatic,
          material: formData.componentsMaterial,
          materialComponents: formData.materialComponents || undefined,
          materialCost: formData.materialCost
            ? parseFloat(formData.materialCost)
            : undefined,
          materialConsumed: formData.materialConsumed,
        },
        duration: formData.duration,
        concentration: formData.concentration,
        description: formData.description,
        higherLevels: formData.higherLevels || undefined,
        classes: formData.classes,
      };

      if (formData.hasAreaOfEffect) {
        spellData.areaOfEffect = {
          type: formData.areaType,
          size: parseInt(formData.areaSize, 10),
        };
      }

      if (formData.hasDamage) {
        spellData.damage = {
          diceCount: formData.damageCount,
          diceSize: formData.damageSize,
          damageType: formData.damageType,
        };
      }

      if (formData.hasHealing) {
        spellData.healing = {
          diceCount: formData.healingCount,
          diceSize: formData.healingSize,
        };
      }

      if (formData.saveType) {
        spellData.saveType = formData.saveType;
        spellData.saveEffect = formData.saveEffect;
      }

      if (formData.attackType) {
        spellData.attackType = formData.attackType;
      }

      await createContentMutation.mutateAsync({
        type: 'spell',
        name: formData.name,
        data: spellData,
        tags: formData.tags,
        sourceType: 'manual',
      });
    } catch (error) {
      options?.onError?.('Failed to create spell. Please try again.');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, createContentMutation, options]);

  return {
    formData,
    updateField,
    submit,
    reset,
    isSubmitting,
  };
}
