'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Star } from 'lucide-react';

type FeedbackType = 'bug' | 'feature' | 'improvement' | 'other';
type FeedbackCategory = 'transcription' | 'pdf' | 'ui' | 'performance' | 'other';

const typeOptions: { value: FeedbackType; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature' },
  { value: 'improvement', label: 'Improvement' },
  { value: 'other', label: 'Other' },
];

const categoryOptions: { value: FeedbackCategory; label: string }[] = [
  { value: 'transcription', label: 'Transcription' },
  { value: 'pdf', label: 'PDF' },
  { value: 'ui', label: 'UI' },
  { value: 'performance', label: 'Performance' },
  { value: 'other', label: 'Other' },
];

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (s) => s.toUpperCase());
}

function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'outline' {
  switch (status) {
    case 'resolved':
      return 'default';
    case 'in_progress':
      return 'secondary';
    default:
      return 'outline';
  }
}

export default function FeedbackPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [type, setType] = useState<FeedbackType>('bug');
  const [category, setCategory] = useState<FeedbackCategory | 'none'>('none');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rating, setRating] = useState<number>(0);

  const feedbackList = trpc.feedback.getMyFeedback.useQuery({ limit: 50 }, { staleTime: 10_000 });

  const createFeedback = trpc.feedback.create.useMutation({
    onSuccess: async () => {
      toast({
        title: 'Feedback submitted',
        description: 'Thanks for helping improve QuiverDM.',
      });
      setType('bug');
      setCategory('none');
      setTitle('');
      setDescription('');
      setRating(0);
      await feedbackList.refetch();
      await utils.feedback.getMyFeedback.invalidate({ limit: 50 });
    },
    onError: (error) => {
      toast({
        title: 'Submission failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    createFeedback.mutate({
      type,
      title: title.trim(),
      description: description.trim(),
      category: category === 'none' ? undefined : category,
      rating: rating > 0 ? rating : undefined,
    });
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="mb-6">
        <p className="label-overline mb-0.5">Support</p>
        <h1 className="text-xl font-display font-bold tracking-wide">Send Feedback</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-[2fr_1fr] items-start">
        {/* Left: form */}
        <div className="space-y-6">
          <div className="stone-card">
            <div className="stone-card-header">
              <span className="stone-card-title">Share Feedback</span>
              <p className="text-sm text-muted-foreground">
                Report issues, request features, or suggest improvements.
              </p>
            </div>
            <div className="stone-card-body">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={type}
                      onValueChange={(value: FeedbackType) => setType(value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {typeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Category (Optional)</Label>
                    <Select
                      value={category}
                      onValueChange={(value: FeedbackCategory | 'none') => setCategory(value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {categoryOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feedback-title">Title</Label>
                  <Input
                    id="feedback-title"
                    placeholder="Short summary"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    minLength={3}
                    maxLength={200}
                    required
                    aria-describedby="feedback-title-hint"
                  />
                  <p id="feedback-title-hint" className="text-xs text-muted-foreground">
                    3 to 200 characters required.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feedback-description">Description</Label>
                  <Textarea
                    id="feedback-description"
                    placeholder="Include steps, expected behavior, and actual behavior."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    minLength={10}
                    rows={6}
                    required
                    aria-describedby="feedback-description-hint"
                  />
                  <p id="feedback-description-hint" className="text-xs text-muted-foreground">
                    Minimum 10 characters. Include steps, expected behavior, and actual behavior.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Rating (Optional)</Label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Button
                        key={value}
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setRating((prev) => (prev === value ? 0 : value))}
                        aria-label={`Set rating to ${value}`}
                      >
                        <Star
                          className={`h-4 w-4 ${
                            value <= rating ? 'fill-foreground text-foreground' : 'text-muted-foreground'
                          }`}
                        />
                      </Button>
                    ))}
                    {rating > 0 && (
                      <span className="text-sm text-muted-foreground">{rating} / 5</span>
                    )}
                  </div>
                </div>

                <Button type="submit" disabled={createFeedback.isPending}>
                  {createFeedback.isPending ? 'Submitting...' : 'Submit Feedback'}
                </Button>
              </form>
            </div>
          </div>

          <div className="stone-card">
            <div className="stone-card-header">
              <span className="stone-card-title">My Feedback</span>
              <p className="text-sm text-muted-foreground">Your recent submissions</p>
            </div>
            <div className="stone-card-body">
              {feedbackList.isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 rounded-lg" />
                  ))}
                </div>
              ) : feedbackList.data && feedbackList.data.length > 0 ? (
                <div className="space-y-3">
                  {(feedbackList.data as any[]).map((item) => (
                    <div key={item.id} className="rounded-lg border p-4 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-medium">{item.title}</h3>
                        <Badge variant={getStatusBadgeVariant(item.status)}>
                          {formatLabel(item.status)}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatLabel(item.type)}</span>
                        {item.category && <span>| {formatLabel(item.category)}</span>}
                        {item.rating && <span>| Rating {item.rating}/5</span>}
                        <span>| {new Date(item.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  You have not submitted feedback yet.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right: sidebar */}
        <div className="stone-card">
          <div className="stone-card-header">
            <span className="stone-card-title">What we look for</span>
          </div>
          <div className="stone-card-body space-y-3 text-sm text-muted-foreground">
            <p>Bug reports with reproduction steps</p>
            <p>Missing features you need at the table</p>
            <p>UX friction — things that slow you down mid-session</p>
            <p>Anything that broke your immersion</p>
          </div>
        </div>
      </div>
    </div>
  );
}
