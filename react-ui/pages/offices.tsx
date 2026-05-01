import * as React from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import { useAuth } from "../context/authContext";
import { adminCreateOffice, adminDeleteOffice, adminGetOffices, type OfficeRow } from "../services/authService";

export default function OfficesPage() {
  const { can } = useAuth();
  const isAdmin = can("admin.users");

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [offices, setOffices] = React.useState<OfficeRow[]>([]);

  const [newKey, setNewKey] = React.useState("");
  const [newName, setNewName] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await adminGetOffices();
      setOffices(rows ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load offices.");
      setOffices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!isAdmin) return;
    void refresh();
  }, [isAdmin, refresh]);

  if (!isAdmin) return <Alert severity="error">Forbidden.</Alert>;

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="h5">Offices</Typography>
        <Typography variant="body2" color="text.secondary">
          Configure the list of offices available in the chapter. Office keys are used for permissions.
        </Typography>
      </Paper>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="h6">Add office</Typography>
        <Divider sx={{ my: 2 }} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "flex-end" }}>
          <TextField
            label="Office key"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="e.g., phi, theta, risk"
            fullWidth
          />
          <TextField
            label="Display name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g., Phi (VP Finance)"
            fullWidth
          />
          <Button
            variant="contained"
            startIcon={<AddOutlinedIcon />}
            disabled={submitting || !newKey.trim()}
            sx={{ height: 40, minWidth: 110 }}
            onClick={async () => {
              setError(null);
              setSubmitting(true);
              const res = await adminCreateOffice({ office_key: newKey, display_name: newName || undefined });
              setSubmitting(false);
              if (!res.ok) {
                setError(res.error);
                return;
              }
              setNewKey("");
              setNewName("");
              void refresh();
            }}
          >
            Add
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          Tip: use a short, stable key (normalized to lowercase). Display name is what shows in the UI.
        </Typography>
      </Paper>

      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems={{ sm: "center" }}>
          <Typography variant="h6">Existing offices</Typography>
          <Button variant="outlined" onClick={() => refresh()} disabled={loading}>
            Refresh
          </Button>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {loading ? <CircularProgress /> : null}

        {offices.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No offices yet.
          </Typography>
        ) : (
          <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
            <Box component="thead">
              <Box component="tr">
                <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid", borderColor: "divider", py: 1, pr: 2 }}>
                  Display name
                </Box>
                <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid", borderColor: "divider", py: 1, pr: 2, width: 220 }}>
                  Key
                </Box>
                <Box component="th" sx={{ textAlign: "right", borderBottom: "1px solid", borderColor: "divider", py: 1, width: 160 }}>
                  Actions
                </Box>
              </Box>
            </Box>
            <Box component="tbody">
              {offices.map((o) => (
                <Box component="tr" key={o.office_key}>
                  <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, pr: 2 }}>
                    <Typography sx={{ fontWeight: 700 }}>{o.display_name}</Typography>
                  </Box>
                  <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, pr: 2 }}>
                    <Typography variant="body2">{o.office_key}</Typography>
                  </Box>
                  <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, textAlign: "right" }}>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteOutlineIcon />}
                      onClick={async () => {
                        setError(null);
                        const res = await adminDeleteOffice(o.office_key);
                        if (!res.ok) {
                          setError(res.error);
                          return;
                        }
                        void refresh();
                      }}
                    >
                      Remove
                    </Button>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Paper>
    </Stack>
  );
}


