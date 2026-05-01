import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Alert,
  Box,
  Button,
  Container,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { getExpenseCategories } from "../services/expenseCategoryService";
import { getAllBrothers } from "../services/brotherService";
import { IBrother, IExpenseCategory } from "../interfaces/api.interface";
import { normalizeMoneyInput, roundMoney } from "../utils/money";
import { submitExpenseWithReceipt } from "../services/expenseWorkflowService";

export default function ExpenseSubmitPage() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<IExpenseCategory[]>([]);
  const [brothers, setBrothers] = useState<IBrother[]>([]);

  const [submitterBrotherId, setSubmitterBrotherId] = useState<number | "">("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState<string>("");
  const [receipt, setReceipt] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([getExpenseCategories(), getAllBrothers()])
      .then(([cats, bros]) => {
        setCategories(cats);
        setBrothers(bros);
      })
      .finally(() => setLoading(false));
  }, []);

  const amountNumber = useMemo(() => roundMoney(Number(amount)), [amount]);

  async function onSubmit() {
    setError(undefined);
    setSuccess(false);
    if (!submitterBrotherId || !receipt || Number.isNaN(amountNumber) || amountNumber <= 0) {
      setError("Please select your name, enter an amount, and attach a receipt.");
      return;
    }
    setSubmitting(true);
    const res = await submitExpenseWithReceipt({
      submitter_brother_id: Number(submitterBrotherId),
      category_id: categoryId ? Number(categoryId) : null,
      amount: amountNumber,
      date,
      description: description.trim() || undefined,
      receipt,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error?.message ?? "Could not submit expense.");
      return;
    }
    setSuccess(true);
    setSubmitterBrotherId("");
    setCategoryId("");
    setAmount("");
    setDescription("");
    setReceipt(null);
  }

  return (
    <Box sx={{ bgcolor: "#f6f7fb", minHeight: "100vh", py: { xs: 3, md: 6 } }}>
      <Container maxWidth="sm">
        <Stack spacing={2}>
          <Box sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
            <Image
              src="/alphabeta.png"
              alt="Alpha Beta Logo"
              width={120}
              height={120}
              priority
            />
          </Box>

          <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="h5">Expense submission</Typography>
            <Typography variant="body2" color="text.secondary">
              Upload your receipt and submit an expense for the Tau to review.
            </Typography>
          </Paper>

          <Paper elevation={2} sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={2}>
              {error && <Alert severity="error">{error}</Alert>}
              {success && <Alert severity="success">Submitted! The Tau will review it shortly.</Alert>}

              <TextField
                select
                label="Your name"
                value={submitterBrotherId}
                onChange={(e) => setSubmitterBrotherId(e.target.value as any)}
                fullWidth
                required
                disabled={loading}
              >
                {brothers.map((b) => (
                  <MenuItem key={b.id ?? `${b.first_name}-${b.last_name}`} value={b.id ?? ""}>
                    {b.first_name} {b.last_name}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Category (optional)"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value as any)}
                fullWidth
                disabled={loading}
              >
                <MenuItem value="">
                  <em>Uncategorized</em>
                </MenuItem>
                {categories.map((c) => (
                  <MenuItem key={c.id ?? c.name} value={c.id ?? ""}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onBlur={() => setAmount(normalizeMoneyInput(amount))}
                  inputProps={{ step: "0.01" }}
                  fullWidth
                  required
                  InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                />
                <TextField
                  label="Date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Stack>

              <TextField
                label="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                fullWidth
                placeholder="e.g. Costco supplies for chapter dinner"
              />

              <Button variant="outlined" component="label">
                {receipt ? `Receipt selected: ${receipt.name}` : "Upload receipt (PDF/JPG/PNG)"}
                <input
                  type="file"
                  hidden
                  accept="application/pdf,image/*"
                  onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
                />
              </Button>

              <Button variant="contained" onClick={onSubmit} disabled={submitting}>
                Submit expense
              </Button>
            </Stack>
          </Paper>

          <Typography variant="caption" color="text.secondary">
            Tip: If you have multiple receipts, submit them as separate expenses.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}


