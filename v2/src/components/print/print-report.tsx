"use client";

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";

/**
 * PrintReport — renders a print-optimized LCA report.
 *
 * Hidden in normal view, shown only when printing via @media print CSS.
 * Contains: project info, emission totals, material table, charts.
 */
export function PrintReport() {
  const { project, materials, parseResult } = useAppStore();

  // Calculate emissions for print
  const printData = useMemo(() => {
    const rows: Array<{
      name: string;
      matched: boolean;
      volume: number;
      density: number;
      gwp: number;
      ubp: number;
      penre: number;
      matchedTo: string;
    }> = [];

    let totalGwp = 0;
    let totalUbp = 0;
    let totalPenre = 0;
    let totalVolume = 0;

    for (const mat of materials) {
      const vol = mat.totalVolume ?? 0;
      const density = mat.density ?? 0;
      const matched = !!mat.match;
      const indicators = mat.matchedMaterial?.indicators;

      const mass = vol * density;
      const gwp = indicators?.gwpTotal != null ? mass * indicators.gwpTotal : 0;
      const ubp = indicators?.ubp != null ? mass * indicators.ubp : 0;
      const penre = indicators?.penreTotal != null ? mass * indicators.penreTotal : 0;

      totalGwp += gwp;
      totalUbp += ubp;
      totalPenre += penre;
      totalVolume += vol;

      rows.push({
        name: mat.name,
        matched,
        volume: vol,
        density,
        gwp,
        ubp,
        penre,
        matchedTo: mat.matchedMaterial?.name ?? "",
      });
    }

    return {
      rows: rows.sort((a, b) => Math.abs(b.gwp) - Math.abs(a.gwp)),
      totalGwp,
      totalUbp,
      totalPenre,
      totalVolume,
    };
  }, [materials]);

  return (
    <div className="print-report hidden print:block">
      <style>{`
        @media print {
          .print-report {
            display: block !important;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 10pt;
            color: #111;
            padding: 20mm;
          }
          .print-report table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9pt;
          }
          .print-report th,
          .print-report td {
            border: 0.5pt solid #999;
            padding: 4pt 6pt;
            text-align: left;
          }
          .print-report th {
            background-color: #f0f0f0;
            font-weight: 600;
          }
          .print-report .text-right {
            text-align: right;
          }
          .print-report .totals-row {
            font-weight: 600;
            background-color: #f5f5f5;
          }

          /* Hide everything except print report */
          body > *:not(.print-overlay) { display: none !important; }
          .print-overlay { display: block !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: "16pt" }}>
        <h1 style={{ fontSize: "18pt", margin: 0 }}>
          IfcLCA Report: {project?.name ?? "Untitled"}
        </h1>
        <p style={{ fontSize: "9pt", color: "#666", marginTop: "4pt" }}>
          Generated: {new Date().toLocaleDateString()} · Data source:{" "}
          {project?.preferredDataSource?.toUpperCase() ?? "KBOB"}
          {parseResult &&
            ` · ${parseResult.stats.elementCount} elements · ${parseResult.stats.materialCount} materials`}
        </p>
      </div>

      {/* Emission Summary */}
      <div style={{ marginBottom: "16pt" }}>
        <h2 style={{ fontSize: "13pt", marginBottom: "6pt" }}>
          Environmental Impact Summary
        </h2>
        <table>
          <thead>
            <tr>
              <th>Indicator</th>
              <th className="text-right">Value</th>
              <th>Unit</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>GWP Total (Global Warming Potential)</td>
              <td className="text-right">
                {printData.totalGwp.toFixed(2)}
              </td>
              <td>kg CO₂-eq</td>
            </tr>
            <tr>
              <td>UBP (Umweltbelastungspunkte)</td>
              <td className="text-right">
                {printData.totalUbp.toFixed(0)}
              </td>
              <td>UBP</td>
            </tr>
            <tr>
              <td>PENRE (Primary Energy, Non-Renewable)</td>
              <td className="text-right">
                {printData.totalPenre.toFixed(2)}
              </td>
              <td>MJ</td>
            </tr>
          </tbody>
        </table>

        {/* Relative emissions */}
        {project?.areaValue && project.areaValue > 0 && (
          <div style={{ marginTop: "8pt" }}>
            <p style={{ fontSize: "9pt", color: "#666" }}>
              Reference area: {project.areaType ?? "Area"}{" "}
              {project.areaValue.toLocaleString()} m² · Amortization:{" "}
              {project.amortization ?? 50} years
            </p>
            <p style={{ fontSize: "10pt" }}>
              GWP/m²·a:{" "}
              {(
                printData.totalGwp /
                (project.areaValue * (project.amortization ?? 50))
              ).toFixed(2)}{" "}
              kg CO₂-eq/m²·a
            </p>
          </div>
        )}
      </div>

      {/* Materials Table */}
      <div>
        <h2 style={{ fontSize: "13pt", marginBottom: "6pt" }}>
          Materials ({printData.rows.length})
        </h2>
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th className="text-right">Volume (m³)</th>
              <th className="text-right">Density (kg/m³)</th>
              <th className="text-right">GWP (kg CO₂-eq)</th>
              <th className="text-right">UBP</th>
              <th className="text-right">PENRE (MJ)</th>
              <th>Matched To</th>
            </tr>
          </thead>
          <tbody>
            {printData.rows.map((row, i) => (
              <tr key={i}>
                <td>{row.name}</td>
                <td className="text-right">{row.volume.toFixed(4)}</td>
                <td className="text-right">
                  {row.density > 0 ? row.density.toFixed(0) : "—"}
                </td>
                <td className="text-right">
                  {row.gwp !== 0 ? row.gwp.toFixed(2) : "—"}
                </td>
                <td className="text-right">
                  {row.ubp !== 0 ? row.ubp.toFixed(0) : "—"}
                </td>
                <td className="text-right">
                  {row.penre !== 0 ? row.penre.toFixed(2) : "—"}
                </td>
                <td>{row.matchedTo || "—"}</td>
              </tr>
            ))}
            <tr className="totals-row">
              <td>Total</td>
              <td className="text-right">
                {printData.totalVolume.toFixed(4)}
              </td>
              <td></td>
              <td className="text-right">
                {printData.totalGwp.toFixed(2)}
              </td>
              <td className="text-right">
                {printData.totalUbp.toFixed(0)}
              </td>
              <td className="text-right">
                {printData.totalPenre.toFixed(2)}
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: "24pt",
          paddingTop: "8pt",
          borderTop: "0.5pt solid #ccc",
          fontSize: "8pt",
          color: "#999",
        }}
      >
        <p>Generated by IfcLCA v2 — https://ifclca.com</p>
      </div>
    </div>
  );
}

/**
 * PrintButton — triggers window.print() for the report.
 */
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <svg
        className="h-3.5 w-3.5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 7.131a48.082 48.082 0 0 0-1.913-.247M6.75 7.131a48.082 48.082 0 0 1-1.913-.247"
        />
      </svg>
      Print Report
    </button>
  );
}
