import { createTheme } from "@mantine/core";

export const pensieveTheme = createTheme({
  primaryColor: "moss",
  primaryShade: 7,
  colors: {
    moss: [
      "#f1f4ef",
      "#e4ebe3",
      "#cbd8ca",
      "#abc0ab",
      "#83a083",
      "#668467",
      "#506d52",
      "#3d5841",
      "#344938",
      "#2d3e31",
    ],
  },
  defaultRadius: "md",
  fontFamily:
    '"Avenir Next", Avenir, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  headings: {
    fontFamily:
      'Iowan Old Style, "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif',
    fontWeight: "500",
  },
  components: {
    Button: { defaultProps: { radius: "md" } },
    ActionIcon: { defaultProps: { radius: "md" } },
    TextInput: { defaultProps: { radius: "md" } },
    Textarea: { defaultProps: { radius: "md" } },
  },
});
