export interface IBrother {
  id?: number;
  last_name: string;
  first_name: string;
  email: string;
  phone: string;
  pledge_class: string;
  graduation: number;
  office: string;
  status: string;
}

export interface IDues {
  id: number;
  first_instalment_date: Date;
  first_instalment_amount: number;
  second_instalment_date: Date;
  second_instalment_amount: number;
  third_instalment_date: Date;
  third_instalment_amount: number;
  fourth_instalment_date: Date;
  fourth_instalment_amount: number;
}

export interface IRevenueCategory {
  id?: number;
  name: string;
}

export interface IRevenue {
  id?: number;
  date: Date;
  description: string;
  category_id: number;
  amount: number;
}

export interface IExpense {
  id?: number;
  expense_date: Date;
  item: string;
  budget_id: number;
  payee_id: number;
  amount: number;
  paid: boolean;
  cheque_id: number;
  disbursement_date: Date;
  // receipt: ?
}

export interface IBudgetItem {
  id?: number;
  name: string;
}
