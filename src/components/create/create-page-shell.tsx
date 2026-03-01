import React from 'react';

interface CreatePageShellProps {
  overline: string;
  title: string;
  preview: React.ReactNode;
  children: React.ReactNode;
}

export function CreatePageShell({ overline, title, preview, children }: CreatePageShellProps) {
  return (
    <div className="max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8">
      <div>
        <p className="label-overline mb-1">{overline}</p>
        <h1 className="font-display text-3xl font-bold tracking-wide">{title}</h1>
      </div>
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <div className="w-full lg:w-[38%] shrink-0 lg:sticky lg:top-6">
          {preview}
        </div>
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
