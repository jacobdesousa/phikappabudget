import * as React from "react";
import {
  Alert,
  Box,
  Chip,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import Link from "next/link";
import PageLoader from "../components/PageLoader";
import { formatDateOnly } from "../utils/date";
import { formatMoney } from "../utils/money";
import {
  getAccountSummary,
  type IAccountMoney,
  type IAccountSummary,
} from "../services/accountService";

const PANEL_SX = { p: 2, border: "1px solid", borderColor: "divider" } as const;

function fmtDate(value?: string | null) {
  return value ? formatDateOnly(value, { month: "short", day: "numeric", year: "numeric" }) : "—";
}

/** Dues and residence fees read the same way, so they share a component. */
function MoneyPanel({
  title,
  subtitle,
  money,
  emptyNote,
}: {
  title: string;
  subtitle?: string | null;
  money: IAccountMoney | null;
  emptyNote: string;
}) {
  if (!money) {
    return (
      <Paper elevation={0} sx={PANEL_SX}>
        <Typography variant="h6">{title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {emptyNote}
        </Typography>
      </Paper>
    );
  }

  const paidPct =
    money.total_owed > 0 ? Math.min(100, (money.total_paid / money.total_owed) * 100) : 0;
  const outstanding = Math.max(0, money.balance_due_to_date);

  return (
    <Paper elevation={0} sx={PANEL_SX}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.5 }}>
        <Typography variant="h6">{title}</Typography>
        {money.is_behind ? (
          <Chip label={`${formatMoney(outstanding)} outstanding`} color="error" size="small" />
        ) : (
          <Chip label="Up to date" color="success" size="small" variant="outlined" />
        )}
      </Stack>
      {subtitle && (
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      )}

      <Box sx={{ mt: 2, mb: 1 }}>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
          <Typography variant="body2">
            {formatMoney(money.total_paid)} paid of {formatMoney(money.total_owed)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {Math.round(paidPct)}%
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={paidPct}
          color={money.is_behind ? "error" : "success"}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Box>

      {money.instalments.length > 0 && (
        <TableContainer sx={{ mt: 1.5 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Instalment</TableCell>
                <TableCell>Due</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="right">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {money.instalments.map((inst, i) => (
                <TableRow key={inst.label ?? inst.seq ?? i}>
                  <TableCell>{inst.label ?? `Instalment ${inst.seq}`}</TableCell>
                  <TableCell>{fmtDate(inst.due_date)}</TableCell>
                  <TableCell align="right">{formatMoney(inst.amount)}</TableCell>
                  <TableCell align="right">
                    {inst.covered ? (
                      <Chip label="Covered" size="small" color="success" variant="outlined" />
                    ) : (
                      <Chip label="Outstanding" size="small" color="default" variant="outlined" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Payments are one pool, not allocated per instalment, so "covered"
          means paid up through that date rather than that line being settled. */}
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
        Covered means your payments reach that date. Payments aren&apos;t tied to a single
        instalment.
      </Typography>

      {money.payments.length > 0 && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            Your payments
          </Typography>
          <Stack divider={<Divider />}>
            {money.payments.map((p) => (
              <Stack key={p.id} direction="row" justifyContent="space-between" sx={{ py: 0.75 }}>
                <Typography variant="body2">
                  {fmtDate(p.paid_at)}
                  {p.memo ? (
                    <Typography component="span" variant="body2" color="text.secondary">
                      {" "}
                      — {p.memo}
                    </Typography>
                  ) : null}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {formatMoney(Number(p.amount))}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </>
      )}
    </Paper>
  );
}

export default function AccountPage() {
  const [data, setData] = React.useState<IAccountSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    getAccountSummary()
      .then(setData)
      .catch((e) => setError((e as Error)?.message ?? "Could not load your account."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data?.brother) {
    return (
      <Alert severity="info">
        Your account isn&apos;t linked to a brother record yet, so there&apos;s nothing to show.
        Ask the Tau to link it.
      </Alert>
    );
  }

  const b = data.brother;
  const currentOffices = data.offices.filter((o) => o.is_current);
  const makeupTotal = data.makeups?.total ?? 0;

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={PANEL_SX}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ sm: "center" }}
          spacing={1}
        >
          <Box>
            <Typography variant="h5">
              {b.first_name} {b.last_name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {[b.pledge_class, b.status, b.email].filter(Boolean).join(" · ")}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {currentOffices.map((o) => (
              <Chip
                key={o.office_key}
                label={o.display_name ?? o.office_key}
                size="small"
                color="primary"
              />
            ))}
            {data.room_draw && (
              <Chip
                label={`${data.room_draw.total} room draw points`}
                size="small"
                variant="outlined"
              />
            )}
          </Stack>
        </Stack>
      </Paper>

      {makeupTotal > 0 && (
        <Alert severity="warning">
          You have {makeupTotal} outstanding makeup{makeupTotal === 1 ? "" : "s"}.{" "}
          <Link href="/notifications">See what you owe</Link>.
        </Alert>
      )}

      <MoneyPanel
        title="Dues"
        subtitle={data.dues ? `${data.dues.year}–${data.dues.year + 1} · ${data.dues.category}` : null}
        money={data.dues}
        emptyNote="No dues plan is set up for this year yet."
      />

      <MoneyPanel
        title="Residence Fees"
        subtitle={
          data.residence
            ? [data.residence.session_label, data.residence.rooms?.join(", ")]
                .filter(Boolean)
                .join(" · ")
            : null
        }
        money={data.residence}
        emptyNote="You're not assigned a room for this session."
      />

      {data.upcoming.length > 0 && (
        <Paper elevation={0} sx={PANEL_SX}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Coming up
          </Typography>
          <Stack divider={<Divider />}>
            {data.upcoming.map((item) => (
              <Stack
                key={item.key}
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ py: 1 }}
              >
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {item.title}
                  </Typography>
                  {item.detail && (
                    <Typography variant="caption" color="text.secondary">
                      {item.detail}
                    </Typography>
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {fmtDate(item.date)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Paper>
      )}

      {data.offices.length > 0 && (
        <Paper elevation={0} sx={PANEL_SX}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Offices held
          </Typography>
          <Stack divider={<Divider />}>
            {data.offices.map((o) => (
              <Stack
                key={`${o.office_key}-${o.start_date}`}
                direction="row"
                justifyContent="space-between"
                sx={{ py: 0.75 }}
              >
                <Typography variant="body2">{o.display_name ?? o.office_key}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {fmtDate(o.start_date)} – {o.end_date ? fmtDate(o.end_date) : "present"}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
