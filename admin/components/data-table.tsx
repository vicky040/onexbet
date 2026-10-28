import type { ReactNode } from "react";
import clsx from "clsx";
import { EmptyState } from "./ui";

/**
 * One list, two shapes.
 *
 * On a wide screen this is a table. On a phone a table either overflows
 * sideways or squashes into unreadable columns, so the same rows render as
 * stacked cards with each value labelled by its column header.
 *
 * Declaring columns once is what makes that possible — a hand-written
 * `<tr>` cannot be re-laid-out into a card.
 */

export type Column<Row> = {
  /** Column heading. Also the label beside the value in card form. */
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  /** Right-aligned, tabular figures. */
  numeric?: boolean;
  /**
   * Shown as the card's title instead of a labelled row. Use for the one
   * field that identifies the record.
   */
  primary?: boolean;
  /** Rendered in the card's footer, full width — for buttons. */
  actions?: boolean;
  /** Dropped from the card to keep it short. Still in the table. */
  tableOnly?: boolean;
};

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  empty,
  minWidth = "44rem",
}: {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  empty: string;
  minWidth?: string;
}) {
  if (rows.length === 0) return <EmptyState>{empty}</EmptyState>;

  const primary = columns.filter((column) => column.primary);
  const actions = columns.filter((column) => column.actions);
  const details = columns.filter(
    (column) => !column.primary && !column.actions && !column.tableOnly,
  );

  return (
    <>
      {/* Cards: phones and small tablets. */}
      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            className="rounded-xl border border-line bg-inset/40 p-4"
          >
            {primary.map((column, index) => (
              <div key={index} className="mb-3">
                {column.cell(row)}
              </div>
            ))}

            <dl className="space-y-1.5">
              {details.map((column, index) => (
                <div key={index} className="flex items-baseline justify-between gap-3">
                  <dt className="shrink-0 text-xs font-medium text-muted">
                    {column.header}
                  </dt>
                  <dd
                    className={clsx(
                      "min-w-0 text-right text-sm",
                      column.numeric && "tabular",
                    )}
                  >
                    {column.cell(row)}
                  </dd>
                </div>
              ))}
            </dl>

            {actions.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                {actions.map((column, index) => (
                  <div key={index}>{column.cell(row)}</div>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {/* Table: from md up. */}
      <div className="-mx-5 hidden overflow-x-auto md:block">
        <table
          className="w-full border-collapse text-sm"
          style={{ minWidth }}
        >
          <thead>
            <tr className="border-b border-line text-left">
              {columns.map((column, index) => (
                <th
                  key={index}
                  scope="col"
                  className={clsx(
                    "px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted",
                    column.numeric && "text-right",
                    column.actions && "text-right",
                  )}
                >
                  {column.actions ? "" : column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-inset/60">
                {columns.map((column, index) => (
                  <td
                    key={index}
                    className={clsx(
                      "px-5 py-3 align-middle",
                      column.numeric && "tabular whitespace-nowrap text-right",
                    )}
                  >
                    {column.actions ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        {column.cell(row)}
                      </div>
                    ) : (
                      column.cell(row)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
