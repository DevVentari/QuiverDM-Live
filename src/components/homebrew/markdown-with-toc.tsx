'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { cn } from '@/lib/utils';

interface TocEntry {
  id: string;
  text: string;
  level: number;
}

function buildToc(markdown: string): TocEntry[] {
  const entries: TocEntry[] = [];
  const lines = markdown.split('\n');
  const seen = new Map<string, number>();

  for (const line of lines) {
    const m = line.match(/^(#{1,3})\s+(.+)$/);
    if (!m) continue;
    const level = m[1].length;
    const text = m[2].replace(/[*_`[\]]/g, '').trim();
    // Replicate rehype-slug's id generation
    let id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const count = seen.get(id) ?? 0;
    seen.set(id, count + 1);
    if (count > 0) id = `${id}-${count}`;
    entries.push({ id, text, level });
  }
  return entries;
}

interface Props {
  markdown: string;
}

export function MarkdownWithTOC({ markdown }: Props) {
  const [activeId, setActiveId] = useState<string>('');
  const [tocOpen, setTocOpen] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const toc = buildToc(markdown);
  const hasToc = toc.length > 2;

  // Scroll-spy: update activeId as user scrolls
  useEffect(() => {
    if (!hasToc) return;
    const headings = contentRef.current?.querySelectorAll('h1, h2, h3');
    if (!headings?.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '0px 0px -70% 0px', threshold: 0 }
    );

    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [markdown, hasToc]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
  };

  return (
    <div className="flex gap-6">
      {/* TOC Sidebar */}
      {hasToc && (
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-6">
            <button
              onClick={() => setTocOpen((o) => !o)}
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-amber-500/80 mb-3 hover:text-amber-400 transition-colors"
            >
              <span>{tocOpen ? '▾' : '▸'}</span>
              Contents
            </button>
            {tocOpen && (
              <nav className="space-y-0.5 border-l border-white/10">
                {toc.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => scrollTo(entry.id)}
                    className={cn(
                      'block w-full text-left text-xs leading-snug py-1 transition-colors',
                      entry.level === 1 && 'pl-3 font-medium',
                      entry.level === 2 && 'pl-5',
                      entry.level === 3 && 'pl-7 text-[11px]',
                      activeId === entry.id
                        ? 'text-amber-400 border-l-2 border-amber-500 -ml-px pl-[calc(theme(spacing.3)-1px)]'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    style={
                      activeId === entry.id && entry.level > 1
                        ? { paddingLeft: `calc(${(entry.level - 1) * 8 + 12}px - 1px)` }
                        : entry.level > 1
                        ? { paddingLeft: `${(entry.level - 1) * 8 + 12}px` }
                        : undefined
                    }
                  >
                    {entry.text}
                  </button>
                ))}
              </nav>
            )}
          </div>
        </aside>
      )}

      {/* Markdown Content */}
      <div ref={contentRef} className="min-w-0 flex-1">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[
            rehypeSlug,
            [rehypeAutolinkHeadings, { behavior: 'wrap' }],
          ]}
          components={{
            // Headings — amber accent, anchor wrapper from rehype handles the link
            h1: ({ children, ...props }) => (
              <h1
                {...props}
                className="mt-8 mb-4 text-2xl font-bold text-amber-400 border-b border-white/10 pb-2 scroll-mt-6 first:mt-0"
              >
                {children}
              </h1>
            ),
            h2: ({ children, ...props }) => (
              <h2
                {...props}
                className="mt-6 mb-3 text-lg font-semibold text-amber-300/90 scroll-mt-6"
              >
                {children}
              </h2>
            ),
            h3: ({ children, ...props }) => (
              <h3
                {...props}
                className="mt-4 mb-2 text-base font-semibold text-foreground/90 scroll-mt-6"
              >
                {children}
              </h3>
            ),
            // Tables — styled for dark mode with horizontal scroll
            table: ({ children }) => (
              <div className="my-4 overflow-x-auto rounded-lg border border-white/10">
                <table className="w-full text-sm">{children}</table>
              </div>
            ),
            thead: ({ children }) => (
              <thead className="bg-white/5 text-xs uppercase tracking-wide text-muted-foreground">
                {children}
              </thead>
            ),
            th: ({ children }) => (
              <th className="px-3 py-2 text-left font-medium">{children}</th>
            ),
            td: ({ children }) => (
              <td className="border-t border-white/5 px-3 py-2">{children}</td>
            ),
            tr: ({ children }) => (
              <tr className="even:bg-white/[0.02]">{children}</tr>
            ),
            // Paragraphs
            p: ({ children }) => (
              <p className="mb-3 leading-relaxed text-foreground/80">{children}</p>
            ),
            // Lists
            ul: ({ children }) => (
              <ul className="mb-3 ml-4 list-disc space-y-1 text-foreground/80">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="mb-3 ml-4 list-decimal space-y-1 text-foreground/80">{children}</ol>
            ),
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            // Code
            code: ({ children, className }) => {
              const isBlock = className?.includes('language-');
              return isBlock ? (
                <code className="block rounded-md bg-black/40 px-4 py-3 text-xs font-mono text-foreground/90 overflow-x-auto">
                  {children}
                </code>
              ) : (
                <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs font-mono text-amber-300/80">
                  {children}
                </code>
              );
            },
            pre: ({ children }) => <pre className="mb-4">{children}</pre>,
            // Horizontal rule — section divider
            hr: () => <hr className="my-6 border-white/10" />,
            // Blockquote — flavour text / lore boxes
            blockquote: ({ children }) => (
              <blockquote className="my-4 border-l-2 border-amber-500/40 pl-4 italic text-muted-foreground">
                {children}
              </blockquote>
            ),
            // Links from rehype-autolink-headings
            a: ({ children, href }) => (
              <a
                href={href}
                className="text-amber-400/70 hover:text-amber-400 transition-colors no-underline hover:underline"
              >
                {children}
              </a>
            ),
          }}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </div>
  );
}
