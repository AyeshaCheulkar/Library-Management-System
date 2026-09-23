import { Router } from "express";
import * as ctrl from "../controllers/book.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validateBody, validateObjectId } from "../middleware/validate";

const ISBN = /^(?:\d[- ]?){9}[\dXx]$|^(?:\d[- ]?){12}\d$/;
const HTTPS_URL = /^https:\/\/\S{1,1990}$/;

const router = Router();

router.get("/", authenticate, ctrl.list);

router.get("/categories", authenticate, ctrl.categories);

router.get("/:id", authenticate, validateObjectId(), ctrl.getOne);

router.get("/:id/availability", authenticate, validateObjectId(), ctrl.availability);

router.post("/:id/reserve", authenticate, validateObjectId(), ctrl.reserve);
router.delete("/:id/reserve", authenticate, validateObjectId(), ctrl.cancelReservation);

router.post(
  "/",
  authenticate,
  authorize("librarian", "admin"),
  validateBody({
    isbn: { type: "string", required: true, pattern: ISBN },
    title: { type: "string", required: true, min: 1, max: 300 },
    author: { type: "string", required: true, min: 1, max: 200 },
    category: { type: "string", required: true, min: 1, max: 80 },
    copiesTotal: { type: "number", min: 0, max: 10_000 },
    coverUrl: { type: "string", max: 2000, pattern: HTTPS_URL },
  }),
  ctrl.create
);

router.patch(
  "/:id",
  authenticate,
  authorize("librarian", "admin"),
  validateObjectId(),
  validateBody({
    title: { type: "string", min: 1, max: 300 },
    author: { type: "string", min: 1, max: 200 },
    category: { type: "string", min: 1, max: 80 },
    copiesTotal: { type: "number", min: 0, max: 10_000 },
    coverUrl: { type: "string", max: 2000, pattern: HTTPS_URL },
    isWithdrawn: { type: "boolean" },
  }),
  ctrl.update
);

router.delete(
  "/:id",
  authenticate,
  authorize("librarian", "admin"),
  validateObjectId(),
  ctrl.remove
);

export default router;
