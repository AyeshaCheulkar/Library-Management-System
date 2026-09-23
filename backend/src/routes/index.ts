import { Router } from "express";
import authRoutes from "./auth.routes";
import bookRoutes from "./book.routes";
import loanRoutes from "./loan.routes";
import memberRoutes from "./member.routes";
import requestRoutes from "./request.routes";
import userRoutes from "./user.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/books", bookRoutes);
router.use("/members", memberRoutes);
router.use("/loans", loanRoutes);
router.use("/requests", requestRoutes);
router.use("/users", userRoutes);

export default router;
