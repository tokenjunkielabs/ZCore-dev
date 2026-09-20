#!/usr/bin/env ts-node
import "dotenv/config";
import { prisma } from "../src/config/database";
import { calculateStellarBase } from "../src/services/scoring.service";
import {
  computeStellarBaseFromStoredData,
  recalculateUserScore,
} from "../src/services/score-recalc.service";
import type { StellarWalletData } from "../src/services/stellar.service";

interface CliOptions {
  apply: boolean;
  wallet?: string;
  adminKey?: string;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { apply: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") options.apply = true;
    if (arg === "--dry-run") options.apply = false;
    if (arg === "--wallet") options.wallet = argv[i + 1];
    if (arg === "--admin-key") options.adminKey = argv[i + 1];
  }

  return options;
}

async function resolveStellarBase(
  walletAddress: string,
  stellarData: StellarWalletData | null
): Promise<number> {
  const cached = computeStellarBaseFromStoredData(stellarData);
  if (cached !== null) return cached;

  const live = await calculateStellarBase(walletAddress);
  return live.score;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const expectedAdmin = process.env.ADMIN_SECRET;
  const providedAdmin = options.adminKey ?? process.env.ADMIN_SECRET;

  if (!expectedAdmin || providedAdmin !== expectedAdmin) {
    console.error("Invalid or missing ADMIN_SECRET / --admin-key");
    process.exit(1);
  }

  const users = await prisma.user.findMany({
    where: options.wallet ? { walletAddress: options.wallet } : undefined,
    include: {
      creditEvents: { select: { scoreImpact: true, disputed: true } },
      payments: { select: { status: true } },
    },
  });

  if (options.wallet && users.length === 0) {
    console.error(`User not found: ${options.wallet}`);
    process.exit(1);
  }

  console.log(
    options.apply
      ? "Applying score recalculation..."
      : "Dry run - no database writes"
  );

  for (const user of users) {
    const stellarBase = await resolveStellarBase(
      user.walletAddress,
      user.stellarData as StellarWalletData | null
    );
    const recalculated = recalculateUserScore({
      stellarBase,
      creditEvents: user.creditEvents,
      payments: user.payments,
    });

    const delta = recalculated.score - user.score;
    console.log(
      `${user.walletAddress} | old=${user.score} new=${recalculated.score} delta=${delta >= 0 ? "+" : ""}${delta} tier=${recalculated.profileTier}`
    );

    if (options.apply && delta !== 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          score: recalculated.score,
          profileTier: recalculated.profileTier,
        },
      });
    }
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
