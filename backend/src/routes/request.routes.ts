import { Router } from "express";
import * as ctrl from "../controllers/request.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validateBody, validateObjectId } from "../middleware/validate";

const router = Router();

router.post(
  "/",
  authenticate,
  validateBody({ bookId: { type: "objectId", required: true } }),
  ctrl.create
);

router.get("/mine", authenticate, ctrl.mine);

router.get("/", authenticate, authorize("librarian", "admin"), ctrl.list);

router.patch(
  "/:id/approve",
  authenticate,
  authorize("librarian", "admin"),
  validateObjectId(),
  ctrl.approve
);

router.patch(
  "/:id/decline",
  authenticate,
  authorize("librarian", "admin"),
  validateObjectId(),
  validateBody({ note: { type: "string", max: 200 } }),
  ctrl.decline
);

router.delete("/:id", authenticate, validateObjectId(), ctrl.cancel);

export default router;
