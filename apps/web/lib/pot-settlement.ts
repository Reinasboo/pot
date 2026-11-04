export type PotSettlementState = {
  walletAddress: string;
  payoutRecipient: string;
  paidOut: boolean;
  payoutEligible: boolean;
  refundEligible: boolean;
  contribution: bigint;
  refundClaimed: boolean;
};

export function canAuthorizedPayout(state: PotSettlementState): boolean {
  return (
    state.walletAddress.toLowerCase() === state.payoutRecipient.toLowerCase() &&
    !state.paidOut &&
    state.payoutEligible
  );
}

export function canClaimPotRefund(state: PotSettlementState): boolean {
  return (
    !state.paidOut &&
    state.refundEligible &&
    state.contribution > BigInt(0) &&
    !state.refundClaimed
  );
}
