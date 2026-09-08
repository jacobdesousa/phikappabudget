import * as React from "react";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import { useAuth } from "../context/authContext";
import { adminCreateOffice, adminDeleteOffice, adminGetOffices, type OfficeRow } from "../services/authService";
import { ConfigEmpty, ConfigPageLayout, ConfigSection } from "../components/config/configLayout";
import { CELL_SX, HEAD_SX, TABLE_CONTAINER_SX, TABLE_SX } from "../components/config/configTable";

export default function OfficesPage() {
  const { can } = useAuth();
  const isAdmin = can("admin.users");

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [offices, setOffices] = React.useState<OfficeRow[]>([]);

  const [newKey, setNewKey] = React.useState("");
  const [newName, setNewName] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [deleting, setDeleting] = React.useState<OfficeRow | null>(null);

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
    <ConfigPageLayout
      title="Offices"
      description="The offices available in the chapter. Office keys are what permissions are granted to."
      error={error}
      actions={
        <Button size="small" variant="outlined" startIcon={<RefreshOutlinedIcon />} onClick={() => refresh()} disabled={loading}>
          Refresh
        </Button>
      }
    >
      <ConfigSection
        title="Add office"
        description="Use a short, stable key — it is normalized to lowercase and is what role permissions attach to. The display name is what appears in the UI."
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "flex-start" }}>
          <TextField
            size="small"
            label="Office key"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="e.g. phi, theta, risk"
            fullWidth
          />
          <TextField
            size="small"
            label="Display name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Phi (VP Finance)"
            fullWidth
          />
          <Button
            size="small"
            variant="contained"
            startIcon={<AddOutlinedIcon />}
            disabled={submitting || !newKey.trim()}
            // No fixed height or width: the button sizes to its own label
            // rather than clipping it.
            sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", sm: "center" } }}
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
            Add office
          </Button>
        </Stack>
      </ConfigSection>

      <ConfigSection title="Existing offices">
        {loading ? (
          <Stack alignItems="center" sx={{ py: 3 }}>
            <CircularProgress />
          </Stack>
        ) : offices.length === 0 ? (
          <ConfigEmpty>No offices yet.</ConfigEmpty>
        ) : (
          <TableContainer sx={TABLE_CONTAINER_SX}>
            <Table size="small" sx={TABLE_SX}>
              <TableHead>
                <TableRow>
                  <TableCell sx={HEAD_SX}>Display name</TableCell>
                  <TableCell sx={{ ...HEAD_SX, width: 200 }}>Key</TableCell>
                  <TableCell sx={{ ...HEAD_SX, width: 120 }} align="right">
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {offices.map((o) => (
                  <TableRow key={o.office_key} hover>
                    <TableCell sx={{ ...CELL_SX, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {o.display_name}
                    </TableCell>
                    <TableCell sx={{ ...CELL_SX, width: 200, color: "text.secondary" }}>{o.office_key}</TableCell>
                    <TableCell sx={{ ...CELL_SX, width: 120 }} align="right">
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteOutlineIcon />}
                        onClick={() => setDeleting(o)}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </ConfigSection>

      {/* Removing an office was immediate, unlike every other destructive
          action on the config pages. */}
      <Dialog open={Boolean(deleting)} onClose={() => setDeleting(null)} fullWidth maxWidth="sm">
        <DialogTitle>Remove {deleting?.display_name}?</DialogTitle>
        <DialogContent dividers>
          <DialogContentText sx={{ fontSize: "0.875rem" }}>
            Any permissions granted to <b>{deleting?.office_key}</b> go with it, and brothers holding this
            office lose what it granted them.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button size="small" variant="outlined" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            color="error"
            onClick={async () => {
              if (!deleting) return;
              setError(null);
              const res = await adminDeleteOffice(deleting.office_key);
              setDeleting(null);
              if (!res.ok) {
                setError(res.error);
                return;
              }
              void refresh();
            }}
          >
            Remove office
          </Button>
        </DialogActions>
      </Dialog>
    </ConfigPageLayout>
  );
}
