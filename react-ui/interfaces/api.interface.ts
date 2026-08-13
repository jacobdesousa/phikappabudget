export interface IBrotherOffice {
    id: number;
    brother_id: number;
    office_key: string;
    display_name: string;
    start_date: string;
    end_date: string | null;
    created_at?: string;
}

export interface IBrother {
    id?: number;
    last_name: string;
    first_name: string;
    email: string;
    phone: string;
    pledge_class: string;
    graduation: number;
    office?: string | null;
    status: string;
    current_offices?: IBrotherOffice[];
    // A second email address, common on the alumni records.
    email_secondary?: string | null;
    // Home address. Optional throughout — most of the roster has none.
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    province?: string | null;
    postal_code?: string | null;
    country?: string | null;
}

// The address half of a brother record, as the form holds it: blanks, never
// nulls, so the same object can be spread straight into a payload.
export interface IBrotherAddress {
    email_secondary: string;
    address_line1: string;
    address_line2: string;
    city: string;
    province: string;
    postal_code: string;
    country: string;
}

export interface IDues {
    id: number;
    first_instalment_date: string | Date | null;
    first_instalment_amount: number;
    second_instalment_date: string | Date | null;
    second_instalment_amount: number;
    third_instalment_date: string | Date | null;
    third_instalment_amount: number;
    fourth_instalment_date: string | Date | null;
    fourth_instalment_amount: number;
}

export interface IDuesPayment {
    id?: number;
    brother_id: number;
    paid_at: string | Date;
    amount: number;
    memo?: string | null;
    dues_year?: number | null;
}

export interface IDuesSummaryRow {
    brother_id: number;
    first_name: string;
    last_name: string;
    pledge_class?: string | null;
    dues_category?: "regular" | "neophyte" | string;
    total_paid: number | string;
    payment_count: number | string;
    last_paid_at: string | Date | null;
    year?: number;
    total_owed?: number | string;
    due_to_date?: number | string;
    balance_total?: number | string;
    balance_due_to_date?: number | string;
    is_behind?: boolean;
}

export interface IDuesInstalment {
    id?: number;
    year: number;
    label?: string | null;
    due_date: string | Date;
    amount: number;
}

export interface IDuesConfig {
    year: number;
    regular: {
        total_amount: number | string;
        instalments: Array<IDuesInstalment>;
    };
    neophyte: {
        total_amount: number | string;
        instalments: Array<IDuesInstalment>;
    };
}

export interface IRevenueCategory {
    id?: number
    name: string;
}

export interface IRevenue {
    id?: number;
    date: string | Date;
    description: string;
    category_id: number;
    // Payment-stream breakdown:
    cash_amount?: number | null;
    square_amount?: number | null;
    etransfer_amount?: number | null;
    // Total (cash + square + e-transfer). Backend also keeps this in `amount`.
    amount: number;
    category_name?: string | null;
    school_year?: number | null;
}

export interface IRevenueSummary {
    year: number;
    manual_total: number;
    dues_total: number;
    dues_regular_total: number;
    dues_neophyte_total: number;
    total_revenue: number;
}

export interface IExpenseCategory {
    id?: number;
    name: string;
}

export interface IExpense {
    id?: number;
    date: string | Date;
    description: string;
    category_id: number;
    category_name?: string | null;
    amount: number;
    reimburse_brother_id?: number | null;
    reimburse_first_name?: string | null;
    reimburse_last_name?: string | null;
    cheque_number?: string | null;
    school_year?: number | null;
    status?: "submitted" | "approved" | "paid" | "rejected" | string;
    submitted_by_name?: string | null;
    receipt_url?: string | null;
    submitted_at?: string | Date | null;
    approved_at?: string | Date | null;
    paid_at?: string | Date | null;
}

export interface IMeetingAttendanceRow {
    id?: number;
    meeting_id?: number;
    brother_id?: number | null;
    member_name?: string | null;
    status: string;
    late_arrival_time?: string | null;
    excused_reason?: string | null;
    first_name?: string | null;
    last_name?: string | null;
}

export interface IMeetingOfficerNote {
    id?: number;
    meeting_id?: number;
    officer_key: string;
    notes?: string | null;
}

export interface IMeetingMinutesListItem {
    id: number;
    meeting_date: string | Date;
    title?: string | null;
    school_year?: number | null;
    created_at?: string | Date | null;
    updated_at?: string | Date | null;
}

export interface IMeetingMinutes extends IMeetingMinutesListItem {
    attendance: Array<IMeetingAttendanceRow>;
    officer_notes: Array<IMeetingOfficerNote>;
    communications?: string | null;
    old_business?: string | null;
    new_business?: string | null;
    betterment?: string | null;
    motion_accept_moved_by_brother_id?: number | null;
    motion_accept_seconded_by_brother_id?: number | null;
    motion_end_moved_by_brother_id?: number | null;
    motion_end_seconded_by_brother_id?: number | null;
}

export interface IChapterBonusDeduction {
    id?: number;
    month: string; // YYYY-MM
    amount: number;
    violation_type: string;
    comments?: string | null;
    photo_url?: string | null;
    created_at?: string | Date | null;
}

export interface IChapterBonusRuleTier {
    id?: number;
    tier_number: number;
    amount: number;
}

export interface IChapterBonusRule {
    id?: number;
    violation_type: string;
    description?: string | null;
    tiers: Array<IChapterBonusRuleTier>;
    created_at?: string | Date | null;
}

export interface IWorkdayListItem {
    id?: number;
    workday_date: string | Date;
    bonus_month?: string | null; // YYYY-MM
    title?: string | null;
    school_year?: number | null;
    created_at?: string | Date | null;
    updated_at?: string | Date | null;
}

export interface IWorkdayAttendanceRow {
    id?: number;
    workday_id?: number;
    brother_id: number;
    status: "Present" | "Late" | "Excused" | "Missing" | string;
    first_name?: string | null;
    last_name?: string | null;
    brother_status_at_workday?: "Active" | "Pledge" | string | null;
    coveralls?: boolean | null;
    nametag?: boolean | null;
    makeup_completed_at?: string | Date | null;
}

export interface IWorkdaySummary {
    attended_counts: {
        active_present: number;
        active_late: number;
        active_coveralls: number;
        active_coveralls_nametag: number;
        pledge_present: number;
        pledge_late: number;
        total: number;
    };
    earnings_total: number;
}

export interface IWorkday extends IWorkdayListItem {
    attendance: Array<IWorkdayAttendanceRow>;
    summary?: IWorkdaySummary;
}

export interface IWorkdayConfig {
    active_rate: number;
    pledge_rate: number;
}

export interface IVoteOption {
    id: number;
    option_text: string;
    display_order: number;
}

export interface IVote {
    id: number;
    meeting_id: number;
    question: string;
    allow_multiple: boolean;
    is_anonymous: boolean;
    status: 'open' | 'closed';
    results_visible: boolean;
    created_at?: string | null;
    closed_at?: string | null;
    options: IVoteOption[];
    my_response?: { option_ids: number[] } | null;
}

export interface IVoteResult {
    vote_id: number;
    question: string;
    is_anonymous: boolean;
    status: 'open' | 'closed';
    options: Array<{ id: number; option_text: string; count: number }>;
    voters?: Array<{ option_id: number; user_id: number; email: string; first_name: string | null; last_name: string | null }>;
    voters_anon?: Array<{ user_id: number; email: string; first_name: string | null; last_name: string | null }>;
}

export interface IShiftAssignment {
    id?: number;
    brother_id: number;
    first_name?: string | null;
    last_name?: string | null;
    status: 'assigned' | 'present' | 'absent';
    makeup_completed_at?: string | null;
}

export interface IShiftPartyDuty {
    id: number;
    name: string;
    display_order: number;
}

export interface IShiftPartySlot {
    id?: number;
    duty_id: number;
    duty_name?: string;
    slot_start: string;
    brother_id?: number | null;
    first_name?: string | null;
    last_name?: string | null;
    status: 'unassigned' | 'assigned' | 'present' | 'absent';
    makeup_completed_at?: string | null;
}

export interface IShiftEvent {
    id: number;
    shift_type: 'setup' | 'cleanup' | 'party';
    event_date: string;
    title?: string | null;
    school_year?: number | null;
    notes?: string | null;
    party_start_time?: string | null;
    party_end_time?: string | null;
    created_at?: string | null;
    assignment_count?: number;
    assignments?: IShiftAssignment[];
    duties?: IShiftPartyDuty[];
    slots?: IShiftPartySlot[];
}

export interface IShiftBrotherCount {
    brother_id: number;
    first_name: string;
    last_name: string;
    count: number;
}

export interface IRoomDrawBreakdown {
    past_brother: number;
    past_office: number;
    incoming: number;
    meeting_deductions: number;
    workday_deductions: number;
    legacy: number;
}

export interface IRoomDrawOfficeTerm {
    office_key: string;
    display_name: string;
    start_date: string;
    end_date: string | null;
    semesters: string[];
    past_points: number;
    incoming_points: number;
}

export interface IRoomDrawDetails {
    active_semesters: string[];
    office_terms: IRoomDrawOfficeTerm[];
    missed_meetings: number;
    missed_workdays: number;
}

export interface IRoomDrawStanding {
    brother_id: number;
    first_name: string;
    last_name: string;
    total: number;
    breakdown: IRoomDrawBreakdown;
    details: IRoomDrawDetails;
    over_graduation: boolean;
    bypasses_ranking: boolean;
    accumulation_end: string | null;
    points_stripped: boolean;
}

export interface IBudgetExpenseRow {
    category_id: number;
    category_name: string;
    prior_year_actual: number;
    budgeted_amount: number;
    actual_amount: number;
    remaining: number;
}

export interface IBudgetRevenueEntry {
    id: number;
    date: string;
    description: string;
    amount: number;
    cash_amount: number;
    square_amount: number;
    etransfer_amount: number;
}

export interface IBudgetRevenueRow {
    category_id: number;
    category_name: string;
    prior_year_actual: number;
    budgeted_amount: number;
    actual_amount: number;
    entries: IBudgetRevenueEntry[];
    is_dues?: boolean;
    is_chapter_bonus?: boolean;
}

export interface IBudgetDuesConfig {
    active_count: number;
    dues_rate_active: number;
    dues_rate_pledge: number;
    estimated_pledges: number;
    chapter_bonus_monthly_rate: number;
}

export interface IBudgetReconciliation {
    cash_amount: number;
    emergency_reserve: number;
    bank_balance: number;
    accounts_receivable: number;
}

export interface IBudgetSummary {
    year: number;
    expense_rows: IBudgetExpenseRow[];
    revenue_rows: IBudgetRevenueRow[];
    dues_config: IBudgetDuesConfig;
    reconciliation: IBudgetReconciliation;
    outstanding_disbursements: { count: number; total: number };
    totals: {
        expense: { budgeted: number; actual: number; remaining: number };
        revenue: { budgeted: number; actual: number };
        net: number;
    };
}

export interface IRoomDrawLegacyAdjustment {
    id?: number;
    brother_id: number;
    first_name?: string;
    last_name?: string;
    points: number;
    reason: string;
    created_at?: string;
}

// ── Chapter house ───────────────────────────────────────────────────────────

export type HouseSessionType = "winter" | "summer";
export type HouseOccupancy = "standard" | "full_room";
export type HouseDepositStatus = "outstanding" | "received" | "refunded";

export interface IHouseRoom {
    id: number;
    room_code: string;
    floor: number | null;
    sort_order: number | null;
    is_active: boolean;
    notes: string | null;
}

export interface IHouseInstalment {
    seq: number;
    due_date: string | null;
    weight_pct: number;
}

export interface IHouseSession {
    session_type: HouseSessionType;
    // 4-month terms in the session: winter is 2, summer 1.
    terms: number;
    start_date: string | null;
    end_date: string | null;
    member_rebate: number;
    prepay_discount_pct: number;
    prepay_deadline: string | null;
    security_deposit_amount: number;
    instalments: IHouseInstalment[];
}

export interface IHouseRoomRate {
    session_type: HouseSessionType;
    room_id: number;
    capacity: number;
    rate_per_person: number | null;
}

export interface IHousePayee {
    payee: string;
    pct: number;
    is_internal: boolean;
    sort_order: number | null;
}

export interface IHouseConfig {
    year: number;
    rooms: IHouseRoom[];
    sessions: IHouseSession[];
    rates: IHouseRoomRate[];
    payees: IHousePayee[];
    is_configured: boolean;
}

export interface IHouseAssignment {
    id: number;
    school_year: number;
    session_type: HouseSessionType;
    room_id: number;
    bed: number;
    brother_id: number;
    occupancy: HouseOccupancy;
    start_date: string | null;
    end_date: string | null;
    base_amount: number | null;
    amount_override: number | null;
    override_note: string | null;
    member_discount: boolean;
    double_rebate: boolean;
    prepay_discount: boolean;
    notes: string | null;
    room_code: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    brother_status: string | null;
    capacity: number;
    resolved_rate: number | null;
    base_amount_effective: number;
    session_base: number;
    terms: number;
    rebate_per_term: number;
    rebate_beds: number;
    rebate_amount: number;
    prepay_pct: number;
    prepay_amount: number;
    // True when amount_override is set: the fee is billed exactly as entered,
    // with rebate_amount and prepay_amount forced to 0.
    is_override: boolean;
    total_owed: number;
}

export interface IHouseRosterRoom extends IHouseRoom {
    capacity: number;
    rate_per_person: number | null;
    is_bought_out: boolean;
    beds: { bed: number; assignments: IHouseAssignment[] }[];
}

export interface IHouseRoster {
    year: number;
    session_type: HouseSessionType;
    session: IHouseSession | null;
    instalments: IHouseInstalment[];
    rooms: IHouseRosterRoom[];
}

export interface IHousePayment {
    id: number;
    brother_id: number;
    school_year: number;
    session_type: HouseSessionType;
    assignment_id: number | null;
    paid_at: string;
    amount: number;
    memo: string | null;
    first_name?: string;
    last_name?: string;
}

export interface IHouseDepositDeduction {
    id?: number;
    description: string | null;
    amount: number;
}

export interface IHouseDeposit {
    id: number;
    brother_id: number;
    amount: number;
    received_at: string | null;
    status: HouseDepositStatus;
    released_at: string | null;
    // The cheque the refund went out on; only meaningful once refunded.
    refund_cheque_number: string | null;
    note: string | null;
    deductions: IHouseDepositDeduction[];
    first_name?: string;
    last_name?: string;
}

export interface IHouseResidentRow {
    brother_id: number;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    brother_status: string | null;
    assignments: IHouseAssignment[];
    year: number;
    session_type: HouseSessionType;
    total_owed: number;
    total_paid: number;
    payment_count: number;
    last_paid_at: string | null;
    deposit_held: number;
    due_to_date: number;
    balance_total: number;
    balance_due_to_date: number;
    is_behind: boolean;
}

export interface IHouseSummary {
    year: number;
    session_type: HouseSessionType;
    session: IHouseSession | null;
    instalments: IHouseInstalment[];
    residents: IHouseResidentRow[];
}

export interface IHouseDisbursementShare {
    id: number;
    payee: string;
    // Captured at creation, so a later config change can't rewrite history.
    pct: number;
    amount: number;
    // The cheque this payee was paid with. Each payee is paid separately.
    cheque_number: string | null;
    revenue_id: number | null;
    // Year-to-date for this payee, restarting each school year.
    running_total: number;
}

export interface IHouseDisbursement {
    id: number;
    school_year: number;
    session_type: HouseSessionType;
    // Identifies and orders the disbursement; school_year and session_type are
    // derived from it.
    disbursed_on: string;
    bank_balance: number;
    security_to_refund: number;
    security_on_account: number;
    // Derived server-side: bank_balance − both security lines.
    sub_total: number;
    notes: string | null;
    shares: IHouseDisbursementShare[];
}

export type HouseTransactionKind =
    | "payment"
    | "deposit"
    | "deposit_refund"
    | "disbursement"
    | "adjustment";

// Derived, never stored — one row per movement of money through the residence
// account. A refunded deposit appears twice: in when received, out when
// released.
export interface IHouseTransaction {
    kind: HouseTransactionKind;
    source_id: number;
    occurred_on: string;
    counterparty: string | null;
    detail: string | null;
    cheque_number: string | null;
    // Signed: positive into the account, negative out.
    amount: number;
    // Balance after this row, computed over the whole ledger in date order.
    running_balance: number;
}

export interface IHouseTransactionPage {
    limit: number;
    offset: number;
    total: number;
    transactions: IHouseTransaction[];
}

// Write-only: cheque numbers keyed by payee, sent alongside a disbursement.
// The amounts themselves are always computed server-side.
export interface IHouseDisbursementCheque {
    payee: string;
    cheque_number: string | null;
}

export interface IHouseAccountAdjustment {
    id: number;
    occurred_on: string;
    // Signed: a bank fee is negative, the PM revenue bonus positive.
    amount: number;
    description: string | null;
    school_year: number;
    // Set when the row is the automatic reconciliation booked because a
    // disbursement's entered bank balance differed from the derived one.
    disbursement_id: number | null;
}

export interface IHouseAccountBalance {
    payments_total: number;
    deposits_in: number;
    deposits_held: number;
    deposits_refunded: number;
    disbursed_total: number;
    adjustments_total: number;
    balance: number;
    undisbursed_surplus: number;
}

// The deposit money in the account, split by whether the resident is still
// here. Both figures are gross, so to_refund + held is exactly the deposits on
// hand — which is what a disbursement subtracts.
export interface IHouseSecuritySnapshot {
    // The session the split was measured against — today's, not a chosen one.
    as_of_year: number;
    as_of_session: HouseSessionType;
    to_refund: number;
    held: number;
    to_refund_count: number;
    held_count: number;
}

export interface IHouseAccount {
    current_year: number;
    balance: IHouseAccountBalance;
    security: IHouseSecuritySnapshot;
    payees: IHousePayee[];
    disbursements: IHouseDisbursement[];
    adjustments: IHouseAccountAdjustment[];
}

// ── House chores ────────────────────────────────────────────────────────────
// The schedule is a stored grid — one duty per bed per half-month, matching the
// printed sheet — edited on the chores config page.

export interface IChoreDuty {
    duty_no: number;
    name: string;
    description: string | null;
}

// A row of the schedule: one bed. Read-only here — bedrooms and their capacity
// are configured in House Config.
export interface IChoreBed {
    room_id: number;
    room_code: string;
    floor: number | null;
    sort_order: number | null;
    bed: number;
    capacity: number;
    bed_label: string;
}

// One filled cell of the schedule. There is a single schedule, repeated every
// year. Cleared cells are absent, meaning that bed is off duty.
export interface IChoreGridCell {
    room_id: number;
    bed: number;
    // 0-23: September 1st-half through August 2nd-half.
    period_index: number;
    duty_no: number;
}

export interface IChoreSettings {
    // First day of the second period of each month.
    split_day: number;
    manager_notes: string | null;
}

export interface IChoreCaptain {
    captain_key: string;
    name: string;
    description: string | null;
    brother_id: number | null;
    sort_order: number | null;
    first_name?: string | null;
    last_name?: string | null;
}

export interface IChoreEntry {
    room_id: number;
    room_code: string;
    // The bedroom's position in House Config.
    sort_order: number | null;
    bed: number;
    bed_label: string;
    duty_no: number;
    duty_name: string | null;
    duty_description: string | null;
    brother_id: number | null;
    first_name: string | null;
    last_name: string | null;
    is_vacant: boolean;
}

export interface IChorePeriod {
    half: 0 | 1;
    year: number;
    month: number;
    period_index: number;
    start_date: string;
    end_date: string;
    label: string;
    month_label: string;
    school_year: number;
    session_type: HouseSessionType;
    entries: IChoreEntry[];
}

export interface IChoreCurrent {
    today: string;
    settings: IChoreSettings;
    duties: IChoreDuty[];
    current: IChorePeriod;
    next: IChorePeriod;
    captains: IChoreCaptain[];
}

export interface IChoreSchedule {
    year: number;
    from: string;
    to: string;
    settings: IChoreSettings;
    duties: IChoreDuty[];
    periods: IChorePeriod[];
}

export interface IChoreConfig {
    settings: IChoreSettings;
    duties: IChoreDuty[];
    // The schedule's rows, derived from House Config.
    beds: IChoreBed[];
    grid: IChoreGridCell[];
    captains: IChoreCaptain[];
    is_configured: boolean;
}

// ── Alumni donations and bonds ──────────────────────────────────────────────
// A donation row is either bond money or a general gift: a cheque that straddles
// the bond line is stored as two rows, so campaign totals never include bond
// money. See api/src/controllers/donationsController.js.
export type DonationKind = "bond" | "general";

export interface IDonation {
    id: number;
    brother_id: number;
    donated_on: string;
    amount: number | string;
    kind: DonationKind;
    campaign_id: number | null;
    school_year: number | null;
    note: string | null;
    first_name: string | null;
    last_name: string | null;
    campaign_name: string | null;
}

export interface IDonationCampaign {
    // Absent on a campaign the config page has just added.
    id?: number | null;
    name: string;
    description?: string | null;
    starts_on?: string | null;
    ends_on?: string | null;
    goal_amount?: number | string | null;
    is_active: boolean;
    sort_order?: number | null;
    // Read-only rollups over the donations pinned to the campaign.
    raised?: number | string;
    donation_count?: number;
    donor_count?: number;
    last_donation_on?: string | null;
}

export interface IDonationConfig {
    // The price a *new* bond opens at. Existing bonds keep their own.
    bond_price: number;
    campaigns: IDonationCampaign[];
}

export interface IBondState {
    brother_id: number;
    has_bond: boolean;
    bond_price: number;
    bond_paid: number;
    bond_outstanding: number;
    opened_on: string | null;
    // The certificate number, issued once the bond is paid off. Often not known
    // when the donation is entered, so it is filled in later.
    bond_number: string | null;
    notes: string | null;
}

export interface IDonorSummary {
    brother_id: number;
    first_name: string | null;
    last_name: string | null;
    pledge_class: string | null;
    status: string | null;
    has_bond: boolean;
    bond_price: number | null;
    bond_opened_on: string | null;
    bond_number: string | null;
    bond_paid: number;
    bond_outstanding: number | null;
    lifetime_total: number;
    donation_count: number;
    last_donation_on: string | null;
}

export interface IDonationRollup {
    raised: number;
    donation_count: number;
    donor_count: number;
    last_donation_on: string | null;
}

export interface IDonationSummary {
    bond_price: number;
    totals: {
        lifetime_total: number;
        bond_total: number;
        general_total: number;
        donor_count: number;
        bond_outstanding: number;
    };
    campaigns: IDonationCampaign[];
    // The two rows the campaigns table carries above the campaigns: bond money
    // (never belongs to a campaign) and gifts pinned to none. Between them and
    // the campaigns, every donation is reachable.
    bond_payments: IDonationRollup;
    unattached: IDonationRollup;
    brothers: IDonorSummary[];
}

export interface IDonationPage {
    rows: IDonation[];
    total: number;
    total_amount: number;
}
