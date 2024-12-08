"use client";

import React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  PaginationState,
  ColumnResizeMode,
  getSortedRowModel,
  SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[] | undefined;
  isLoading?: boolean;
  columnResizeMode?: ColumnResizeMode;
}

export function DataTable<TData, TValue>({
  columns,
  data = [],
  isLoading = false,
  columnResizeMode = "onChange",
}: DataTableProps<TData, TValue>) {
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  const [columnSizing, setColumnSizing] = React.useState({});
  const [firstColumnWidth, setFirstColumnWidth] = React.useState(0);
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    columnResizeMode,
    enableColumnResizing: true,
    defaultColumn: {
      minSize: 80,
      size: 150,
    },
    state: {
      pagination,
      columnSizing,
      sorting,
    },
    onColumnSizingChange: setColumnSizing,
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
  });

  const totalColumnsWidth = React.useMemo(() => {
    return table
      .getAllColumns()
      .reduce((acc, column) => acc + column.getSize(), 0);
  }, [table.getAllColumns()]);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const firstColumnRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState(0);

  React.useEffect(() => {
    if (firstColumnRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const contentWidth = Math.ceil(entry.contentRect.width);
          if (contentWidth > 0 && contentWidth !== firstColumnWidth) {
            setFirstColumnWidth(contentWidth + 32); // Add padding
          }
        }
      });

      resizeObserver.observe(firstColumnRef.current);
      return () => resizeObserver.disconnect();
    }
  }, [firstColumnWidth]);

  React.useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width);
        }
      });

      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  React.useEffect(() => {
    if (containerWidth && totalColumnsWidth < containerWidth) {
      const firstColumn = table.getAllColumns()[0];
      const otherColumns = table.getAllColumns().slice(1);

      const desiredFirstColumnWidth = Math.min(
        firstColumnWidth,
        containerWidth * 0.4 // Max 40% of container width
      );

      const remainingWidth = containerWidth - desiredFirstColumnWidth;
      const widthPerColumn = Math.floor(remainingWidth / otherColumns.length);

      const newColumnSizing: Record<string, number> = {
        [firstColumn.id]: desiredFirstColumnWidth,
      };

      otherColumns.forEach((column) => {
        newColumnSizing[column.id] = widthPerColumn;
      });

      setColumnSizing(newColumnSizing);
    }
  }, [containerWidth, totalColumnsWidth, firstColumnWidth]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div ref={containerRef} className="rounded-md border overflow-hidden">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="relative">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      style={{
                        position: "relative",
                        width: header.getSize(),
                      }}
                    >
                      {header.isPlaceholder ? null : (
                        <>
                          <div
                            className={`select-none ${
                              header.index === 0 ? "whitespace-normal" : ""
                            }`}
                            ref={
                              header.index === 0 ? firstColumnRef : undefined
                            }
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                          </div>
                          {header.column.getCanResize() && (
                            <div
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                              className={`resizer ${
                                header.column.getIsResizing()
                                  ? "isResizing"
                                  : ""
                              }`}
                              role="separator"
                            />
                          )}
                        </>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        style={{
                          width: cell.column.getSize(),
                        }}
                      >
                        <div
                          className={
                            cell.column.index === 0 ? "whitespace-normal" : ""
                          }
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      {data.length > 20 && (
        <div className="flex items-center justify-between space-x-2 py-4 px-4">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Rows per page</p>
            <Select
              value={pagination.pageSize.toString()}
              onValueChange={(value) => {
                table.setPageSize(
                  value === "all" ? data.length : Number(value)
                );
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[20, 50, 100, "all"].map((pageSize) => (
                  <SelectItem key={pageSize} value={pageSize.toString()}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </p>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
