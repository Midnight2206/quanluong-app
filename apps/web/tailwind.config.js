/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,jsx}",
    "../../packages/shared/src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        secondary: "hsl(var(--secondary))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        destructive: "hsl(var(--destructive))",
        "destructive-foreground": "hsl(var(--destructive-foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        xl: "calc(var(--radius) + 0.25rem)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 0.125rem)",
        sm: "calc(var(--radius) - 0.25rem)",
      },
      boxShadow: {
        soft: "var(--shadow-sm)",
        panel: "var(--shadow-md)",
        float: "var(--shadow-lg)",
      },
      backgroundImage: {
        "app-grid":
          "linear-gradient(to right, rgb(148 163 184 / 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgb(148 163 184 / 0.08) 1px, transparent 1px)",
      },
      keyframes: {
        "route-progress": {
          "0%": { transform: "scaleX(0)", opacity: "1" },
          "18%": { transform: "scaleX(0.35)", opacity: "1" },
          "55%": { transform: "scaleX(0.72)", opacity: "1" },
          "100%": { transform: "scaleX(1)", opacity: "0.65" },
        },
        "nav-intent-shimmer": {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(320%)" },
        },
      },
      animation: {
        "route-progress": "route-progress 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "nav-intent-loop": "nav-intent-shimmer 0.95s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
