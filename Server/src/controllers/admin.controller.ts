import { NextFunction, Request, Response } from "express";
import { prisma } from "../config/database";
import { calculateStellarBase } from "../services/scoring.service";
import {
  computeStellarBaseFromStoredData,
  recalculateUserScore,
} from "../services/score-recalc.service";
import type { StellarWalletData } from "../services/stellar.service";

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Operator endpoints (X-Admin-Key required)
 */

function getAdminActor(req: Request): string {
  return req.header("X-Admin-Operator")?.trim() || "admin";
}

/**
 * @swagger
 * /api/admin/platforms:
 *   get:
 *     tags: [Admin]
 *     summary: List registered partner platforms
 *     parameters:
 *       - in: header
 *         name: X-Admin-Key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Platform list
 */
export const listPlatforms = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const platforms = await prisma.platform.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        apiKey: true,
        webhookUrl: true,
        active: true,
        createdAt: true,
      },
    });

    return res.status(200).json({ success: true, data: { platforms } });
  } catch (error) {
    return next(error);
  }
};

/**
 * @swagger
 * /api/admin/lenders:
 *   get:
 *     tags: [Admin]
 *     summary: List lenders and profile definitions
 */
export const listLenders = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const lenders = await prisma.lender.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        apiKey: true,
        profiles: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({ success: true, data: { lenders } });
  } catch (error) {
    return next(error);
  }
};

/**
 * @swagger
 * /api/admin/events/recent:
 *   get:
 *     tags: [Admin]
 *     summary: Recent credit events with pagination
 */
export const listRecentEvents = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 50), 100);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);

    const [total, events] = await Promise.all([
      prisma.creditEvent.count(),
      prisma.creditEvent.findMany({
        include: {
          platform: { select: { id: true, name: true } },
          user: { select: { walletAddress: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        events: events.map((event) => ({
          id: event.id,
          platformId: event.platform.id,
          platformName: event.platform.name,
          walletAddress: event.user.walletAddress,
          eventType: event.eventType,
          amount: event.amount,
          currency: event.currency,
          scoreImpact: event.scoreImpact,
          txHash: event.txHash,
          createdAt: event.createdAt.toISOString(),
          disputed: event.disputed,
          disputeReason: event.disputeReason,
          disputedAt: event.disputedAt?.toISOString() ?? null,
          disputedBy: event.disputedBy,
        })),
        pagination: { limit, offset, total },
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @swagger
 * /api/admin/events/{id}/dispute:
 *   post:
 *     tags: [Admin]
 *     summary: Mark a credit event as disputed
 *     parameters:
 *       - in: header
 *         name: X-Admin-Key
 *         required: true
 *         schema:
 *           type: string
 *       - in: header
 *         name: X-Admin-Operator
 *         required: false
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Event marked disputed
 *       400:
 *         description: Missing dispute reason
 *       404:
 *         description: Event not found
 */
export const disputeEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const reason =
      typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

    if (!reason) {
      return res
        .status(400)
        .json({ success: false, error: "Dispute reason is required" });
    }

    const existing = await prisma.creditEvent.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, error: "Credit event not found" });
    }

    const event = await prisma.creditEvent.update({
      where: { id: req.params.id },
      data: {
        disputed: true,
        disputeReason: reason,
        disputedAt: new Date(),
        disputedBy: getAdminActor(req),
      },
    });

    return res.status(200).json({ success: true, data: { event } });
  } catch (error) {
    return next(error);
  }
};

/**
 * @swagger
 * /api/admin/events/{id}/reinstate:
 *   post:
 *     tags: [Admin]
 *     summary: Reinstate a disputed credit event
 *     parameters:
 *       - in: header
 *         name: X-Admin-Key
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Event reinstated
 *       404:
 *         description: Event not found
 */
export const reinstateEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const existing = await prisma.creditEvent.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, error: "Credit event not found" });
    }

    const event = await prisma.creditEvent.update({
      where: { id: req.params.id },
      data: {
        disputed: false,
        disputeReason: null,
        disputedAt: null,
        disputedBy: null,
      },
    });

    return res.status(200).json({ success: true, data: { event } });
  } catch (error) {
    return next(error);
  }
};

/**
 * @swagger
 * /api/admin/users/{wallet}/recalculate:
 *   post:
 *     tags: [Admin]
 *     summary: Recalculate and persist one user's credit score
 *     parameters:
 *       - in: header
 *         name: X-Admin-Key
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: wallet
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Score recalculated
 *       404:
 *         description: User not found
 */
export const recalculateAdminUserScore = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { wallet } = req.params;
    const user = await prisma.user.findUnique({
      where: { walletAddress: wallet },
      include: {
        creditEvents: {
          select: { scoreImpact: true, disputed: true },
        },
        payments: {
          select: { status: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const cachedBase = computeStellarBaseFromStoredData(
      user.stellarData as StellarWalletData | null
    );
    const stellarBase =
      cachedBase ?? (await calculateStellarBase(user.walletAddress)).score;
    const recalculated = recalculateUserScore({
      stellarBase,
      creditEvents: user.creditEvents,
      payments: user.payments,
    });

    const previousScore = user.score;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        score: recalculated.score,
        profileTier: recalculated.profileTier,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        walletAddress: user.walletAddress,
        previousScore,
        ...recalculated,
      },
    });
  } catch (error) {
    return next(error);
  }
};
