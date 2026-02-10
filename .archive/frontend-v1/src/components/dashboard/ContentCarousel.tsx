'use client';

import { useRef, useState, useEffect } from 'react';
import { Card, Text } from '@radix-ui/themes';
import Link from 'next/link';

interface ContentItem {
  id: string;
  name: string;
  subtitle?: string;
  image?: string | null;
  href: string;
  icon?: string;
}

interface ContentCarouselProps {
  title: string;
  items: ContentItem[];
  emptyIcon?: string;
  emptyText?: string;
  createHref?: string;
  createText?: string;
  isLoading?: boolean;
}

export function ContentCarousel({
  title,
  items,
  emptyIcon = '📦',
  emptyText = 'No items yet',
  createHref,
  createText = 'Create New',
  isLoading = false,
}: ContentCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [items]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const cardWidth = 180; // Approximate card width + gap
      const scrollAmount = cardWidth * 3;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
      setTimeout(checkScroll, 300);
    }
  };

  if (isLoading) {
    return (
      <section className="mb-6">
        <h3 className="font-display text-text-primary text-lg mb-3">{title}</h3>
        <div className="flex gap-3 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-40 h-28 bg-cream-light/50 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mb-6">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-display text-text-primary text-lg">{title}</h3>
        {(canScrollLeft || canScrollRight) && (
          <div className="flex gap-1">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className="p-1.5 rounded-full bg-cream-light hover:bg-cream-border disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <svg className="w-4 h-4 text-text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className="p-1.5 rounded-full bg-cream-light hover:bg-cream-border disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <svg className="w-4 h-4 text-text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide scroll-smooth"
      >
        {items.length === 0 ? (
          <Card className="flex-shrink-0 w-full max-w-sm bg-cream-white/30 border border-dashed border-cream-border p-6 text-center">
            <div className="text-3xl mb-2">{emptyIcon}</div>
            <Text className="text-text-secondary text-sm block">{emptyText}</Text>
            {createHref && (
              <Link
                href={createHref}
                className="text-accent-warm hover:text-accent-light text-sm mt-2 inline-block"
              >
                {createText} &rarr;
              </Link>
            )}
          </Card>
        ) : (
          <>
            {items.map((item) => (
              <Link key={item.id} href={item.href}>
                <Card className="flex-shrink-0 w-40 bg-cream-white border border-cream-border hover:border-accent-warm p-3 cursor-pointer transition-all group">
                  {item.image ? (
                    <div className="w-full h-16 rounded-md bg-cream-light mb-2 overflow-hidden">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-16 rounded-md bg-cream-light mb-2 flex items-center justify-center text-2xl">
                      {item.icon || '📄'}
                    </div>
                  )}
                  <Text className="text-text-primary font-medium text-sm truncate block group-hover:text-accent-warm transition-colors">
                    {item.name}
                  </Text>
                  {item.subtitle && (
                    <Text className="text-text-secondary text-xs truncate block">
                      {item.subtitle}
                    </Text>
                  )}
                </Card>
              </Link>
            ))}
            {createHref && (
              <Link href={createHref}>
                <Card className="flex-shrink-0 w-40 bg-cream-white/50 border border-dashed border-cream-border hover:border-accent-warm p-3 cursor-pointer transition-all group h-full min-h-[7rem] flex flex-col items-center justify-center">
                  <div className="text-2xl mb-1 opacity-50 group-hover:opacity-100 transition-opacity">+</div>
                  <Text className="text-text-secondary text-xs group-hover:text-accent-warm transition-colors">
                    {createText}
                  </Text>
                </Card>
              </Link>
            )}
          </>
        )}
      </div>
    </section>
  );
}
