import { Router } from "express";
import * as ctrl from "../controllers/member.controller";
import * as loanCtrl from "../controllers/loan.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { ownsMemberRecord } from "../middleware/ownership";
import { validateBody, validateObjectId } from "../middleware/validate";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MEMBERSHIP_TYPES = ["standard", "premium", "faculty"] as const;

const router = Router();

router.get("/", authenticate, authorize("librarian", "admin"), ctrl.list);

router.get("/:id", authenticate, validateObjectId(), ownsMemberRecord, ctrl.getOne);

router.get(
  "/:id/loans",
  authenticate,
  validateObjectId(),
  ownsMemberRecord,
  loanCtrl.listForMember
);

router.post(
  "/",
  authenticate,
  authorize("librarian", "admin"),
  validateBody({
    name: { type: "string", required: true, min: 1, max: 120 },
    email: { type: "string", required: true, pattern: EMAIL, max: 254 },
    membershipType: { type: "string", enum: MEMBERSHIP_TYPES },
  }),
  ctrl.create
);

router.patch(
  "/:id",
  authenticate,
  authorize("admin"),
  validateObjectId(),
  validateBody({
    name: { type: "string", min: 1, max: 120 },
    email: { type: "string", pattern: EMAIL, max: 254 },
    membershipType: { type: "string", enum: MEMBERSHIP_TYPES },
  }),
  ctrl.update
);

router.delete("/:id", authenticate, authorize("admin"), validateObjectId(), ctrl.remove);

export default router;
