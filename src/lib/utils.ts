import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format date as dd-MMM-yyyy (e.g., 15-Jan-2026) */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  try {
    return format(new Date(date), 'dd-MMM-yyyy');
  } catch {
    return '—';
  }
}

/** Format currency with configurable symbol */
export function formatCurrency(amount: number | string | null | undefined, symbol?: string): string {
  const curr = symbol || getCurrencySymbol();
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  if (isNaN(num)) return `${curr} 0`;
  return `${curr} ${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/** Get currency symbol from env or default */
export function getCurrencySymbol(): string {
  return import.meta.env.VITE_CURRENCY_SYMBOL || 'Rs.';
}

/** Generate a receipt number: RCP-YYYYMMDD-XXXX */
export function generateReceiptNo(): string {
  const now = new Date();
  const datePart = format(now, 'yyyyMMdd');
  const randPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RCP-${datePart}-${randPart}`;
}

/** Get first day of a month from a date */
export function getMonthStart(date: Date): string {
  return format(new Date(date.getFullYear(), date.getMonth(), 1), 'yyyy-MM-dd');
}

/** Format month for display (e.g., "October 2026") */
export function formatMonth(date: string | Date): string {
  try {
    return format(new Date(date), 'MMMM yyyy');
  } catch {
    return '—';
  }
}

/** Convert a value to CSV-safe string */
export function csvEscape(val: unknown): string {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Export data to CSV and trigger download */
export function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(h => csvEscape(row[h])).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

/** Capitalize first letter */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Convert snake_case to Title Case */
export function snakeToTitle(str: string): string {
  return str.split('_').map(capitalize).join(' ');
}

/** Generate WhatsApp link with pre-filled message */
export function getWhatsAppLink(phone: string, message: string): string {
  // Remove any non-numeric characters except +
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}
