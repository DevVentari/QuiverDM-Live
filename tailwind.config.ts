import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        // v3 design-system tokens — resolve to --qd-* CSS vars (src/styles/v3-tokens.css).
        // Additive: the live (app) doesn't use qd-* utilities, so it's unaffected.
        qd: {
          bg: "var(--qd-bg)",
          surface: "var(--qd-surface)",
          surface2: "var(--qd-surface-2)",
          rail: "var(--qd-rail)",
          card: "var(--qd-card)",
          "on-accent": "var(--qd-on-accent)",
          ink: {
            strong: "var(--qd-ink-strong)",
            DEFAULT: "var(--qd-ink)",
            2: "var(--qd-ink-2)",
            muted: "var(--qd-ink-muted)",
            faint: "var(--qd-ink-faint)",
            faintest: "var(--qd-ink-faintest)",
          },
          accent: {
            hi: "var(--qd-accent-hi)",
            text: "var(--qd-accent-text)",
            bright: "var(--qd-accent-bright)",
            DEFAULT: "var(--qd-accent)",
            deep: "var(--qd-accent-deep)",
            deeper: "var(--qd-accent-deeper)",
          },
          success: { hi: "var(--qd-success-hi)", bright: "var(--qd-success-bright)", DEFAULT: "var(--qd-success)", deep: "var(--qd-success-deep)", deeper: "var(--qd-success-deeper)" },
          danger: { hi: "var(--qd-danger-hi)", bright: "var(--qd-danger-bright)", DEFAULT: "var(--qd-danger)", deep: "var(--qd-danger-deep)" },
          warn: { hi: "var(--qd-warn-hi)", DEFAULT: "var(--qd-warn)", deep: "var(--qd-warn-deep)" },
          arcane: { hi: "var(--qd-arcane-hi)", bright: "var(--qd-arcane-bright)", DEFAULT: "var(--qd-arcane)", deep: "var(--qd-arcane-deep)" },
        },
      },
      borderColor: {
        qd: {
          DEFAULT: "var(--qd-border)",
          strong: "var(--qd-border-strong)",
          faint: "var(--qd-border-faint)",
          accent: "var(--qd-border-accent)",
          "accent-strong": "var(--qd-border-accent-strong)",
        },
      },
      backgroundImage: {
        "qd-panel": "var(--qd-grad-panel)",
        "qd-card": "var(--qd-grad-card)",
        "qd-accent": "var(--qd-grad-accent)",
        "qd-success": "var(--qd-grad-success)",
        "qd-danger": "var(--qd-grad-danger)",
      },
      boxShadow: {
        "qd-card": "var(--qd-shadow-card)",
        "qd-panel": "var(--qd-shadow-panel)",
        "qd-token": "var(--qd-shadow-token)",
        "qd-accent": "var(--qd-shadow-accent)",
        "qd-glow-active": "var(--qd-glow-active)",
      },
      fontSize: {
        "qd-display-2xl": ["var(--qd-text-display-2xl)", { lineHeight: "1", fontWeight: "700" }],
        "qd-display-xl": ["var(--qd-text-display-xl)", { lineHeight: "1", fontWeight: "700" }],
        "qd-title": ["var(--qd-text-title)", { lineHeight: "1.05", fontWeight: "700" }],
        "qd-narration": ["var(--qd-text-narration)", { lineHeight: "1.55" }],
        "qd-body-lg": ["var(--qd-text-body-lg)", { lineHeight: "1.55" }],
        "qd-body": ["var(--qd-text-body)", { lineHeight: "1.55" }],
        "qd-body-sm": ["var(--qd-text-body-sm)", { lineHeight: "1.5" }],
        "qd-label": ["var(--qd-text-label)", { letterSpacing: "0.16em" }],
      },
      transitionTimingFunction: {
        "qd-out": "var(--qd-ease-out)",
        "qd-spring": "var(--qd-ease-spring)",
        "qd-inout": "var(--qd-ease-inout)",
      },
      transitionDuration: {
        "qd-fast": "var(--qd-dur-fast)",
        "qd-base": "var(--qd-dur-base)",
        "qd-slow": "var(--qd-dur-slow)",
        "qd-ambient": "var(--qd-dur-ambient)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "qd-sm": "var(--qd-radius-sm)",
        "qd-md": "var(--qd-radius-md)",
        "qd-lg": "var(--qd-radius-lg)",
        "qd-xl": "var(--qd-radius-xl)",
        "qd-2xl": "var(--qd-radius-2xl)",
        "qd-panel": "var(--qd-radius-panel)",
        "qd-pill": "var(--qd-radius-pill)",
        "qd-phone": "var(--qd-radius-phone)",
      },
      fontFamily: {
        sans: ["var(--font-bricolage)", "system-ui", "sans-serif"],
        serif: ["var(--font-cinzel)", "Georgia", "serif"],
        display: ["var(--font-cinzel)", "serif"],
        cinzel: ["var(--font-cinzel)", "Georgia", "serif"],
        bricolage: ["var(--font-bricolage)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
        "qd-display": ["var(--qd-font-display)", "Kalam", "cursive"],
        "qd-body": ["var(--qd-font-body)", "system-ui", "sans-serif"],
        "qd-mono": ["var(--qd-font-mono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: 'var(--foreground)',
            h1: {
              fontFamily: 'var(--font-cinzel), Georgia, serif',
              color: 'var(--foreground)',
              fontWeight: '700',
              letterSpacing: '0.03em',
              borderBottom: '2px solid var(--border)',
              paddingBottom: '0.5rem',
              marginBottom: '1rem',
            },
            h2: {
              fontFamily: 'var(--font-cinzel), Georgia, serif',
              color: 'var(--foreground)',
              fontWeight: '600',
              letterSpacing: '0.025em',
              borderBottom: '1px solid var(--border)',
              paddingBottom: '0.25rem',
              marginTop: '2rem',
            },
            h3: {
              fontFamily: 'var(--font-cinzel), Georgia, serif',
              color: 'var(--foreground)',
              fontWeight: '600',
              letterSpacing: '0.02em',
            },
            h4: {
              fontFamily: 'var(--font-cinzel), Georgia, serif',
              color: 'var(--foreground)',
              fontWeight: '600',
              letterSpacing: '0.02em',
            },
            strong: {
              color: 'var(--foreground)',
              fontWeight: '600',
            },
            a: {
              color: 'var(--foreground)',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
              '&:hover': {
                color: 'var(--muted-foreground)',
              },
            },
            code: {
              fontFamily: 'var(--font-mono), ui-monospace, SFMono-Regular, monospace',
              color: 'var(--foreground)',
              backgroundColor: 'var(--muted)',
              padding: '0.125rem 0.25rem',
              borderRadius: '0.25rem',
              fontWeight: '500',
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
            pre: {
              backgroundColor: 'var(--muted)',
              border: '1px solid var(--border)',
              borderRadius: '0.375rem',
            },
            blockquote: {
              borderLeftColor: 'var(--border)',
              borderLeftWidth: '4px',
              color: 'var(--muted-foreground)',
            },
            table: {
              borderColor: 'var(--border)',
            },
            thead: {
              borderBottomColor: 'var(--border)',
              borderBottomWidth: '2px',
            },
            'thead th': {
              color: 'var(--foreground)',
              fontWeight: '600',
            },
            'tbody tr': {
              borderBottomColor: 'var(--border)',
            },
            'tbody td': {
              color: 'var(--foreground)',
            },
            hr: {
              borderColor: 'var(--border)',
            },
            ul: {
              listStyleType: 'disc',
            },
            ol: {
              listStyleType: 'decimal',
            },
          },
        },
      },
    },
  },
  plugins: [
    tailwindcssAnimate,
    typography,
  ],
};

export default config;

