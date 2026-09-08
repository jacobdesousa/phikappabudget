// Table styling for the config pages, matching the roster, dues, revenue and
// expense tables: tight rows, small type, and a fixed layout so columns do not
// re-measure as rows are added or filtered.
//
// Config pages had been carrying three different sets of these — one page at
// py: "1px", another at the MUI default — which is why no two tables lined up.
export const CELL_SX = { py: 0.25, px: 1, fontSize: "0.8rem", whiteSpace: "nowrap" as const };
export const HEAD_SX = { ...CELL_SX, py: 0.75, fontWeight: 700 };

// A cell holding an input. Inputs bring their own padding, so the row would sit
// taller than a text row without this.
export const INPUT_CELL_SX = { py: 0.25, px: 0.5 };

// Props shared by every config table.
export const TABLE_SX = { minWidth: 0, tableLayout: "fixed" as const };

// The scroll container: wide tables scroll inside themselves rather than
// pushing the page sideways.
export const TABLE_CONTAINER_SX = { overflowX: "auto" as const, width: "100%" };
