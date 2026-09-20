import {
  PAYMENT_SCORE_DELTA,
  SCORE_MAX,
} from "../constants/scoring.constants";
import { assignProfileTier } from "./scoring.service";
import type { StellarWalletData } from "./stellar.service";

export interface RecalcInput {
  stellarBase: number;
  creditEvents: { scoreImpact: number; disputed?: boolean }[];
  payments: { status: string }[];
}

export interface RecalcResult {
  score: number;
  profileTier: string;
  stellarBase: number;
  eventsTotal: number;
  paymentsTotal: number;
}

export function computeStellarBaseFromStoredData(
  stellarData: StellarWalletData | null | undefined
): number | null {
  if (!stellarData?.isValid) return null;

  const ageScore = Math.min((stellarData.walletAge / 730) * 40, 40);
  const txScore = Math.min(stellarData.totalTransactions * 0.3, 60);
  const successRate =
    stellarData.totalTransactions > 0
      ? stellarData.successfulTransactions / stellarData.totalTransactions
      : 0;
  const successScore = successRate * 30;
  const balanceScore = Math.min(
    Math.log10(stellarData.averageBalance + 1) * 8,
    20
  );

  return Math.round(ageScore + txScore + successScore + balanceScore);
}

export function recalculateUserScore(input: RecalcInput): RecalcResult {
  const eventsTotal = input.creditEvents.reduce(
    (sum, event) => (event.disputed ? sum : sum + event.scoreImpact),
    0
  );
  const paymentsTotal = input.payments.reduce((sum, payment) => {
    const delta =
      PAYMENT_SCORE_DELTA[
        payment.status as keyof typeof PAYMENT_SCORE_DELTA
      ] ?? 0;
    return sum + delta;
  }, 0);

  const score = Math.min(
    Math.max(input.stellarBase + eventsTotal + paymentsTotal, 0),
    SCORE_MAX
  );

  return {
    score,
    profileTier: assignProfileTier(score),
    stellarBase: input.stellarBase,
    eventsTotal,
    paymentsTotal,
  };
}
