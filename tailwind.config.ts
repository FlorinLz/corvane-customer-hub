import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// Brief section 5.1.2. Maps brand tokens (defined as CSS variables in
// src/app/globals.css, brief 5.1.1) to Tailwind names, and points the
// shadcn/ui semantic names at the same variables.
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "var(--color-primary)", dark: "var(--color-primary-dark)", foreground: "#FFFFFF" },
        surface: "var(--color-surface)",
        background: "var(--color-background)",
        tint: { DEFAULT: "var(--color-tint)", strong: "var(--color-tint-strong)" },
        selected: { DEFAULT: "var(--color-selected)", hover: "var(--color-selected-hover)" },
        text: { DEFAULT: "var(--color-text)", secondary: "var(--color-text-secondary)", disabled: "var(--color-text-disabled)" },
        border: { DEFAULT: "var(--color-border)", strong: "var(--color-border-strong)" },
        success: "var(--color-success)",
        due: "var(--color-due-soon)",
        danger: "var(--color-danger)",
        link: { DEFAULT: "var(--color-link)", text: "var(--color-link-text)" },
        scheme: { euvop: "var(--color-scheme-eu-vop)", ukcop: "var(--color-scheme-uk-cop)" },
        highlight: "var(--color-highlight)",
        neutral: { 100: "var(--color-neutral-100)", 200: "var(--color-neutral-200)", 300: "var(--color-neutral-300)", 500: "var(--color-neutral-500)" },
        // shadcn/ui semantic names
        foreground: "var(--color-text)",
        muted: { DEFAULT: "var(--color-tint)", foreground: "var(--color-text-secondary)" },
        accent: { DEFAULT: "var(--color-selected)", foreground: "var(--color-primary)" },
        secondary: { DEFAULT: "transparent", foreground: "var(--color-primary)" },
        destructive: { DEFAULT: "var(--color-danger)", foreground: "#FFFFFF" },
        input: "var(--color-border-strong)",
        ring: "var(--color-focus)",
        card: { DEFAULT: "var(--color-surface)", foreground: "var(--color-text)" },
        popover: { DEFAULT: "var(--color-surface)", foreground: "var(--color-text)" },
      },
      fontFamily: { sans: ["var(--font-sans)"], mono: ["var(--font-mono)"] },
      borderRadius: { sm: "var(--radius-sm)", DEFAULT: "var(--radius-sm)", md: "var(--radius-md)", lg: "var(--radius-lg)", pill: "var(--radius-pill)" },
      boxShadow: { soft: "var(--shadow-soft)", overlay: "var(--shadow-overlay)" },
      fontSize: {
        // Brief 5.1.3 typography scale (size / line-height). Weight is a
        // separate utility: text-body-strong = text-body font-medium,
        // text-label = text-meta font-medium text-text.
        page: ["24px", { lineHeight: "32px", letterSpacing: "-0.01em" }],
        section: ["18px", { lineHeight: "26px", letterSpacing: "-0.01em" }],
        subsection: ["16px", { lineHeight: "24px", letterSpacing: "-0.01em" }],
        body: ["14px", { lineHeight: "20px" }],
        meta: ["13px", { lineHeight: "18px" }],
        chip: ["12px", { lineHeight: "16px", letterSpacing: "0.01em" }],
      },
      screens: { md: "1024px", lg: "1280px", xl: "1440px" },
    },
  },
  plugins: [animate],
};

export default config;
