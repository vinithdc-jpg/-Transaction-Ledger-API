export function parsePositiveAmount(value: unknown): string | null {
  const amount =
    typeof value === "string"
      ? value
      : typeof value === "number" && Number.isFinite(value)
        ? String(value)
        : null;

  if (
    amount === null ||
    !/^\d+(?:\.\d+)?$/.test(amount) ||
    !/[1-9]/.test(amount)
  ) {
    return null;
  }

  return amount;
}
