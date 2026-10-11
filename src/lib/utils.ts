export function formatCurrency(amount: number, currency: string = 'INR'): string {
  const num = Number(amount) || 0;
  if (currency === 'INR') {
    return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return num.toLocaleString('en-US', { style: 'currency', currency: currency || 'USD' });
}

export function formatDateTime(isoString?: string): string {
  if (!isoString) return '-';
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

export function formatDate(isoString?: string): string {
  if (!isoString) return '-';
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

export function downloadCSV(filename: string, rows: Array<Record<string, any>>) {
  if (!rows || rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      headers
        .map(header => {
          let val = row[header];
          if (val === null || val === undefined) val = '';
          val = String(val).replace(/"/g, '""');
          return `"${val}"`;
        })
        .join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
