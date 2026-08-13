import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
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
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useAuth } from "../context/authContext";
import { IDonationCampaign } from "../interfaces/api.interface";
import { getDonationConfig, saveDonationConfig } from "../services/donationsService";
import { formatMoney } from "../utils/money";

const CELL_SX = { py: 0.5 };
const HEAD_SX = { py: 1, fontWeight: 700, whiteSpace: "nowrap" as const };

function emptyCampaign(): IDonationCampaign {
  return {
    name: "",
    description: null,
    starts_on: null,
    ends_on: null,
    goal_amount: null,
    is_active: true,
    sort_order: null,
  };
}

export default function DonationsConfigPage() {
  const { can } = useAuth();
  const canWrite = can("donations.config");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Draft copies, so the price and every campaign save in one go.
  const [bondPrice, setBondPrice] = useState("");
  const [campaigns, setCampaigns] = useState<IDonationCampaign[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const config = await getDonationConfig();
      setBondPrice(String(config.bond_price));
      setCampaigns(config.campaigns);
    } catch (e: any) {
      setError(e?.message ?? "Could not load the donation config.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function patchCampaign(index: number, patch: Partial<IDonationCampaign>) {
    setCampaigns((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  async function handleSave() {
    const price = Number(bondPrice);
    if (!Number.isFinite(price) || price < 0) {
      setError("Enter a bond price.");
      return;
    }
    if (campaigns.some((c) => !c.name.trim())) {
      setError("Every campaign needs a name.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await saveDonationConfig({
        bond_price: price,
        campaigns: campaigns.map((c, i) => ({ ...c, sort_order: (i + 1) * 10 })),
      });
      setBondPrice(String(saved.bond_price));
      setCampaigns(saved.campaigns);
      setNotice("Saved.");
    } catch (e: any) {
      setError(e?.message ?? "Could not save the donation config.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="h5">Donations Config</Typography>
        <Typography variant="body2" color="text.secondary">
          The price a new alumni bond opens at, and the campaigns donations can be pinned to.
        </Typography>
      </Paper>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {notice ? <Alert severity="success">{notice}</Alert> : null}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Bond price
            </Typography>
            <TextField
              label="Current bond price"
              type="number"
              value={bondPrice}
              onChange={(e) => setBondPrice(e.target.value)}
              disabled={!canWrite}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              helperText={`Applies to bonds opened from now on. Bonds already opened keep the price they were opened at — changing this does not re-indebt anyone.`}
              sx={{ maxWidth: 360 }}
            />
          </Paper>

          <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="h6">Campaigns</Typography>
              {canWrite ? (
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setCampaigns((prev) => [...prev, emptyCampaign()])}
                >
                  Add campaign
                </Button>
              ) : null}
            </Stack>

            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={HEAD_SX}>Name</TableCell>
                    <TableCell sx={HEAD_SX}>Description</TableCell>
                    <TableCell sx={HEAD_SX}>Starts</TableCell>
                    <TableCell sx={HEAD_SX}>Ends</TableCell>
                    <TableCell sx={HEAD_SX}>Goal</TableCell>
                    <TableCell sx={HEAD_SX}>Raised</TableCell>
                    <TableCell sx={HEAD_SX}>Active</TableCell>
                    {canWrite ? <TableCell sx={HEAD_SX} /> : null}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {campaigns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canWrite ? 8 : 7} sx={CELL_SX}>
                        <Typography variant="body2" color="text.secondary">
                          No campaigns yet. Donations can still be recorded without one.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    campaigns.map((c, i) => (
                      <TableRow key={c.id ?? `new-${i}`}>
                        <TableCell sx={CELL_SX}>
                          <TextField
                            size="small"
                            value={c.name}
                            disabled={!canWrite}
                            onChange={(e) => patchCampaign(i, { name: e.target.value })}
                            sx={{ minWidth: 180 }}
                          />
                        </TableCell>
                        <TableCell sx={CELL_SX}>
                          <TextField
                            size="small"
                            value={c.description ?? ""}
                            disabled={!canWrite}
                            onChange={(e) => patchCampaign(i, { description: e.target.value })}
                            sx={{ minWidth: 200 }}
                          />
                        </TableCell>
                        <TableCell sx={CELL_SX}>
                          <TextField
                            size="small"
                            type="date"
                            value={c.starts_on ?? ""}
                            disabled={!canWrite}
                            InputLabelProps={{ shrink: true }}
                            onChange={(e) => patchCampaign(i, { starts_on: e.target.value || null })}
                          />
                        </TableCell>
                        <TableCell sx={CELL_SX}>
                          <TextField
                            size="small"
                            type="date"
                            value={c.ends_on ?? ""}
                            disabled={!canWrite}
                            InputLabelProps={{ shrink: true }}
                            onChange={(e) => patchCampaign(i, { ends_on: e.target.value || null })}
                          />
                        </TableCell>
                        <TableCell sx={CELL_SX}>
                          <TextField
                            size="small"
                            type="number"
                            value={c.goal_amount ?? ""}
                            disabled={!canWrite}
                            onChange={(e) =>
                              patchCampaign(i, { goal_amount: e.target.value || null })
                            }
                            InputProps={{
                              startAdornment: <InputAdornment position="start">$</InputAdornment>,
                            }}
                            sx={{ width: 140 }}
                          />
                        </TableCell>
                        <TableCell sx={CELL_SX}>${formatMoney(c.raised ?? 0)}</TableCell>
                        <TableCell sx={CELL_SX}>
                          <Checkbox
                            checked={c.is_active}
                            disabled={!canWrite}
                            onChange={(e) => patchCampaign(i, { is_active: e.target.checked })}
                          />
                        </TableCell>
                        {canWrite ? (
                          <TableCell sx={CELL_SX}>
                            <IconButton
                              size="small"
                              onClick={() =>
                                setCampaigns((prev) => prev.filter((_, idx) => idx !== i))
                              }
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant="caption" color="text.secondary">
              Removing a campaign keeps its donations — they simply stop being pinned to it.
            </Typography>
          </Paper>

          {canWrite ? (
            <Stack direction="row" justifyContent="flex-end">
              <Button variant="contained" onClick={handleSave} disabled={saving}>
                Save config
              </Button>
            </Stack>
          ) : null}
        </>
      )}
    </Stack>
  );
}
