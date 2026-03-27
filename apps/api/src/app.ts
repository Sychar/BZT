import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRouter from "./routes/auth";
import vendorsRouter from "./routes/vendors";
import productsRouter from "./routes/products";
import ordersRouter from "./routes/orders";
import batchesRouter from "./routes/batches";
import menusRouter from "./routes/menus";
import restaurantsRouter from "./routes/restaurants";
import vendorCompaniesRouter from "./routes/vendorCompanies";
import companyRouter from "./routes/company";
import adminRouter from "./routes/admin";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/auth", authRouter);
app.use("/vendors", vendorsRouter);
app.use(productsRouter);
app.use("/orders", ordersRouter);
app.use("/vendor", batchesRouter);
app.use("/vendor", vendorCompaniesRouter);
app.use(menusRouter);
app.use(restaurantsRouter);
app.use("/company", companyRouter);
app.use("/admin", adminRouter);

app.use(errorHandler);

export default app;
