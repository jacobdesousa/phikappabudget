import CategoryYearConfig from "../components/categoryYearConfig/categoryYearConfig";
import {
  addRevenueCategory,
  addRevenueCategoryToYear,
  deleteRevenueCategory,
  getRevenueCategoryYear,
  importRevenueCategoryYear,
  removeRevenueCategoryFromYear,
  updateRevenueCategory,
} from "../services/revenueCategoryService";

export default function RevenueConfigPage() {
  return (
    <CategoryYearConfig
      title="Revenue Config"
      description="Which revenue categories each school year offers."
      entryNoun="entry"
      fetchYear={getRevenueCategoryYear}
      addToYear={addRevenueCategoryToYear}
      removeFromYear={removeRevenueCategoryFromYear}
      importYear={importRevenueCategoryYear}
      // addRevenueCategory returns a bare status code, unlike its expense twin.
      createCategory={async (name, year) => {
        const status = await addRevenueCategory({ name }, year);
        return { ok: status >= 200 && status < 300 };
      }}
      renameCategory={(id, name) => updateRevenueCategory(id, { name })}
      deleteCategory={deleteRevenueCategory}
    />
  );
}
