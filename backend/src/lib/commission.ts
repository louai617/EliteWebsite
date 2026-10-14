/**
 * Commission maths, shared by the deal service, the deal form preview and the seed.
 *
 *   commission        = amount × commissionPercent / 100
 *   agent commission  = commission × agentSharePercent / 100
 *   company commission = commission − agent commission
 *
 * All results are whole QAR (rounded to the nearest riyal).
 */
export interface CommissionInput {
  amount: number;
  commissionPercent: number;
  agentSharePercent: number;
}

export interface CommissionBreakdown {
  commissionAmount: number;
  agentCommission: number;
  companyCommission: number;
}

export function calculateCommission({
  amount,
  commissionPercent,
  agentSharePercent,
}: CommissionInput): CommissionBreakdown {
  const safe = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
  const commissionAmount = Math.round((safe(amount) * safe(commissionPercent)) / 100);
  const agentCommission = Math.round((commissionAmount * Math.min(safe(agentSharePercent), 100)) / 100);
  return {
    commissionAmount,
    agentCommission,
    companyCommission: commissionAmount - agentCommission,
  };
}
