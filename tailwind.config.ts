import type { Config } from "tailwindcss";

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
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-cinzel)", "serif"],
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
            color: 'hsl(var(--foreground))',
            h1: {
              color: 'hsl(var(--foreground))',
              fontWeight: '700',
              borderBottom: '2px solid hsl(var(--border))',
              paddingBottom: '0.5rem',
              marginBottom: '1rem',
            },
            h2: {
              color: 'hsl(var(--foreground))',
              fontWeight: '600',
              borderBottom: '1px solid hsl(var(--border))',
              paddingBottom: '0.25rem',
              marginTop: '2rem',
            },
            h3: {
              color: 'hsl(var(--foreground))',
              fontWeight: '600',
            },
            h4: {
              color: 'hsl(var(--foreground))',
              fontWeight: '600',
            },
            strong: {
              color: 'hsl(var(--foreground))',
              fontWeight: '600',
            },
            a: {
              color: 'hsl(var(--foreground))',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
              '&:hover': {
                color: 'hsl(var(--muted-foreground))',
              },
            },
            code: {
              color: 'hsl(var(--foreground))',
              backgroundColor: 'hsl(var(--muted))',
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
              backgroundColor: 'hsl(var(--muted))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '0.375rem',
            },
            blockquote: {
              borderLeftColor: 'hsl(var(--border))',
              borderLeftWidth: '4px',
              color: 'hsl(var(--muted-foreground))',
            },
            table: {
              borderColor: 'hsl(var(--border))',
            },
            thead: {
              borderBottomColor: 'hsl(var(--border))',
              borderBottomWidth: '2px',
            },
            'thead th': {
              color: 'hsl(var(--foreground))',
              fontWeight: '600',
            },
            'tbody tr': {
              borderBottomColor: 'hsl(var(--border))',
            },
            'tbody td': {
              color: 'hsl(var(--foreground))',
            },
            hr: {
              borderColor: 'hsl(var(--border))',
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
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
  ],
};

export default config;
