import { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Minus } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Choose the right QuiverDM plan. Free for casual DMs, Pro for active campaigns, Team for D&D groups.',
};

const tiers = [
  {
    name: 'Free',
    price: '$0/mo',
    description: 'For trying QuiverDM and single-campaign play.',
    cta: 'Get Started',
    href: '/auth/signup',
    popular: false,
    features: [
      { label: 'Campaigns', value: '1' },
      { label: 'Transcription', value: '30 min/mo' },
      { label: 'PDF Uploads', value: '5/mo' },
      { label: 'AI Extraction', value: 'Basic' },
      { label: 'Priority Support', value: false },
    ],
  },
  {
    name: 'Pro',
    price: '$9/mo',
    description: 'For active DMs running multiple sessions every month.',
    cta: 'Start Pro',
    href: '/auth/signup',
    popular: true,
    features: [
      { label: 'Campaigns', value: 'Unlimited' },
      { label: 'Transcription', value: '10 hrs/mo' },
      { label: 'PDF Uploads', value: '50/mo' },
      { label: 'AI Extraction', value: 'Advanced' },
      { label: 'Priority Support', value: true },
    ],
  },
  {
    name: 'Team',
    price: '$19/mo',
    description: 'For groups and power users with heavier content usage.',
    cta: 'Start Team',
    href: '/auth/signup',
    popular: false,
    features: [
      { label: 'Campaigns', value: 'Unlimited' },
      { label: 'Transcription', value: '30 hrs/mo' },
      { label: 'PDF Uploads', value: '200/mo' },
      { label: 'AI Extraction', value: 'Advanced' },
      { label: 'Priority Support', value: true },
    ],
  },
] as const;

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container py-16 space-y-10">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold tracking-tight">Pricing</h1>
          <p className="text-muted-foreground">
            Choose the plan that matches your campaign workload.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {tiers.map((tier) => (
            <Card
              key={tier.name}
              className={tier.popular ? 'border-foreground shadow-sm' : undefined}
            >
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between">
                  <CardTitle>{tier.name}</CardTitle>
                  {tier.popular && <Badge>Most Popular</Badge>}
                </div>
                <div className="text-3xl font-bold">{tier.price}</div>
                <CardDescription>{tier.description}</CardDescription>
                <Button asChild className="w-full">
                  <Link href={tier.href}>{tier.cta}</Link>
                </Button>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  {tier.features.map((feature) => (
                    <li key={feature.label} className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{feature.label}</span>
                      {feature.value === true ? (
                        <Check className="h-4 w-4" />
                      ) : feature.value === false ? (
                        <Minus className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <span className="font-medium">{feature.value}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <Link
            href="/auth/signup"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Ready to get started? Create your account.
          </Link>
        </div>
      </div>
    </div>
  );
}
