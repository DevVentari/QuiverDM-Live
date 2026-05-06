'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function CharacterBackground({ data }: { data: any }) {
  const appearance = data.appearance as Record<string, string | null> | null;
  const hasTraits =
    data.personalityTraits || data.ideals || data.bonds || data.flaws;
  const hasAppearance =
    appearance &&
    Object.values(appearance).some((v) => v != null && v !== '');

  if (!data.backstory && !hasTraits && !hasAppearance) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No background information available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Backstory */}
      {data.backstory && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm tracking-wide">Backstory</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">
              {data.backstory}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Personality Traits grid */}
      {hasTraits && (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.personalityTraits && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Personality Traits</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {data.personalityTraits}
                </p>
              </CardContent>
            </Card>
          )}
          {data.ideals && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Ideals</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {data.ideals}
                </p>
              </CardContent>
            </Card>
          )}
          {data.bonds && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Bonds</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {data.bonds}
                </p>
              </CardContent>
            </Card>
          )}
          {data.flaws && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Flaws</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {data.flaws}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Appearance */}
      {hasAppearance && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              {[
                { label: 'Height', key: 'height' },
                { label: 'Weight', key: 'weight' },
                { label: 'Eyes', key: 'eyes' },
                { label: 'Skin', key: 'skin' },
                { label: 'Hair', key: 'hair' },
                { label: 'Age', key: 'age' },
                { label: 'Gender', key: 'gender' },
                { label: 'Faith', key: 'faith' },
              ]
                .filter((f) => appearance![f.key])
                .map((f) => (
                  <div key={f.key}>
                    <div className="text-xs text-muted-foreground">{f.label}</div>
                    <div className="font-medium">{appearance![f.key]}</div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
