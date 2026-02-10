'use client';

import { useRouter } from 'next/navigation';
import { Card, Flex, Heading, Text, Button } from '@radix-ui/themes';
import { motion } from 'framer-motion';

export default function SettingsPage() {
  const router = useRouter();

  const settingsSections = [
    {
      title: 'API Keys',
      description: 'Manage your API keys for OpenAI, Anthropic, HuggingFace, and D&D Beyond',
      href: '/settings/api-keys',
      icon: '🔑',
    },
    {
      title: 'Profile',
      description: 'Update your profile information and preferences',
      href: '/settings/profile',
      icon: '👤',
      disabled: true,
    },
    {
      title: 'Notifications',
      description: 'Configure notification preferences',
      href: '/settings/notifications',
      icon: '🔔',
      disabled: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-violet-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Heading size="8" className="text-white mb-2">
            Settings
          </Heading>
          <Text size="3" className="text-gray-300">
            Manage your account settings and preferences
          </Text>
        </div>

        {/* Settings Cards */}
        <div className="grid gap-4">
          {settingsSections.map((section, index) => (
            <motion.div
              key={section.href}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                className={`p-6 ${
                  section.disabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer hover:bg-gray-800/50 transition-colors'
                }`}
                onClick={() => !section.disabled && router.push(section.href)}
              >
                <Flex gap="4" align="center">
                  <div className="text-4xl">{section.icon}</div>
                  <Flex direction="column" gap="1" style={{ flex: 1 }}>
                    <Heading size="5">
                      {section.title}
                      {section.disabled && (
                        <span className="text-sm text-gray-400 ml-2">(Coming Soon)</span>
                      )}
                    </Heading>
                    <Text size="2" className="text-gray-400">
                      {section.description}
                    </Text>
                  </Flex>
                  {!section.disabled && (
                    <Button variant="soft" color="violet">
                      Configure
                    </Button>
                  )}
                </Flex>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Back to Campaigns */}
        <div className="mt-8">
          <Button variant="ghost" onClick={() => router.push('/campaigns')}>
            ← Back to Campaigns
          </Button>
        </div>
      </div>
    </div>
  );
}
