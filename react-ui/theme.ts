import { createTheme } from "@mui/material/styles";

export type ColorMode = "light" | "dark";

export function getTheme(mode: ColorMode) {
  return createTheme({
    palette: {
      mode,
      primary: { main: "#1f4b99" },
      secondary: { main: "#cfb53b" },
      background:
        mode === "dark"
          ? {
              default: "#0b1220",
              paper: "#0f172a",
            }
          : {
              default: "#f6f7fb",
              paper: "#ffffff",
            },
    },
    shape: {
      borderRadius: 12,
    },
    typography: {
      fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 700 },
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
      },
    },
  });
}

export const lightTheme = getTheme("light");


