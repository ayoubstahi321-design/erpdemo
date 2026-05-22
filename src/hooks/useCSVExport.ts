import { useCallback } from 'react';
import { logger } from '../utils/logger';

interface CSVExportOptions {
  filename: string;
  headers: string[];
  data: any[];
  mapRow?: (row: any) => any[];
}

export const useCSVExport = () => {
  const exportToCSV = useCallback(({ filename, headers, data, mapRow }: CSVExportOptions) => {
    try {
      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...data.map(row => {
          const values = mapRow ? mapRow(row) : Object.values(row);
          return values
            .map(val => {
              // Handle values that contain commas, quotes, or newlines
              const stringVal = String(val ?? '');
              if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
                return `"${stringVal.replace(/"/g, '""')}"`;
              }
              return stringVal;
            })
            .join(',');
        })
      ].join('\n');

      // Create blob and download
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      return true;
    } catch (error) {
      logger.error('Error exporting CSV:', error);
      return false;
    }
  }, []);

  return { exportToCSV };
};
