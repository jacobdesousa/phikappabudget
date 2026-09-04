import CategoryYearConfig from "../components/categoryYearConfig/categoryYearConfig";
import {
  addExpenseCategory,
  addExpenseCategoryToYear,
  deleteExpenseCategory,
  getExpenseCategoryYear,
  importExpenseCategoryYear,
  removeExpenseCategoryFromYear,
  updateExpenseCategory,
} from "../services/expenseCategoryService";

export default function ExpensesConfigPage() {
  return (
    <CategoryYearConfig
      title="Expenses Config"
      description="Which expense categories each school year offers."
      entryNoun="expense"
      fetchYear={getExpenseCategoryYear}
      addToYear={addExpenseCategoryToYear}
      removeFromYear={removeExpenseCategoryFromYear}
      importYear={importExpenseCategoryYear}
      createCategory={(name, year) => addExpenseCategory({ name }, year)}
      renameCategory={(id, name) => updateExpenseCategory(id, { name })}
      deleteCategory={deleteExpenseCategory}
    />
  );
}
