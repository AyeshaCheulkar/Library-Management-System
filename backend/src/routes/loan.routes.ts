import { Router } from "express";
import * as ctrl from "../controllers/loan.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validateBody, validateObjectId } from "../middleware/validate";

const router = Router();

router.get("/", authenticate, authorize("librarian", "admin"), ctrl.list);

router.post(
  "/",
  authenticate,
  authorize("librarian", "admin"),
  validateBody({
    bookId: { type: "objectId", required: true },
    memberId: { type: "objectId", required: true },
  }),
  ctrl.issue
);

router.patch(
  "/:id/return",
  authenticate,
  authorize("librarian", "admin"),
  validateObjectId(),
  ctrl.returnBook
);

router.patch(
  "/:id/pay",
  authenticate,
  authorize("librarian", "admin"),
  validateObjectId(),
  ctrl.payFine
);

router.patch(
  "/:id/waive-fine",
  authenticate,
  authorize("librarian", "admin"),
  validateObjectId(),
  ctrl.waiveFine
);

export default router;
