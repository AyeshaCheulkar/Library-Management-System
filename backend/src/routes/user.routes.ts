import { Router } from "express";
import * as ctrl from "../controllers/user.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validateBody, validateObjectId } from "../middleware/validate";
import { ROLES } from "../../../shared/types";

const router = Router();

router.get("/", authenticate, authorize("admin"), ctrl.list);

router.patch(
  "/:id/role",
  authenticate,
  authorize("admin"),
  validateObjectId(),
  validateBody({ role: { type: "string", required: true, enum: ROLES } }),
  ctrl.changeRole
);

router.patch(
  "/:id/active",
  authenticate,
  authorize("admin"),
  validateObjectId(),
  validateBody({ isActive: { type: "boolean", required: true } }),
  ctrl.setActive
);

export default router;
