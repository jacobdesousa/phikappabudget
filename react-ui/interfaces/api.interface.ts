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