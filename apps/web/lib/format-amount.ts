import { formatUnits } from "viem";

/** Preserve every base unit, including contributions smaller than one cent. */
export function formatDisplayAmount(
  amount: string,
  decimals = 6,
  symbol = "USDC",
): string {
  const [whole, fraction] = formatUnits(BigInt(amount), decimals).split(".");
  const grouped = BigInt(whole).toLocaleString("en-US");
  return `${grouped}${fraction ? `.${fraction}` : ""} ${symbol}`;
}
