/* ============================================================
   QuiverDM — Tailwind theme extension v1.0
   Drop into tailwind.config.js (or import & spread theme.extend).
   Values mirror tokens.css / tokens.json exactly.
   ============================================================ */

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        display: ["Kalam", "cursive"],            // titles, names, narration
        body: ["Hanken Grotesk", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        qd: {
          bg: "#0a0707",
          surface: "#16110e",
          surface2: "#100b09",
          rail: "#0d0908",
          card: "#1b1512",
          onAccent: "#1a0f06",
          ink: {
            strong: "#f6ead8",
            DEFAULT: "#ece2d4",
            2: "#cdbfae",
            muted: "#9c8a76",
            faint: "#7f6f5e",
            faintest: "#5a4f45",
          },
          accent: {
            hi: "#f0d6b2",
            text: "#e9b277",
            bright: "#e0944a",
            DEFAULT: "#d98a3d",
            deep: "#c97a30",
            deeper: "#b8662a",
          },
          success: { hi: "#bcd1a4", bright: "#8fc466", DEFAULT: "#7fae5a", deep: "#5f8f45", deeper: "#3f5f2a" },
          danger:  { hi: "#e6a99f", bright: "#e0584a", DEFAULT: "#c4453a", deep: "#8a2f26" },
          warn:    { hi: "#ef9a5f", DEFAULT: "#cf6f2a", deep: "#a8401f" },
          arcane:  { hi: "#d6c8e4", bright: "#cbb8e0", DEFAULT: "#b08fd0", deep: "#7a5fb0" },
        },
      },
      borderColor: {
        qd: {
          DEFAULT: "rgba(255,235,205,0.10)",
          strong: "rgba(255,235,205,0.16)",
          faint: "rgba(255,235,205,0.06)",
          accent: "rgba(217,138,61,0.40)",
          accentStrong: "rgba(217,138,61,0.50)",
        },
      },
      backgroundImage: {
        "qd-panel": "linear-gradient(180deg, #16110e, #100b09)",
        "qd-card": "linear-gradient(180deg, rgba(255,255,255,.035), rgba(0,0,0,.15))",
        "qd-accent": "linear-gradient(180deg, #e0944a, #c97a30)",
        "qd-success": "linear-gradient(90deg, #5f8f45, #8fc466)",
        "qd-danger": "linear-gradient(90deg, #8a2f26, #c4453a)",
      },
      spacing: {
        "qd-1": "4px", "qd-2": "8px", "qd-3": "12px", "qd-4": "16px",
        "qd-5": "20px", "qd-6": "24px", "qd-8": "32px", "qd-10": "40px",
      },
      borderRadius: {
        "qd-sm": "8px", "qd-md": "10px", "qd-lg": "12px", "qd-xl": "14px",
        "qd-2xl": "16px", "qd-panel": "18px", "qd-pill": "20px", "qd-phone": "30px",
      },
      boxShadow: {
        "qd-card": "0 30px 70px rgba(0,0,0,.4)",
        "qd-panel": "0 40px 90px rgba(0,0,0,.6)",
        "qd-token": "0 4px 14px rgba(0,0,0,.5)",
        "qd-accent": "0 8px 20px rgba(217,138,61,.3)",
        "qd-glow-active": "0 0 0 1px rgba(217,138,61,.9), 0 0 26px rgba(217,138,61,.4)",
      },
      fontSize: {
        "qd-display-2xl": ["56px", { lineHeight: "1", fontWeight: "700" }],
        "qd-display-xl": ["30px", { lineHeight: "1", fontWeight: "700" }],
        "qd-title": ["22px", { lineHeight: "1.05", fontWeight: "700" }],
        "qd-narration": ["18px", { lineHeight: "1.55" }],
        "qd-body-lg": ["16px", { lineHeight: "1.55" }],
        "qd-body": ["14px", { lineHeight: "1.55" }],
        "qd-body-sm": ["12px", { lineHeight: "1.5" }],
        "qd-label": ["9px", { letterSpacing: "0.16em" }],
      },
      transitionTimingFunction: {
        "qd-out": "cubic-bezier(.2,.8,.2,1)",
        "qd-spring": "cubic-bezier(.34,1.56,.64,1)",
        "qd-inout": "cubic-bezier(.65,0,.35,1)",
      },
      transitionDuration: {
        "qd-fast": "150ms",
        "qd-base": "250ms",
        "qd-slow": "400ms",
        "qd-ambient": "2400ms",
      },
    },
  },
};
