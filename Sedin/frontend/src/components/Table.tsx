import { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  actions?: (row: T) => ReactNode;
}

export function DataTable<T>({ columns, rows, rowKey, actions }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`text-left font-medium text-ink-faint uppercase tracking-wide text-xs px-4 py-3 ${col.className ?? ''}`}
              >
                {col.header}
              </th>
            ))}
            {actions && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="hover:bg-brand-50/60 transition-colors">
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-3.5 text-ink align-middle ${col.className ?? ''}`}>
                  {col.render(row)}
                </td>
              ))}
              {actions && <td className="px-4 py-3.5 text-right">{actions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
