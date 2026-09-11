import { Checkbox, createTheme, NavLink } from "@mantine/core";

export const pensieveTheme = createTheme({
  defaultRadius: "md",
  radius: {
    xs: "8px",
    sm: "12px",
    md: "20px",
    lg: "28px",
    xl: "36px",
  },
  components: {
    Checkbox: Checkbox.extend({ defaultProps: { radius: 6 } }),
    NavLink: NavLink.extend({
      styles: { root: { borderRadius: "var(--mantine-radius-md)" } },
    }),
  },
});
