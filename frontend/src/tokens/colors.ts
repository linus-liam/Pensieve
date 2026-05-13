import type { ColorTokens, Theme } from "../types";

export const tokens: Record<Theme, ColorTokens> = {
  light: {
    paper: "#f4ece0",
    paperEdge: "#ebe1d1",
    ink: "#2a241d",
    inkSoft: "#6a5e4f",
    inkFaint: "#9c8e7c",
    rule: "#d8cbb4",
    accent: "#7a3b1d",
    sidebar: "#efe6d4",
  },
  dark: {
    paper: "#1d1812",
    paperEdge: "#16120d",
    ink: "#ece2cf",
    inkSoft: "#a89a83",
    inkFaint: "#6e6452",
    rule: "#3a3226",
    accent: "#d68a5c",
    sidebar: "#171309",
  },
};
