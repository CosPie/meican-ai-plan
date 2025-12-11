/**
 * Format a date object to YYYY-MM-DD string using local time
 * This avoids the timezone shift issues caused by toISOString() which uses UTC
 */
export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
