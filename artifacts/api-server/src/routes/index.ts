import { Router, type IRouter } from "express";
import healthRouter from "./health";
import coloringRouter from "./coloring";
import profilesRouter from "./profiles";
import storiesRouter from "./stories";
import dailyRouter from "./daily";

const router: IRouter = Router();

router.use(healthRouter);
router.use(coloringRouter);
router.use(profilesRouter);
router.use(storiesRouter);
router.use(dailyRouter);

export default router;
