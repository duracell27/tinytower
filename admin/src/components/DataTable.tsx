import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { cn } from '../lib/utils';

interface DataTableProps<T> {
  columns: ColumnDef<T, any>[];
  data: T[];
}

export function DataTable<T>({ columns, data }: DataTableProps<T>) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="rounded-md border bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b bg-gray-50">
              {hg.headers.map((h) => (
                <th key={h.id} className="px-4 py-3 text-left font-medium text-gray-700">
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                No records found
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0 hover:bg-gray-50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  return (
    <div className="flex items-center justify-between mt-4 text-sm">
      <span className="text-gray-500">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={cn('px-3 py-1 border rounded', page <= 1 ? 'opacity-40' : 'hover:bg-gray-100')}
        >
          Previous
        </button>
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className={cn('px-3 py-1 border rounded', page >= totalPages ? 'opacity-40' : 'hover:bg-gray-100')}
        >
          Next
        </button>
      </div>
    </div>
  );
}
