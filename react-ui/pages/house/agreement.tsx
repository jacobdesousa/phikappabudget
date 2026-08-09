import * as React from "react";
import { useRouter } from "next/router";
import dayjs from "dayjs";
import { Alert, Box, CircularProgress } from "@mui/material";
import { apiClient, parseApiError } from "../../services/apiClient";
import { formatMoney } from "../../utils/money";
import { sessionLabel } from "../../utils/house";
import type { HouseSessionType } from "../../interfaces/api.interface";

// ── Types returned by GET /house/agreement ─────────────────────────────────

interface AgreementCharges {
  term_rate: number;
  terms: number;
  term_rows: { label: string; amount: number }[];
  total_fees: number;
  rebate_per_term: number;
  rebate_amount: number;
  net_fees: number;
  prepay_pct: number;
  prepay_deadline: string | null;
  prepay_discount: number;
  net_net_fees: number;
  instalments: { seq: number; label: string; due_date: string | null; amount: number }[];
  prepayment_balance: number;
  security_deposit: number;
  is_override: boolean;
  override_note: string | null;
}

interface AgreementResident {
  assignment_id: number;
  brother_id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  pledge_class: string | null;
  brother_status: string | null;
  room_code: string;
  bed: number;
  capacity: number;
  occupancy: string;
  start_date: string | null;
  end_date: string | null;
  charges: AgreementCharges;
}

interface AgreementData {
  year: number;
  session_type: HouseSessionType;
  session: { start_date: string | null; end_date: string | null; terms: number };
  dues: Record<string, number>;
  residents: AgreementResident[];
}

// ── Design tokens ──────────────────────────────────────────────────────────
// Monochrome and typographic: hairline rules instead of boxes, one weight of
// emphasis. Plain style objects rather than MUI sx, since the print output
// can't depend on the app theme.

const INK = "#16181d";
const MUTED = "#71757e";
const RULE = "#d7d9dd";
const FILL = "#b0b3b9"; // lines the resident writes on
const PANEL = "#f6f7f8";

// Revision of the document template itself, not the day it was printed — bump
// this when the layout or wording changes.
const TEMPLATE_REVISION = "August 2026";

const page: React.CSSProperties = {
  width: "7.5in",
  margin: "0 auto",
  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  color: INK,
  fontSize: 9.5,
  lineHeight: 1.45,
};

const eyebrow: React.CSSProperties = {
  fontSize: 7.8,
  letterSpacing: 1,
  textTransform: "uppercase",
  color: MUTED,
  fontWeight: 700,
};

const sectionTitle: React.CSSProperties = {
  ...eyebrow,
  color: INK,
  paddingBottom: 3,
  borderBottom: `1px solid ${INK}`,
  marginBottom: 8,
};

function Section({
  title,
  children,
  style,
}: {
  title: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ marginTop: 12, ...style }}>
      <div style={sectionTitle}>{title}</div>
      {children}
    </div>
  );
}

// A label under a rule — reads as a form field whether pre-filled or blank.
function Field({ label, value, width }: { label: string; value?: React.ReactNode; width?: string | number }) {
  const filled = value !== undefined && value !== null && value !== "";
  return (
    <div style={{ width, flex: width ? "0 0 auto" : 1, minWidth: 0 }}>
      <div
        style={{
          minHeight: 23,
          borderBottom: `1px solid ${filled ? RULE : FILL}`,
          fontSize: 10.5,
          paddingBottom: 2,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {filled ? value : " "}
      </div>
      <div style={{ ...eyebrow, fontSize: 7.2, paddingTop: 3, whiteSpace: "nowrap", overflow: "hidden" }}>
        {label}
      </div>
    </div>
  );
}

// A group of tick boxes that lines up with the Fields beside it.
function TickField({ label, options }: { label: string; options: string[] }) {
  return (
    <div style={{ flex: "0 0 auto" }}>
      <div style={{ minHeight: 23, paddingBottom: 2, fontSize: 10, whiteSpace: "nowrap" }}>
        {options.map((o, i) => (
          <Tick key={o} on={false} gap={i === options.length - 1 ? 0 : 8}>
            {o}
          </Tick>
        ))}
      </div>
      <div style={{ ...eyebrow, fontSize: 7.2, borderTop: `1px solid ${FILL}`, paddingTop: 3 }}>{label}</div>
    </div>
  );
}

function Row({ children, gap = 12, style }: { children: React.ReactNode; gap?: number; style?: React.CSSProperties }) {
  return <div style={{ display: "flex", gap, marginBottom: 8, alignItems: "flex-end", ...style }}>{children}</div>;
}

function Tick({ on, children, gap = 14 }: { on: boolean; children: React.ReactNode; gap?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginRight: gap, fontSize: 10 }}>
      <span
        style={{
          width: 9,
          height: 9,
          border: `1px solid ${on ? INK : FILL}`,
          background: on ? INK : "transparent",
          display: "inline-block",
        }}
      />
      {children}
    </span>
  );
}

function money(v: number) {
  return `$${formatMoney(v)}`;
}
function fmtDate(d: string | null | undefined) {
  return d ? dayjs(d).format("MMM D, YYYY") : "";
}
function bedroomLabel(r: AgreementResident) {
  return `${r.room_code}${r.capacity > 1 && r.occupancy !== "full_room" ? `-${r.bed}` : ""}`;
}

// ── The agreement — one page per resident ──────────────────────────────────

function AgreementPage({
  r,
  data,
  extras,
  isLast,
}: {
  r: AgreementResident;
  data: AgreementData;
  extras: { status: string };
  // The last agreement mustn't force a break, or printing emits a blank page.
  isLast: boolean;
}) {
  const c = r.charges;

  const feeLine: React.CSSProperties = { padding: "4.5px 0", fontSize: 10, borderBottom: `1px solid ${RULE}` };
  const feeR: React.CSSProperties = {
    ...feeLine,
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  };
  const feeNote: React.CSSProperties = { ...feeLine, color: MUTED, fontSize: 9 };
  const totL: React.CSSProperties = {
    ...feeLine,
    fontWeight: 700,
    borderTop: `1px solid ${INK}`,
    borderBottom: "none",
  };
  const totR: React.CSSProperties = { ...totL, ...feeR, borderBottom: "none" };

  return (
    <div style={{ ...page, pageBreakAfter: isLast ? "auto" : "always" }}>
      {/* Letterhead */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          borderBottom: `2px solid ${INK}`,
          paddingBottom: 7,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/alphabeta.png" alt="" style={{ width: 46, height: 46, objectFit: "contain" }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.2 }}>Bannerman House Co-op</div>
            <div style={{ fontSize: 9, color: MUTED, lineHeight: 1.45 }}>
              Phi Kappa Sigma Fraternity · Alpha Beta Chapter
              <br />
              163 St. George Street, Toronto, Ontario M5R 2M2
            </div>
          </div>
        </div>
        <div style={{ ...eyebrow, fontSize: 9.5, color: INK, letterSpacing: 1.4 }}>Resident Agreement</div>
      </div>

      {/* The facts that identify this agreement */}
      <div style={{ display: "flex", gap: 22, marginTop: 13, alignItems: "flex-start" }}>
        <div>
          <div style={eyebrow}>Bedroom</div>
          <div style={{ fontSize: 27, fontWeight: 700, lineHeight: 1.05, letterSpacing: -0.8 }}>
            {bedroomLabel(r)}
          </div>
          {/* Otherwise a doubled rate on a shared room looks like an error. */}
          {r.occupancy === "full_room" && (
            <div style={{ ...eyebrow, fontSize: 7.2, paddingTop: 3 }}>Whole-room buy-out</div>
          )}
        </div>
        <div style={{ borderLeft: `1px solid ${RULE}`, paddingLeft: 18, flex: 1 }}>
          <div style={eyebrow}>Resident</div>
          <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.25 }}>
            {r.first_name} {r.last_name}
          </div>
          <div style={{ fontSize: 9.5, color: MUTED }}>{[r.phone, r.email].filter(Boolean).join("  ·  ")}</div>
          <div style={{ ...eyebrow, fontSize: 7.4, color: INK, paddingTop: 3 }}>{extras.status}</div>
        </div>
        <div style={{ borderLeft: `1px solid ${RULE}`, paddingLeft: 18, textAlign: "right" }}>
          <div style={eyebrow}>Session</div>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{sessionLabel(data.year, data.session_type)}</div>
          <div style={{ fontSize: 9.5, color: MUTED }}>
            {fmtDate(r.start_date)} – {fmtDate(r.end_date)}
          </div>
        </div>
      </div>

      {/* Fees and the payment schedule, side by side */}
      <div style={{ display: "flex", gap: 20 }}>
        <div style={{ flex: 1.05 }}>
          <Section title="Residence fees">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {c.is_override ? (
                  <tr>
                    <td style={feeLine}>
                      Session fees (adjusted)
                      {c.override_note ? <div style={{ fontSize: 7, color: MUTED }}>{c.override_note}</div> : null}
                    </td>
                    <td style={feeNote}>{fmtDate(r.start_date)}</td>
                    <td style={feeR}>{money(c.total_fees)}</td>
                  </tr>
                ) : (
                  c.term_rows.map((row, i) => (
                    <tr key={i}>
                      <td style={feeLine}>{row.label.replace(" Fees", "")}</td>
                      <td style={feeNote}>{money(c.term_rate)} / term</td>
                      <td style={feeR}>{money(row.amount)}</td>
                    </tr>
                  ))
                )}
                <tr>
                  <td style={totL}>Total fees</td>
                  <td style={{ ...totL, ...feeNote, fontWeight: 400 }} />
                  <td style={totR}>{money(c.total_fees)}</td>
                </tr>

                {c.rebate_amount > 0 && (
                  <>
                    <tr>
                      <td style={{ ...feeLine, paddingTop: 5 }}>Less active member rebate</td>
                      <td style={{ ...feeNote, paddingTop: 5 }}>
                        {money(c.rebate_per_term)} × {c.terms}
                      </td>
                      <td style={{ ...feeR, paddingTop: 5 }}>−{money(c.rebate_amount)}</td>
                    </tr>
                    <tr>
                      <td style={totL}>Net fees</td>
                      <td style={{ ...totL, ...feeNote, fontWeight: 400 }} />
                      <td style={totR}>{money(c.net_fees)}</td>
                    </tr>
                  </>
                )}

                {c.prepay_pct > 0 && (
                  <>
                    <tr>
                      <td style={{ ...feeLine, paddingTop: 5 }}>Less pre-payment discount</td>
                      <td style={{ ...feeNote, paddingTop: 5 }}>
                        {c.prepay_pct}% by {fmtDate(c.prepay_deadline)}
                      </td>
                      <td style={{ ...feeR, paddingTop: 5 }}>−{money(c.prepay_discount)}</td>
                    </tr>
                    <tr>
                      <td style={{ ...totL, fontSize: 11 }}>Total if pre-paid</td>
                      <td style={{ ...totL, ...feeNote, fontWeight: 400 }} />
                      <td style={{ ...totR, fontSize: 11 }}>{money(c.net_net_fees)}</td>
                    </tr>
                  </>
                )}

                <tr>
                  <td style={{ ...feeLine, paddingTop: 5 }}>Refundable security deposit</td>
                  <td style={{ ...feeNote, paddingTop: 5 }}>At room allocation</td>
                  <td style={{ ...feeR, paddingTop: 5 }}>{money(c.security_deposit)}</td>
                </tr>
              </tbody>
            </table>
          </Section>
        </div>

        <div style={{ flex: 1 }}>
          <Section title="Instalments">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {c.instalments.map((inst) => (
                  <tr key={inst.seq}>
                    <td style={feeLine}>{inst.label}</td>
                    <td style={feeNote}>{fmtDate(inst.due_date)}</td>
                    <td style={feeR}>{money(inst.amount)}</td>
                  </tr>
                ))}
                <tr>
                  <td style={totL}>Total</td>
                  <td style={{ ...totL, ...feeNote, fontWeight: 400 }} />
                  <td style={totR}>{money(c.net_fees)}</td>
                </tr>
              </tbody>
            </table>

            {c.prepay_pct > 0 && (
              <div
                style={{
                  marginTop: 7,
                  padding: "6px 8px",
                  border: `1px solid ${RULE}`,
                  background: PANEL,
                  fontSize: 9.2,
                  lineHeight: 1.6,
                }}
              >
                <strong style={{ fontSize: 9.8 }}>Paying in full instead</strong>
                <br />
                Pay the first instalment of {money(c.instalments[0]?.amount ?? 0)}, then the balance of{" "}
                <strong>{money(c.prepayment_balance)}</strong> by {fmtDate(c.prepay_deadline)} — a total of{" "}
                <strong>{money(c.net_net_fees)}</strong>, saving {money(c.prepay_discount)}.
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* Written in by hand: parking is occasional and priced by the month. */}
      <Section title="Parking &amp; other charges">
        <Row style={{ marginBottom: 0 }} gap={16}>
          <TickField label="Parking required" options={["Yes", "No"]} />
          <Field label="Months" width="0.75in" />
          <Field label="Rate / month" width="0.95in" value="$60.00" />
          <Field label="Parking total" width="1.05in" />
          <Field label="Other charges" />
          <Field label="Amount" width="1.05in" />
        </Row>
      </Section>

      {/* Everything the chapter doesn't hold. Address and academic status sit
          side by side, sharing the vertical band, as on the original form. */}
      <div style={{ display: "flex", gap: 26 }}>
        <div style={{ flex: 1.15 }}>
          <Section title="Permanent (home) address">
            <Row>
              <Field label="Street" />
            </Row>
            <Row style={{ marginBottom: 0 }}>
              <Field label="City" />
              <Field label="Province" width="0.85in" />
              <Field label="Postal code" width="0.95in" />
            </Row>
          </Section>
        </div>
        <div style={{ flex: 1 }}>
          <Section title="Academic status">
            <Row>
              <Field label="Institution" />
              <Field label="Faculty / programme" />
            </Row>
            <Row style={{ marginBottom: 0 }}>
              <TickField label="Enrolment" options={["FT", "PT"]} />
              <TickField label="Year" options={["1", "2", "3", "4", "PEY"]} />
              <Field label="Member class" width="0.9in" value={r.pledge_class ?? undefined} />
            </Row>
          </Section>
        </div>
      </div>

      <Section title="Emergency contact">
        <Row style={{ marginBottom: 0 }}>
          <Field label="Name" />
          <Field label="Relationship" width="1.2in" />
          <Field label="Phone" width="1.3in" />
          <Field label="Email" />
        </Row>
      </Section>

      {/* Terms set in two columns to keep the document to a single page */}
      <Section title="Terms">
        <div style={{ columnCount: 2, columnGap: 26, fontSize: 9.8, lineHeight: 1.6, color: "#2c2f36" }}>
          <p style={{ margin: "0 0 9px" }}>
            The undersigned agrees to pay in full the fees above, and to pay residence fees by providing{" "}
            <strong>{money(c.security_deposit)}</strong> in advance as a refundable security deposit together with
            the first instalment. Payment shall be made by bank draft, certified cheque, e-transfer or postal money
            order payable to <strong>“Bannerman House”</strong>. The security deposit is non-refundable as
            liquidated damages if the resident fails to take occupancy of the bedroom. Subsequent instalments shall
            be paid according to the schedule above.
          </p>
          <p style={{ margin: "0 0 9px" }}>
            All charges are payable by personal cheque, bank draft, wire transfer or postal money order.{" "}
            <strong>Cash will not be accepted under any circumstances.</strong>
          </p>
          <p style={{ margin: "0 0 9px" }}>
            Where the resident is subject to annual dues or other member charges, these are payable in full by
            September 30th. The resident warrants that they are in good standing with the Alpha Beta Chapter and
            are thereby qualified to reside in the upcoming Winter or Summer House.
          </p>
          <p style={{ margin: 0 }}>
            The resident further agrees to abide by the rules, regulations and guidelines set forth by the
            fraternity relating to the use of private bedrooms and common areas, including exterior entrances,
            decks and lawns.
          </p>
        </div>
      </Section>

      <div style={{ display: "flex", gap: 40, marginTop: 16 }}>
        {[
          { role: "Resident", name: `${r.first_name} ${r.last_name}` },
          { role: "Chapter representative", name: "" },
        ].map((sig) => (
          <div key={sig.role} style={{ flex: 1, display: "flex", gap: 12, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <div style={{ borderBottom: `1px solid ${INK}`, height: 30 }} />
              <div style={{ ...eyebrow, fontSize: 7.2, paddingTop: 3 }}>Signature — {sig.role}</div>
              <div style={{ borderBottom: `1px solid ${FILL}`, height: 23, marginTop: 13, fontSize: 10.5 }}>
                {sig.name}
              </div>
              <div style={{ ...eyebrow, fontSize: 7.2, paddingTop: 3 }}>Print name</div>
            </div>
            <div style={{ width: "1.1in" }}>
              <div style={{ borderBottom: `1px solid ${FILL}`, height: 23 }} />
              <div style={{ ...eyebrow, fontSize: 7.2, paddingTop: 3 }}>Date</div>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 12,
          paddingTop: 6,
          borderTop: `1px solid ${RULE}`,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 8.5,
          color: MUTED,
        }}
      >
        <span>163 St. George Street is a smoke-free private residence.</span>
        <span>Retain a copy for submission to the CRA for tax deductions.</span>
        <span>Rev. {TEMPLATE_REVISION}</span>
      </div>
    </div>
  );
}

// ── Page shell ─────────────────────────────────────────────────────────────

export default function HouseAgreementPrintPage() {
  const router = useRouter();
  const autoprint = router.query.autoprint === "1";

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<AgreementData | null>(null);

  React.useEffect(() => {
    if (!router.isReady) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (router.query.year) qs.set("year", String(router.query.year));
        if (router.query.session) qs.set("session", String(router.query.session));
        if (router.query.brother) qs.set("brother_id", String(router.query.brother));
        const res = await apiClient.get(`/house/agreement?${qs.toString()}`);
        if (!cancelled) setData(res.data);
      } catch (e) {
        if (!cancelled) setError(parseApiError(e).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router.isReady, router.query]);

  React.useEffect(() => {
    if (!autoprint || loading || !data) return;
    const t = setTimeout(() => window.print(), 250);
    return () => clearTimeout(t);
  }, [autoprint, loading, data]);

  if (loading) return <CircularProgress sx={{ m: 4 }} />;
  if (error) return <Alert severity="error" sx={{ m: 4 }}>{error}</Alert>;
  if (!data) return null;

  const extras = { status: (router.query.status as string) || "" };

  return (
    <Box sx={{ bgcolor: "#fff" }}>
      <style>{`
        @page { size: letter portrait; margin: 0.4in; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff; }
        @media screen { body { background: #eceef1; } }
      `}</style>

      {data.residents.length === 0 && (
        <Alert severity="info" sx={{ m: 4 }}>
          No residents assigned for this session.
        </Alert>
      )}

      {data.residents.map((r, i) => (
        <AgreementPage
          key={r.assignment_id}
          r={r}
          data={data}
          isLast={i === data.residents.length - 1}
          extras={{
            ...extras,
            // Default the status tick from the roster when not overridden.
            status: extras.status || (r.brother_status === "Active" ? "Member Resident" : "Non-Member Resident"),
          }}
        />
      ))}
    </Box>
  );
}
