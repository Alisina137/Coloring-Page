import { Router, type IRouter } from "express";
import healthRouter from "./health";
import coloringRouter from "./coloring";

const router: IRouter = Router();

router.use(healthRouter);
router.use(coloringRouter);

export default router;
