import { Router } from "express";
import * as ctrl from "../controllers/auth.controller";
import { authenticate } from "../middleware/authenticate";
import { loginRateLimiter } from "../middleware/rateLimit";
import { validateBody } from "../middleware/validate";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const router = Router();

router.post(
  "/register",
  validateBody({
    email: { type: "string", required: true, pattern: EMAIL, max: 254 },
    password: { type: "string", required: true, max: 200 },
    name: { type: "string", required: true, min: 1, max: 120 },
  }),
  ctrl.register
);

router.post(
  "/login",
  loginRateLimiter,
  validateBody({
    email: { type: "string", required: true, max: 254 },
    password: { type: "string", required: true, max: 200 },
  }),
  ctrl.login
);

router.post("/refresh", ctrl.refresh);

router.post("/logout", ctrl.logout);

router.get("/me", authenticate, ctrl.me);

router.patch(
  "/password",
  authenticate,
  validateBody({
    currentPassword: { type: "string", required: true, max: 200 },
    newPassword: { type: "string", required: true, max: 200 },
  }),
  ctrl.changePassword
);

export default router;
