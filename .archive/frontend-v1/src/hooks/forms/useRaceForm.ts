import { useCallback, useState } from 'react';
import { trpc } from '@/lib/trpc';

export interface Trait {
  name: string;
  description: string;
}

export interface RaceFormData {
  name: string;
  size: string;
  speed: string;
  strIncrease: string;
  dexIncrease: string;
  conIncrease: string;
  intIncrease: string;
  wisIncrease: string;
  chaIncrease: string;
  hasChoiceASI: boolean;
  choiceCount: string;
  choiceAmount: string;
  maturity: string;
  lifespan: string;
  ageDescription: string;
  languages: string[];
  additionalLanguageChoices: string;
  traits: Trait[];
  weaponProficiencies: string[];
  armorProficiencies: string[];
  toolProficiencies: string[];
  skillProficiencies: string[];
  skillChoiceCount: string;
  skillChoiceOptions: string[];
  hasSubraces: boolean;
  subraceOptions: string[];
  description: string;
  tags: string[];
}

const initialRaceData: RaceFormData = {
  name: '',
  size: 'Medium',
  speed: '30',
  strIncrease: '0',
  dexIncrease: '0',
  conIncrease: '0',
  intIncrease: '0',
  wisIncrease: '0',
  chaIncrease: '0',
  hasChoiceASI: false,
  choiceCount: '1',
  choiceAmount: '1',
  maturity: '',
  lifespan: '',
  ageDescription: '',
  languages: [],
  additionalLanguageChoices: '0',
  traits: [{ name: '', description: '' }],
  weaponProficiencies: [],
  armorProficiencies: [],
  toolProficiencies: [],
  skillProficiencies: [],
  skillChoiceCount: '0',
  skillChoiceOptions: [],
  hasSubraces: false,
  subraceOptions: [''],
  description: '',
  tags: [],
};

export function useRaceForm(options?: {
  onSuccess?: () => void;
  onError?: (message: string) => void;
}) {
  const [formData, setFormData] = useState<RaceFormData>(initialRaceData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createContentMutation = trpc.homebrew.createContent.useMutation({
    onSuccess: () => options?.onSuccess?.(),
  });

  const updateField = useCallback(
    <K extends keyof RaceFormData>(field: K, value: RaceFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const updateTrait = useCallback(
    (index: number, field: keyof Trait, value: string) => {
      const traits = [...formData.traits];
      traits[index] = { ...traits[index], [field]: value };
      updateField('traits', traits);
    },
    [formData.traits, updateField]
  );

  const addTrait = useCallback(() => {
    updateField('traits', [...formData.traits, { name: '', description: '' }]);
  }, [formData.traits, updateField]);

  const removeTrait = useCallback(
    (index: number) => {
      const traits = [...formData.traits];
      traits.splice(index, 1);
      updateField('traits', traits);
    },
    [formData.traits, updateField]
  );

  const updateSubraceOption = useCallback(
    (index: number, value: string) => {
      const options = [...formData.subraceOptions];
      options[index] = value;
      updateField('subraceOptions', options);
    },
    [formData.subraceOptions, updateField]
  );

  const addSubraceOption = useCallback(() => {
    updateField('subraceOptions', [...formData.subraceOptions, '']);
  }, [formData.subraceOptions, updateField]);

  const removeSubraceOption = useCallback(
    (index: number) => {
      const options = [...formData.subraceOptions];
      options.splice(index, 1);
      updateField('subraceOptions', options);
    },
    [formData.subraceOptions, updateField]
  );

  const reset = useCallback(() => {
    setFormData(initialRaceData);
  }, []);

  const submit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const abilityScoreIncrease: any = {};
      if (parseInt(formData.strIncrease, 10))
        abilityScoreIncrease.str = parseInt(formData.strIncrease, 10);
      if (parseInt(formData.dexIncrease, 10))
        abilityScoreIncrease.dex = parseInt(formData.dexIncrease, 10);
      if (parseInt(formData.conIncrease, 10))
        abilityScoreIncrease.con = parseInt(formData.conIncrease, 10);
      if (parseInt(formData.intIncrease, 10))
        abilityScoreIncrease.int = parseInt(formData.intIncrease, 10);
      if (parseInt(formData.wisIncrease, 10))
        abilityScoreIncrease.wis = parseInt(formData.wisIncrease, 10);
      if (parseInt(formData.chaIncrease, 10))
        abilityScoreIncrease.cha = parseInt(formData.chaIncrease, 10);

      if (formData.hasChoiceASI) {
        abilityScoreIncrease.choice = {
          count: parseInt(formData.choiceCount, 10),
          amount: parseInt(formData.choiceAmount, 10),
        };
      }

      const raceData: any = {
        size: formData.size,
        speed: parseInt(formData.speed, 10),
        abilityScoreIncrease,
        age: {
          maturity: parseInt(formData.maturity, 10) || undefined,
          lifespan: parseInt(formData.lifespan, 10) || undefined,
          description: formData.ageDescription || undefined,
        },
        languages: formData.languages,
        additionalLanguageChoices:
          parseInt(formData.additionalLanguageChoices, 10) || undefined,
        traits: formData.traits.filter((t) => t.name.trim() !== ''),
        description: formData.description,
      };

      if (formData.weaponProficiencies.length > 0) {
        raceData.weaponProficiencies = formData.weaponProficiencies;
      }
      if (formData.armorProficiencies.length > 0) {
        raceData.armorProficiencies = formData.armorProficiencies;
      }
      if (formData.toolProficiencies.length > 0) {
        raceData.toolProficiencies = formData.toolProficiencies;
      }
      if (formData.skillProficiencies.length > 0) {
        raceData.skillProficiencies = formData.skillProficiencies;
      }

      if (
        parseInt(formData.skillChoiceCount, 10) > 0 &&
        formData.skillChoiceOptions.length > 0
      ) {
        raceData.skillChoices = {
          count: parseInt(formData.skillChoiceCount, 10),
          options: formData.skillChoiceOptions,
        };
      }

      if (formData.hasSubraces) {
        raceData.hasSubraces = true;
        raceData.subraceOptions = formData.subraceOptions.filter(
          (s) => s.trim() !== ''
        );
      } else {
        raceData.hasSubraces = false;
      }

      await createContentMutation.mutateAsync({
        type: 'race',
        name: formData.name,
        data: raceData,
        tags: formData.tags,
        sourceType: 'manual',
      });
    } catch (error) {
      options?.onError?.('Failed to create race. Please try again.');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, createContentMutation, options]);

  return {
    formData,
    updateField,
    updateTrait,
    addTrait,
    removeTrait,
    updateSubraceOption,
    addSubraceOption,
    removeSubraceOption,
    submit,
    reset,
    isSubmitting,
  };
}
