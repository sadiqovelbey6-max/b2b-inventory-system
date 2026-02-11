export const parseTtlToSeconds = (
  value: string | number | undefined,
  fallbackSeconds: number,
): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (!value) {
    return fallbackSeconds;
  }
  const stringValue = String(value).trim();
  const durationMatch = stringValue.match(/^(\d+)\s*([smhd])$/i);
  if (durationMatch) {
    const amount = parseInt(durationMatch[1], 10);
    const unit = durationMatch[2].toLowerCase();
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };
    return amount * (multipliers[unit] ?? 1);
  }
  const numeric = Number(stringValue);
  if (!Number.isNaN(numeric) && numeric > 0) {
    return numeric;
  }
  return fallbackSeconds;
};
