import * as React from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import { Alert, Box, Button, CircularProgress, Container, Paper, Stack, TextField, Typography } from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import { acceptInvite, getInviteInfo } from "../../services/authService";

export default function AcceptInvitePage() {
  const router = useRouter();
  const token = router.isReady && typeof router.query.token === "string" ? router.query.token : "";

  const [info, setInfo] = React.useState<{ email: string; first_name: string | null; last_name: string | null } | null>(null);
  const [infoError, setInfoError] = React.useState<string | null>(null);
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [touched, setTouched] = React.useState<{ password: boolean; confirm: boolean }>({ password: false, confirm: false });

  React.useEffect(() => {
    if (!token) return;
    getInviteInfo(token).then((res) => {
      if (res.ok) setInfo(res);
      else setInfoError(res.error);
    });
  }, [token]);

  const passwordValid = password.length >= 8;
  const confirmValid = confirm.length > 0 && confirm === password;
  const canSubmit = Boolean(token) && passwordValid && confirmValid && !submitting && info !== null;

  const displayName = info ? [info.first_name, info.last_name].filter(Boolean).join(" ") : null;

  return (
    <Box sx={{ bgcolor: "#f6f7fb", minHeight: "100vh", py: { xs: 3, md: 6 } }}>
      <Container maxWidth="sm">
        <Stack spacing={2}>
          <Box sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
            <Image src="/alphabeta.png" alt="Alpha Beta Logo" width={100} height={100} priority />
          </Box>

          <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider" }}>
            {!router.isReady || (!info && !infoError) ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                <CircularProgress size={28} />
              </Box>
            ) : infoError ? (
              <Alert severity="error">{infoError}</Alert>
            ) : (
              <>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>
                  {displayName ? `Welcome, ${displayName}` : "Accept invite"}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {info!.email} · Set a password to finish sign-up.
                </Typography>

                {error ? <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert> : null}

                <Stack spacing={2} sx={{ mt: 2 }}>
                  <TextField
                    label="New password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setTouched((p) => ({ ...p, password: true }))}
                    autoComplete="new-password"
                    fullWidth
                    error={touched.password && !passwordValid}
                    helperText={touched.password && !passwordValid ? "Password must be at least 8 characters." : " "}
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
                    helperText={touched.confirm && !confirmValid ? "Passwords must match." : " "}
                  />
                  <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
                    <Button variant="outlined" onClick={() => router.push("/login")}>
                      Back to login
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<AddOutlinedIcon />}
                      disabled={!canSubmit}
                      onClick={async () => {
                        setTouched({ password: true, confirm: true });
                        if (!token) { setError("Invite token is missing."); return; }
                        if (!passwordValid || !confirmValid) return;
                        setSubmitting(true);
                        setError(null);
                        const res = await acceptInvite(token, password);
                        setSubmitting(false);
                        if (!res.ok) { setError(res.error); return; }
                        await router.push("/brothers");
                      }}
                    >
                      Create account
                    </Button>
                  </Box>
                </Stack>
              </>
            )}
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
