export function formatujDate(data: string): string {
  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(data));
}
