'use client';

import { useState } from 'react';
import { Dialog, Flex, Button, Heading, Text, Progress, VisuallyHidden } from '@radix-ui/themes';
import { Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { WelcomeStep } from './steps/WelcomeStep';
import { CreateCampaignStep } from './steps/CreateCampaignStep';
import { DNDBeyondStep } from './steps/DNDBeyondStep';
import { CompleteStep } from './steps/CompleteStep';

export type OnboardingStep = 'welcome' | 'campaign' | 'dndbeyond' | 'complete';

interface OnboardingWizardProps {
  open: boolean;
  onComplete: () => void;
  onSkip?: () => void;
}

export function OnboardingWizard({ open, onComplete, onSkip }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [campaignCreated, setCampaignCreated] = useState(false);
  const [campaignId, setCampaignId] = useState<string>('');
  const [dndbeyondConfigured, setDndbeyondConfigured] = useState(false);

  const steps: OnboardingStep[] = ['welcome', 'campaign', 'dndbeyond', 'complete'];
  const currentStepIndex = steps.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const handleNext = () => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      onComplete();
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'welcome':
        return true;
      case 'campaign':
        return campaignCreated;
      case 'dndbeyond':
        return true; // Optional step
      case 'complete':
        return true;
      default:
        return false;
    }
  };

  return (
    <Dialog.Root open={open}>
      <Dialog.Content style={{ maxWidth: '650px', padding: 0 }}>
        <VisuallyHidden>
          <Dialog.Title>Onboarding Wizard</Dialog.Title>
        </VisuallyHidden>
        {/* Progress Bar */}
        <Box p="4" style={{ borderBottom: '1px solid var(--gray-6)' }}>
          <Flex direction="column" gap="2">
            <Flex justify="between" align="center">
              <Text size="2" weight="medium" color="gray">
                Step {currentStepIndex + 1} of {steps.length}
              </Text>
              {currentStep !== 'complete' && (
                <Button variant="ghost" size="1" onClick={handleSkip}>
                  Skip tutorial
                </Button>
              )}
            </Flex>
            <Progress value={progress} />
          </Flex>
        </Box>

        {/* Step Content */}
        <Box p="6">
          {currentStep === 'welcome' && <WelcomeStep />}
          {currentStep === 'campaign' && (
            <CreateCampaignStep
              onCampaignCreated={(id) => {
                setCampaignCreated(true);
                setCampaignId(id);
              }}
            />
          )}
          {currentStep === 'dndbeyond' && (
            <DNDBeyondStep
              onConfigured={() => setDndbeyondConfigured(true)}
            />
          )}
          {currentStep === 'complete' && <CompleteStep />}
        </Box>

        {/* Navigation */}
        <Box p="4" style={{ borderTop: '1px solid var(--gray-6)' }}>
          <Flex justify="between" align="center">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 'welcome'}
            >
              <ArrowLeft size={16} />
              Back
            </Button>

            {currentStep !== 'complete' ? (
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
                style={{ backgroundColor: 'var(--violet-9)' }}
              >
                {currentStep === 'campaign' && !campaignCreated
                  ? 'Create Campaign to Continue'
                  : 'Next'}
                <ArrowRight size={16} />
              </Button>
            ) : (
              <Button
                onClick={onComplete}
                style={{ backgroundColor: 'var(--violet-9)' }}
              >
                <Check size={16} />
                Get Started
              </Button>
            )}
          </Flex>
        </Box>
      </Dialog.Content>
    </Dialog.Root>
  );
}

// Re-export Box for convenience
import { Box } from '@radix-ui/themes';
