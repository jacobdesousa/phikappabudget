"use client";

import * as React from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { getTheme } from "../theme";
import { ColorModeProvider, useColorMode } from "../theme/colorMode";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ColorModeProvider>
      <InnerProviders>{children}</InnerProviders>
    </ColorModeProvider>
  );
}

function InnerProviders({ children }: { children: React.ReactNode }) {
  const { mode } = useColorMode();
  const theme = React.useMemo(() => getTheme(mode), [mode]);

  React.useEffect(() => {
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}


