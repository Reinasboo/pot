export type PotSettlementState = {
  walletAddress: string;
  organizer: string;
  paidOut: boolean;
  payoutEligible: boolean;
  refundEligible: boolean;
  contribution: bigint;
  refundClaimed: boolean;
};

export function canOrganizerPayout(state: PotSettlementState): boolean {
  return (
    state.walletAddress.toLowerCase() === state.organizer.toLowerCase() &&
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
