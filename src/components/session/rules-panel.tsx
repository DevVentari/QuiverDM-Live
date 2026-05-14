'use client';

import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Loader2, Search } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

export function RulesPanel() {
  const [question, setQuestion] = useState('');
  const [submittedQuestion, setSubmittedQuestion] = useState('');
  const [expandedSources, setExpandedSources] = useState(false);

  const { data: result, isFetching } = trpc.rules.lookup.useQuery(
    { question: submittedQuestion },
    { enabled: submittedQuestion.length >= 3 }
  );

  const submitQuestion = () => {
    const trimmed = question.trim();
    if (trimmed.length < 3) return;
    setExpandedSources(false);
    setSubmittedQuestion(trimmed);
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="fixed bottom-4 right-4 z-10 shadow-lg"
        >
          <BookOpen className="mr-2 h-4 w-4" />
          Rules
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full overflow-y-auto sm:w-[420px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Rules Companion
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4 px-5">
          <div className="flex gap-2">
            <Input
              placeholder="Ask a rules question..."
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submitQuestion();
                }
              }}
            />
            <Button
              size="sm"
              onClick={submitQuestion}
              disabled={question.trim().length < 3 || isFetching}
            >
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {isFetching && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Looking up rules...
            </div>
          )}

          {result && !isFetching && (
            <div className="space-y-3">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm">{result.answer}</p>
                </CardContent>
              </Card>

              {result.sources.length > 0 && (
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-xs text-muted-foreground"
                    onClick={() => setExpandedSources((value) => !value)}
                  >
                    {expandedSources ? (
                      <ChevronUp className="mr-1 h-3 w-3" />
                    ) : (
                      <ChevronDown className="mr-1 h-3 w-3" />
                    )}
                    {result.sources.length} source
                    {result.sources.length !== 1 ? 's' : ''}
                  </Button>

                  {expandedSources && (
                    <div className="mt-2 space-y-2">
                      {result.sources.map((source, index) => (
                        <div
                          key={`${source.source}-${index}`}
                          className="rounded border bg-muted/30 p-2 text-xs"
                        >
                          <p className="mb-1 font-medium text-muted-foreground">
                            from: {source.source}
                          </p>
                          <p className="line-clamp-3">{source.chunkText}...</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Try asking:</p>
            {[
              'How does grappling work?',
              'What conditions cause disadvantage?',
              'How is spell save DC calculated?',
            ].map((presetQuestion) => (
              <button
                key={presetQuestion}
                className="block text-left text-xs text-primary hover:underline"
                onClick={() => {
                  setQuestion(presetQuestion);
                  setSubmittedQuestion(presetQuestion);
                }}
              >
                {presetQuestion}
              </button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
