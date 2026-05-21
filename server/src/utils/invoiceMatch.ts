/** 3-way match: Invoice vs PO total vs GR received value (±tolerance % of PO amount). */
export function computeGrAmount(
  items: { receivedQty: number; poItem: { unitPrice: { toString(): string } | number } }[],
): number {
  return items.reduce(
    (sum, item) => sum + item.receivedQty * Number(item.poItem.unitPrice),
    0,
  );
}

export function evaluateInvoiceMatch(
  invoiceAmount: number,
  poAmount: number,
  grAmount: number,
  tolerancePercent: number,
): { isMatched: boolean; variance: number } {
  const tolerance = poAmount * (tolerancePercent / 100);
  const within = (a: number, b: number) => Math.abs(a - b) <= tolerance;

  const isMatched =
    within(invoiceAmount, poAmount) &&
    within(invoiceAmount, grAmount) &&
    within(grAmount, poAmount);

  return { isMatched, variance: invoiceAmount - poAmount };
}
