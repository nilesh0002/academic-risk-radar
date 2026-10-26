import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, logout, getMe } from "./auth.controller.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit 30 login attempts per 15 mins per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again after 15 minutes" },
});

router.post("/login", loginLimiter, login);
router.post("/logout", logout);
router.get("/me", getMe);

export default router;
