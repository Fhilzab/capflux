import type { PDFReport, CSVReport, ExcelReport, ReportExport, ExportResult } from './types';

/**
 * ExportProvider
 *
 * Abstract contract for report exports.
 *
 * Implementations may provide PDF, CSV, or Excel exports.
 * No concrete implementation yet; interfaces are defined for future use.
 */
export abstract class ExportProvider {
  abstract exportPDF(report: ReportExport): Promise<ExportResult['pdf']>;
  abstract exportCSV(report: ReportExport): Promise<ExportResult['csv']>;
  abstract exportExcel(report: ReportExport): Promise<ExportResult['excel']>;

  async export(report: ReportExport): Promise<ExportResult> {
    const results: ExportResult = {};

    if (report.period === 'DAY' || report.period === 'WEEK' || report.period === 'MONTH' || report.period === 'TERM' || report.period === 'SESSION') {
      try {
        const [pdf, csv, excel] = await Promise.all([
          this.exportPDF(report).catch(() => undefined),
          this.exportCSV(report).catch(() => undefined),
          this.exportExcel(report).catch(() => undefined),
        ]);

        if (pdf) results.pdf = pdf;
        if (csv) results.csv = csv;
        if (excel) results.excel = excel;
      } catch (e) {
        results.error = { code: 'REPORT_GENERATION_FAILED', message: 'Export failed', raw: e };
      }
    }

    return results;
  }
}