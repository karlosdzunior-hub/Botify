import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import botsRouter from "./bots";
import chatRouter from "./chat";
import transactionsRouter from "./transactions";
import marketplaceRouter from "./marketplace";
import referralRouter from "./referral";
import adminRouter from "./admin";
import paymentsRouter from "./payments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(botsRouter);
router.use(chatRouter);
router.use(transactionsRouter);
router.use(marketplaceRouter);
router.use(referralRouter);
router.use(adminRouter);
router.use(paymentsRouter);

export default router;
