import { Router } from "express";
import {
  disputeEvent,
  listLenders,
  listPlatforms,
  listRecentEvents,
  recalculateAdminUserScore,
  reinstateEvent,
} from "../controllers/admin.controller";
import { requireAdminKey } from "../middleware/admin-auth.middleware";
import { validateQuery } from "../middleware/validation.middleware";
import { PaginationQuerySchema } from "../middleware/schemas";

const router = Router();

router.use(requireAdminKey);

router.get("/platforms", listPlatforms);
router.get("/lenders", listLenders);
router.get(
  "/events/recent",
  validateQuery(PaginationQuerySchema),
  listRecentEvents
);
router.post("/events/:id/dispute", disputeEvent);
router.post("/events/:id/reinstate", reinstateEvent);
router.post("/users/:wallet/recalculate", recalculateAdminUserScore);

export default router;
