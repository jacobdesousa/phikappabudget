import * as React from "react";
import Link from "next/link";
import { Alert, Box, Button, Container, Paper, Stack, TextField, Typography } from "@mui/material";
import Image from "next/image";
import { requestPasswordReset } from "../services/authService";

// Asking for a reset link.
//
// The confirmation is deliberately the same whether or not the address has an
// account. The server answers identically for exactly that reason, and showing
// "no such user" here would hand back the membership oracle it avoids.
export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  // Dev only: the API returns the link when no mail provider is configured.
  const [devUrl, setDevUrl] = React.useState<string | null>(null);

  const emailValid = /\S+@\S+\.\S+/.test(email);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!emailValid || submitting) return;
    setSubmitting(true);
    const res = await requestPasswordReset(email.trim());
    setSubmitting(false);
    setDevUrl(res.reset_url ?? null);
    setSent(true);
  }

  return (
    <Box sx={{ bgcolor: "background.default", minHeight: "100vh", py: { xs: 4, md: 8 } }}>
      <Container maxWidth="xs">
        <Stack spacing={2}>
          <Stack alignItems="center" spacing={1}>
            <Image src="/alphabeta.png" alt="Alpha Beta" width={56} height={56} priority />
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Reset your password
            </Typography>
          </Stack>

          <Paper elevation={2} sx={{ p: { xs: 2, md: 3 } }}>
            {sent ? (
              <Stack spacing={2}>
                <Alert severity="success">
                  If that address has an account, a reset link is on its way. It expires in an hour.
                </Alert>
                <Typography variant="body2" color="text.secondary">
                  Nothing arrived? Check the spam folder, and make sure you used the address the
                  chapter has on file for you.
                </Typography>
                {devUrl ? (
                  <Alert severity="info" sx={{ wordBreak: "break-all" }}>
                    Dev mode — no mail provider configured. Link: {devUrl}
                  </Alert>
                ) : null}
                <Button component={Link} href="/login" variant="outlined">
                  Back to sign in
                </Button>
              </Stack>
            ) : (
              <Stack spacing={2} component="form" onSubmit={submit}>
                <Typography variant="body2" color="text.secondary">
                  Enter the email address on your account and we&apos;ll send you a link to choose a
                  new password.
                </Typography>
                <TextField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                  fullWidth
                />
                <Button type="submit" variant="contained" disabled={!emailValid || submitting}>
                  {submitting ? "Sending…" : "Send reset link"}
                </Button>
                <Button component={Link} href="/login" size="small">
                  Back to sign in
                </Button>
              </Stack>
            )}
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
