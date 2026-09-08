import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Image from "next/image";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { getPasswordResetInfo, resetPassword } from "../../services/authService";

// Choosing the new password.
//
// The link is checked before the form is shown: typing a password into a form
// that cannot work, and only then being told the link expired, is a worse way
// to find out.
export default function ResetPasswordPage() {
  const router = useRouter();
  const token = String(router.query.token ?? "");

  const [checking, setChecking] = React.useState(true);
  const [linkError, setLinkError] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState<string | null>(null);

  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [touched, setTouched] = React.useState({ password: false, confirm: false });
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    if (!router.isReady || !token) return;
    let cancelled = false;
    (async () => {
      const res = await getPasswordResetInfo(token);
      if (cancelled) return;
      if (res.ok) setEmail(res.email);
      else setLinkError(res.error);
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router.isReady, token]);

  const passwordValid = password.length >= 8;
  const confirmValid = confirm.length > 0 && confirm === password;
  const canSubmit = passwordValid && confirmValid && !submitting;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    const res = await resetPassword(token, password);
    setSubmitting(false);
    if (!res.ok) {
      setSubmitError(res.error);
      return;
    }
    setDone(true);
  }

  return (
    <Box sx={{ bgcolor: "background.default", minHeight: "100vh", py: { xs: 4, md: 8 } }}>
      <Container maxWidth="xs">
        <Stack spacing={2}>
          <Stack alignItems="center" spacing={1}>
            <Image src="/alphabeta.png" alt="Alpha Beta" width={56} height={56} priority />
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Choose a new password
            </Typography>
          </Stack>

          <Paper elevation={2} sx={{ p: { xs: 2, md: 3 } }}>
            {checking ? (
              <Stack alignItems="center" sx={{ py: 3 }}>
                <CircularProgress />
              </Stack>
            ) : done ? (
              <Stack spacing={2}>
                <Alert severity="success">
                  Password updated. Any other devices signed in to this account have been signed out.
                </Alert>
                <Button component={Link} href="/login" variant="contained">
                  Sign in
                </Button>
              </Stack>
            ) : linkError ? (
              <Stack spacing={2}>
                <Alert severity="error">{linkError}</Alert>
                <Button component={Link} href="/forgot-password" variant="contained">
                  Request a new link
                </Button>
              </Stack>
            ) : (
              <Stack spacing={2} component="form" onSubmit={submit}>
                <Typography variant="body2" color="text.secondary">
                  {email} · Choose a password of at least 8 characters.
                </Typography>
                {submitError ? <Alert severity="error">{submitError}</Alert> : null}
                <TextField
                  label="New password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setTouched((p) => ({ ...p, password: true }))}
                  autoComplete="new-password"
                  autoFocus
                  fullWidth
                  error={touched.password && !passwordValid}
                  helperText={touched.password && !passwordValid ? "At least 8 characters." : " "}
                />
                <TextField
                  label="Confirm password"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onBlur={() => setTouched((p) => ({ ...p, confirm: true }))}
                  autoComplete="new-password"
                  fullWidth
                  error={touched.confirm && !confirmValid}
                  helperText={touched.confirm && !confirmValid ? "Passwords do not match." : " "}
                />
                <Button type="submit" variant="contained" disabled={!canSubmit}>
                  {submitting ? "Saving…" : "Set password"}
                </Button>
              </Stack>
            )}
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
