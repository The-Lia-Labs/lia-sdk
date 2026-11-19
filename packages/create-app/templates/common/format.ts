/** Keep session tokens and file contents out of the demo readout. */
export function formatResult(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (value === undefined || value === null) return 'Done.';
  return JSON.stringify(value, (key, item) => /^(session|token|secret|base64|data)$/i.test(key) ? '[redacted]' : item, 2);
}
export function errorMessage(error: unknown) {
  const e = error as { code?: string; message?: string };
  if (e?.code === 'unknown_method') return 'This Lia version does not support this feature yet. Update Lia and try again.';
  if (e?.code === 'cancelled' || e?.code === 'permission_denied' || e?.code === 'denied') return 'Cancelled or permission declined. No action is required.';
  return e?.message || String(error);
}
export function exampleSource(code: string, binding: string) {
  const name = code.match(/\b([A-Za-z_$][\w$]*)\s*(?:\(|\.)/)?.[1];
  return (name ? `import { ${name} } from '${binding}';\n\n` : '') + code;
}
