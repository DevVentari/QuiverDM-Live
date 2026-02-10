import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Wireframe black and white palette
        'cream-bg': '#000000',
        'cream-white': '#111111',
        'cream-light': '#1a1a1a',
        'cream-border': '#333333',
        'text-primary': '#ffffff',
        'text-secondary': '#888888',
        'accent-warm': '#ffffff',
        'accent-dark': '#cccccc',
        'accent-light': '#ffffff',
        danger: {
          DEFAULT: '#ffffff',
          dark: '#cccccc',
        },
        success: {
          DEFAULT: '#ffffff',
          dark: '#cccccc',
        },
        info: {
          DEFAULT: '#ffffff',
          dark: '#cccccc',
        },
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
      fontSize: {
        base: ['16px', '1.625'],
      },
      lineHeight: {
        relaxed: '1.625',
      },
      backgroundImage: {
        'parchment-dark': "linear-gradient(to bottom, #111111 0%, #000000 100%)",
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("tailwind-scrollbar-hide")],
};

export default config;
