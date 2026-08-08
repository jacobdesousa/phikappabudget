import type { AppProps } from "next/app";
import Head from "next/head";
import "./globals.css";
import * as React from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { getTheme, lightTheme } from "../theme";
import { AppShell } from "../components/layout/AppShell";
import { useRouter } from "next/router";
import { ColorModeProvider, useColorMode } from "../theme/colorMode";
import { getAccessToken, setAccessToken } from "../services/apiClient";
import { AuthProvider } from "../context/authContext";

function pageTitle(pathname: string) {
  switch (pathname) {
    case "/brothers":
      return "Brothers";
    case "/dues":
      return "Dues";
    case "/expenses":
      return "Expenses";
    case "/meetings":
      return "Meetings";
    case "/meetings/[id]":
      return "Meeting Minutes";
    case "/chapter-bonus":
      return "Chapter Bonus";
    case "/chapter-bonus-config":
      return "Chapter Bonus Config";
    case "/workdays":
      return "Workdays";
    case "/workdays/[id]":
      return "Workday";
    case "/config":
      return "Config";
    case "/dues-config":
      return "Dues Config";
    case "/expenses-config":
      return "Expenses Config";
    case "/revenue-config":
      return "Revenue Config";
    case "/revenue":
      return "Revenue";
    case "/users":
      return "Users";
    case "/sessions":
      return "Sessions";
    case "/role-permissions":
      return "Role Permissions";
    case "/offices":
      return "Offices";
    case "/budget":
      return "Budget";
    case "/room-draw":
      return "Room Draw";
    case "/shifts/setup":
      return "Setup Shifts";
    case "/shifts/cleanup":
      return "Cleanup Shifts";
    case "/shifts/party":
      return "Party Shifts";
    case "/shifts/[id]":
      return "Shift Detail";
    case "/makeups":
      return "Makeups";
    case "/notifications":
      return "Notifications";
    case "/votes/[voteId]":
      return "Vote";
    default:
      return "App";
  }
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const title = pageTitle(router.pathname);

  // Login: supports dark mode
  if (router.pathname === "/login") {
    return (
      <ColorModeProvider>
        <ThemedPublicPage title="PKS - Login">
          <Component {...pageProps} />
        </ThemedPublicPage>
      </ColorModeProvider>
    );
  }

  // Print/submit/invite flows: light-only and no admin shell.
  if (
    router.pathname === "/invite/[token]" ||
    router.pathname === "/expense-submit" ||
    router.pathname === "/meetings/[id]/print" ||
    router.pathname === "/workdays/[id]/print" ||
    router.pathname === "/chapter-bonus/print" ||
    router.pathname === "/room-draw/print" ||
    router.pathname === "/budget/print"
  ) {
    const printTitle =
      router.pathname === "/invite/[token]"
        ? "PKS - Accept Invite"
        : router.pathname === "/expense-submit"
          ? "PKS - Expense Submit"
          : router.pathname === "/meetings/[id]/print"
            ? "PKS - Meeting Minutes"
            : router.pathname === "/workdays/[id]/print"
              ? "PKS - Workday"
              : router.pathname === "/chapter-bonus/print"
                ? "PKS - Chapter Bonus"
                : router.pathname === "/budget/print"
                  ? "PKS - Budget"
                  : "PKS - Room Draw Standings";
    return (
      <ThemeProvider theme={lightTheme}>
        <CssBaseline />
        <Head>
          <title>{printTitle}</title>
          <meta name="color-scheme" content="light" />
        </Head>
        <Component {...pageProps} />
      </ThemeProvider>
    );
  }

  return (
    <ColorModeProvider>
      <InnerApp title={title}>
        <Component {...pageProps} />
      </InnerApp>
    </ColorModeProvider>
  );
}

function ThemedPublicPage(props: { title: string; children: React.ReactNode }) {
  const { mode } = useColorMode();
  const theme = React.useMemo(() => getTheme(mode), [mode]);
  React.useEffect(() => {
    document.documentElement.style.colorScheme = mode;
  }, [mode]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Head>
        <title>{props.title}</title>
        <meta name="color-scheme" content="light dark" />
      </Head>
      {props.children}
    </ThemeProvider>
  );
}

function InnerApp(props: { title: string; children: React.ReactNode }) {
  const { mode } = useColorMode();
  const theme = React.useMemo(() => getTheme(mode), [mode]);
  const router = useRouter();

  React.useEffect(() => {
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  // Basic auth gate for data pages (Phase 1).
  React.useEffect(() => {
    const publicPaths = new Set([
      "/login",
      "/invite/[token]",
      "/expense-submit",
      "/meetings/[id]/print",
      "/workdays/[id]/print",
      "/chapter-bonus/print",
      "/budget/print",
    ]);
    if (publicPaths.has(router.pathname)) return;

    // Home is in app router; for pages router, default route is rarely used.
    const token = getAccessToken();
    if (!token) {
      // Clear any stale token state just in case
      setAccessToken(null);
      const next = typeof window === "undefined" ? "" : window.location.pathname;
      void router.push(`/login?reason=unauthorized&next=${encodeURIComponent(next || "/brothers")}`);
    }
  }, [router.pathname]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Head>
        <title>{`PKS - ${props.title}`}</title>
        <meta name="color-scheme" content="light dark" />
      </Head>
      <AuthProvider>
        <AppShell title={props.title}>{props.children}</AppShell>
      </AuthProvider>
    </ThemeProvider>
  );
}


