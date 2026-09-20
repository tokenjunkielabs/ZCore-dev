import { prisma } from "../config/database";

export interface ScoreBreakdownData {
  walletAddress: string;
  score: number;
  tier: string;
  breakdown: {
    stellarBase: number;
    eventsScore: number;
    totalEvents: number;
    platforms: string[];
  };
  lastUpdated: Date;
}

export async function buildScoreBreakdown(
  walletAddress: string
): Promise<ScoreBreakdownData | null> {
  const user = await prisma.user.findUnique({
    where: { walletAddress },
    include: {
      creditEvents: {
        where: { disputed: false },
        select: { platformId: true, scoreImpact: true },
      },
    },
  });

  if (!user) return null;

  const eventsScore = user.creditEvents.reduce(
    (sum, event) => sum + event.scoreImpact,
    0
  );
  const stellarBase = Math.max(0, user.score - eventsScore);
  const platforms = [...new Set(user.creditEvents.map((event) => event.platformId))];

  return {
    walletAddress,
    score: user.score,
    tier: user.profileTier,
    breakdown: {
      stellarBase,
      eventsScore,
      totalEvents: user.creditEvents.length,
      platforms,
    },
    lastUpdated: user.updatedAt,
  };
}
