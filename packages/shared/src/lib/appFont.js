import { Be_Vietnam_Pro } from "next/font/google";

/** UI font (full Vietnamese diacritics). Self-hosted by next/font at build time; exposes `--font-sans`. */
export const appFont = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sans",
});
