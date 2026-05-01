import * as React from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import { Alert, Box, Button, Container, Paper, Stack, TextField, Typography } from "@mui/material";
import LoginIcon from "@mui/icons-material/Login";
import { login } from "../services/authService";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [touched, setTouched] = React.useState<{ email: boolean; password: boolean }>({ email: false, password: false });
  const [clientError, setClientError] = React.useState<string | null>(null);

  const next = typeof router.query.next === "string" ? router.query.next : "/brothers";
  const reason = typeof router.query.reason === "string" ? router.query.reason : "";
  const emailTrimmed = email.trim();
  const emailValid = !emailTrimmed ? false : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed);
  const passwordValid = password.length > 0;

  async function onSubmit() {
    setTouched({ email: true, password: true });
    setClientError(null);
    setError(null);
    if (!emailValid) {
      setClientError("Enter a valid email address.");
      return;
    }
    if (!passwordValid) {
      setClientError("Password is required.");
      return;
    }
    setSubmitting(true);
    const res = await login(email, password);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await router.push(next);
  }

  return (
    <Box sx={{ bgcolor: "#f6f7fb", minHeight: "100vh", py: { xs: 3, md: 7 } }}>
      <Container maxWidth="sm">
        <Stack spacing={2}>
          <Box sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
            <Image src="/alphabeta.png" alt="Alpha Beta Logo" width={120} height={120} priority />
          </Box>

          <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="h5" sx={{ fontWeight: 900 }}>
              Sign in
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Use your invited account credentials to access PKS data pages.
            </Typography>
          </Paper>

          <Paper elevation={2} sx={{ p: { xs: 2, md: 3 } }}>
            <Stack
              spacing={2}
              component="form"
              onSubmit={(e) => {
                e.preventDefault();
                if (submitting) return;
                void onSubmit();
              }}
            >
              {reason === "expired" ? (
                <Alert severity="warning">Your session expired. Please sign in again.</Alert>
              ) : null}
              {reason === "unauthorized" ? (
                <Alert severity="info">Please sign in to continue.</Alert>
              ) : null}
              {clientError ? <Alert severity="warning">{clientError}</Alert> : null}
              {error ? <Alert severity="error">{error}</Alert> : null}
              {!error && !reason ? (
                <Typography variant="body2" color="text.secondary">
                  Don&apos;t have an account? Ask the Tau to send you an invite link.
                </Typography>
              ) : null}

              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setClientError(null);
                }}
                onBlur={() => setTouched((p) => ({ ...p, email: true }))}
                autoComplete="email"
                fullWidth
                error={touched.email && !emailValid}
                helperText={touched.email && !emailValid ? "Enter a valid email address." : " "}
              />
              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setClientError(null);
                }}
                onBlur={() => setTouched((p) => ({ ...p, password: true }))}
                autoComplete="current-password"
                fullWidth
                error={touched.password && !passwordValid}
                helperText={touched.password && !passwordValid ? "Password is required." : " "}
              />

              <Button
                variant="contained"
                startIcon={<LoginIcon />}
                disabled={submitting}
                type="submit"
              >
                Sign in
              </Button>
            </Stack>
          </Paper>

          <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
            Phi Kappa Sigma — Alpha Beta
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}


