import {
  BadgeCheck,
  BookOpen,
  Brush,
  KeyRound,
  ShieldAlert,
  Sparkles,
  UserCircle2,
} from 'lucide-react';

export interface KeyConfig {
  name: 'geminiApiKey' | 'openaiApiKey' | 'anthropicApiKey' | 'huggingfaceToken' | 'dndBeyondCobaltCookie';
  label: string;
  placeholder: string;
  hasField: 'hasGeminiApiKey' | 'hasOpenaiApiKey' | 'hasAnthropicApiKey' | 'hasHuggingfaceToken' | 'hasDndBeyondCobaltCookie';
  maskedField: 'maskedGeminiApiKey' | 'maskedOpenaiApiKey' | 'maskedAnthropicApiKey' | 'maskedHuggingfaceToken' | 'maskedDndBeyondCobaltCookie';
  description?: string;
  badge?: string;
}

export const keyConfigs: KeyConfig[] = [
  {
    name: 'geminiApiKey',
    label: 'Google Gemini API Key',
    placeholder: 'AIza...',
    hasField: 'hasGeminiApiKey',
    maskedField: 'maskedGeminiApiKey',
    description: 'Recommended for most DMs. Gemini gives you a generous free tier and powers extraction well.',
    badge: 'Recommended',
  },
  {
    name: 'openaiApiKey',
    label: 'OpenAI API Key',
    placeholder: 'sk-...',
    hasField: 'hasOpenaiApiKey',
    maskedField: 'maskedOpenaiApiKey',
  },
  {
    name: 'anthropicApiKey',
    label: 'Anthropic API Key',
    placeholder: 'sk-ant-...',
    hasField: 'hasAnthropicApiKey',
    maskedField: 'maskedAnthropicApiKey',
  },
  {
    name: 'huggingfaceToken',
    label: 'Hugging Face Token',
    placeholder: 'hf_...',
    hasField: 'hasHuggingfaceToken',
    maskedField: 'maskedHuggingfaceToken',
  },
  {
    name: 'dndBeyondCobaltCookie',
    label: 'D&D Beyond Cobalt Cookie',
    placeholder: 'Cobalt session cookie',
    hasField: 'hasDndBeyondCobaltCookie',
    maskedField: 'maskedDndBeyondCobaltCookie',
  },
];

export const settingsNavItems = [
  {
    href: '/settings',
    label: 'Overview',
    description: 'Your account status, shortcuts, and system posture.',
    icon: Sparkles,
    match: (pathname: string) => pathname === '/settings',
  },
  {
    href: '/settings/profile',
    label: 'Profile',
    description: 'Identity, display name, and table-facing bio.',
    icon: UserCircle2,
    match: (pathname: string) => pathname === '/settings/profile',
  },
  {
    href: '/settings/ai',
    label: 'AI & Usage',
    description: 'Model keys, provider state, and usage visibility.',
    icon: KeyRound,
    match: (pathname: string) => pathname.startsWith('/settings/ai') || pathname.startsWith('/settings/api-usage'),
  },
  {
    href: '/settings/integrations',
    label: 'Integrations',
    description: 'External libraries and linked services.',
    icon: BookOpen,
    match: (pathname: string) => pathname.startsWith('/settings/integrations') || pathname.startsWith('/settings/ddb'),
  },
  {
    href: '/settings/appearance',
    label: 'Appearance',
    description: 'Atmosphere, motion, and ambient presentation.',
    icon: Brush,
    match: (pathname: string) => pathname === '/settings/appearance',
  },
  {
    href: '/settings/account',
    label: 'Account',
    description: 'Password, session ownership, and irreversible actions.',
    icon: BadgeCheck,
    match: (pathname: string) => pathname === '/settings/account',
  },
  {
    href: '/settings/admin',
    label: 'Admin',
    description: 'Platform operations for wardens and mythkeepers.',
    icon: ShieldAlert,
    match: (pathname: string) => pathname === '/settings/admin',
    adminOnly: true,
  },
] as const;
