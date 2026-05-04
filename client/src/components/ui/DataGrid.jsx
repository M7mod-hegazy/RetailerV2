import React, { useState, useRef, useMemo } from "react";
import SortTh from "./SortTh";

export default function DataGrid({ 
  columns = [], // { id, header, width, sortable, render, cellClass, headerClass, sortValue }
  data = [], 
  emptyMessage = "لا توجد بيانات",
  emptyIcon = null,
  rowKey = "id", 
  rowClass = () => "", 
  renderExpandedRow = null,
  sortConfig: externalSortConfig,
  onSort: externalOnSort,
  className = "",
  containerClass = "flex-1 overflow-x-auto overflow-y-auto bg-white scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent rounded-md border border-slate-200"
}) {
  const defaultWidths = {};
  columns.forEach(c => defaultWidths[c.id] = c.width || 120);

  const [colWidths, setColWidths] = useState(defaultWidths);
  const [internalSortConfig, setInternalSortConfig] = useState({ key: null, dir: "asc" });

  const currentSort = externalSortConfig !== undefined ? externalSortConfig : internalSortConfig;

  const resizingCol = useRef(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onResizeStart = (e, key) => {
    e.preventDefault();
    e.stopPropagation();
    resizingCol.current = key;
    startX.current = e.clientX;
    startWidth.current = colWidths[key] || 100;
    document.body.classList.add("cursor-col-resize", "select-none");
    const onMouseMove = (moveEvent) => {
      if (!resizingCol.current) return;
      const diff = startX.current - moveEvent.clientX; 
      const newWidth = Math.max(startWidth.current + diff, 40); 
      setColWidths(prev => ({ ...prev, [resizingCol.current]: newWidth }));
    };
    const onMouseUp = () => {
      resizingCol.current = null;
      document.body.classList.remove("cursor-col-resize", "select-none");
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const toggleSort = (key) => {
    if (externalOnSort) {
      externalOnSort(key);
    } else {
      setInternalSortConfig(prev => prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
    }
  };

  const sortedData = useMemo(() => {
    // If explicitly controlled, simply return data (parent does sorting)
    if (externalSortConfig !== undefined) return data;

    if (!currentSort.key) return data;
    return [...data].sort((a, b) => {
      const col = columns.find(c => c.id === currentSort.key);
      let valA = a[currentSort.key];
      let valB = b[currentSort.key];
      
      if (col?.sortValue) {
        valA = col.sortValue(a);
        valB = col.sortValue(b);
      }

      const numA = Number(valA);
      const numB = Number(valB);
      // We check strict numeric compatibility
      const isNum = !isNaN(numA) && !isNaN(numB) && valA !== "" && valB !== "" && valA != null && valB != null;

      if (isNum) {
        return currentSort.dir === "asc" ? numA - numB : numB - numA;
      } else {
        valA = String(valA || "");
        valB = String(valB || "");
        return currentSort.dir === "asc" ? valA.localeCompare(valB, "ar") : -valA.localeCompare(valB, "ar");
      }
    });
  }, [data, currentSort, columns, externalSortConfig]);

  return (
    <div className={containerClass}>
      {sortedData.length === 0 ? (
        <div className="flex h-full w-full select-none flex-col items-center justify-center py-10 opacity-40 min-h-[200px]">
          {emptyIcon && <div className="mb-4 text-slate-400">{emptyIcon}</div>}
          <span className="text-[14px] font-black tracking-widest text-slate-500">{emptyMessage}</span>
        </div>
      ) : (
        <table className={`w-full text-sm border-collapse min-w-max ${className}`}>
          <thead className="bg-slate-50/90 text-slate-500 sticky top-0 z-10 shadow-sm border-b border-slate-200/80">
            <tr>
              {columns.map(c => (
                <SortTh 
                  key={c.id}
                  label={c.header} 
                  sortKey={c.sortable ? c.id : null} 
                  width={colWidths[c.id]} 
                  onResizeStart={onResizeStart} 
                  resizableKey={c.id} 
                  sortConfig={currentSort} 
                  onSort={c.sortable ? toggleSort : null} 
                  className={c.headerClass || "text-center"} 
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, i) => (
              <React.Fragment key={row[rowKey] || i}>
                <tr className={`group border-b border-slate-100 hover:bg-slate-50 transition-colors bg-white ${rowClass(row)}`}>
                  {columns.map(c => (
                    <td 
                      key={c.id} 
                      className={`px-2 py-2 text-[13px] text-slate-800 border-l border-slate-100/50 truncate align-middle ${c.cellClass || "text-center"}`} 
                      style={{ maxWidth: colWidths[c.id] }}
                    >
                      {c.render ? c.render(row, i) : (row[c.id] || "-")}
                    </td>
                  ))}
                </tr>
                {renderExpandedRow && renderExpandedRow(row, i)}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
