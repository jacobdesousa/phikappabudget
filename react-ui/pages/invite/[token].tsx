import * as React from "react";
import { useRouter } from "next/router";
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import { acceptInvite } from "../../services/authService";

export default function AcceptInvitePage() {
  const router = useRouter();
  const token = typeof router.query.token === "string" ? router.query.token : "";

  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [touched, setTouched] = React.useState<{ password: boolean; confirm: boolean }>({ password: false, confirm: false });

  const passwordValid = password.length >= 8;
  const confirmValid = confirm.length > 0 && confirm === password;
  const canSubmit = Boolean(token) && passwordValid && confirmValid && !submitting;

  return (
    <Stack spacing={2} sx={{ maxWidth: 520, mx: "auto", mt: { xs: 2, md: 6 } }}>
      <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>
          Accept invite
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Set a password for your account to finish sign-up.
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
                if (!token) {
                  setError("Invite token is missing.");
                  return;
                }
                if (!passwordValid || !confirmValid) return;
                setSubmitting(true);
                setError(null);
                const res = await acceptInvite(token, password);
                setSubmitting(false);
                if (!res.ok) {
                  setError(res.error);
                  return;
                }
                await router.push("/brothers");
              }}
            >
              Create account
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Stack>
  );
}


