'use client';

import { cn } from '@/lib/utils';

type DieIconProps = {
  sides: number;
  className?: string;
  size?: number;
};

/**
 * SVG polyhedral dice icons.
 *
 * Renders a distinctive shape for each standard die type (d4, d6, d8, d10, d12, d20).
 * Uses currentColor for stroke so Tailwind text-* classes control the color.
 */
export function DieIcon({ sides, className, size = 24 }: DieIconProps) {
  const svgProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: cn('inline-block shrink-0', className),
  };

  switch (sides) {
    // d4 - Triangle (tetrahedron face)
    case 4:
      return (
        <svg {...svgProps}>
          <polygon points="12,3 3,21 21,21" />
          <text
            x="12"
            y="17"
            textAnchor="middle"
            fill="currentColor"
            stroke="none"
            fontSize="7"
            fontWeight="bold"
            fontFamily="system-ui"
          >
            4
          </text>
        </svg>
      );

    // d6 - Square (cube face)
    case 6:
      return (
        <svg {...svgProps}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <text
            x="12"
            y="15.5"
            textAnchor="middle"
            fill="currentColor"
            stroke="none"
            fontSize="8"
            fontWeight="bold"
            fontFamily="system-ui"
          >
            6
          </text>
        </svg>
      );

    // d8 - Diamond (octahedron face)
    case 8:
      return (
        <svg {...svgProps}>
          <polygon points="12,2 22,12 12,22 2,12" />
          <text
            x="12"
            y="15"
            textAnchor="middle"
            fill="currentColor"
            stroke="none"
            fontSize="7"
            fontWeight="bold"
            fontFamily="system-ui"
          >
            8
          </text>
        </svg>
      );

    // d10 - Elongated diamond (pentagonal trapezohedron)
    case 10:
      return (
        <svg {...svgProps}>
          <polygon points="12,1 21,9 18,22 6,22 3,9" />
          <text
            x="12"
            y="16"
            textAnchor="middle"
            fill="currentColor"
            stroke="none"
            fontSize="7"
            fontWeight="bold"
            fontFamily="system-ui"
          >
            10
          </text>
        </svg>
      );

    // d12 - Pentagon (dodecahedron face)
    case 12:
      return (
        <svg {...svgProps}>
          <polygon points="12,2 21,8 18.5,19 5.5,19 3,8" />
          <text
            x="12"
            y="15"
            textAnchor="middle"
            fill="currentColor"
            stroke="none"
            fontSize="7"
            fontWeight="bold"
            fontFamily="system-ui"
          >
            12
          </text>
        </svg>
      );

    // d20 - Hexagon-ish shape (icosahedron face)
    case 20:
      return (
        <svg {...svgProps}>
          <polygon points="12,2 21,6 21,18 12,22 3,18 3,6" />
          <line x1="12" y1="2" x2="12" y2="22" strokeOpacity="0.3" />
          <line x1="3" y1="6" x2="21" y2="18" strokeOpacity="0.3" />
          <line x1="21" y1="6" x2="3" y2="18" strokeOpacity="0.3" />
          <text
            x="12"
            y="15"
            textAnchor="middle"
            fill="currentColor"
            stroke="none"
            fontSize="7"
            fontWeight="bold"
            fontFamily="system-ui"
          >
            20
          </text>
        </svg>
      );

    // Fallback: generic die shape with the number displayed
    default:
      return (
        <svg {...svgProps}>
          <polygon points="12,2 21,6 21,18 12,22 3,18 3,6" />
          <text
            x="12"
            y="15"
            textAnchor="middle"
            fill="currentColor"
            stroke="none"
            fontSize={sides >= 100 ? '5' : '7'}
            fontWeight="bold"
            fontFamily="system-ui"
          >
            {sides}
          </text>
        </svg>
      );
  }
}
