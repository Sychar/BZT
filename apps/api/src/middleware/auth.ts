import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../utils/env";

export type AuthUser = {
  userId: string;
  name?: string;
  role: "CUSTOMER" | "VENDOR" | "COMPANY";
  vendorId?: string | null;
  vendorType?: "BAECKER" | "METZGER" | "RESTAURANT" | null;
  customerType?: "EMPLOYEE" | "PRIVATE" | null;
  companyId?: string | null;
};

export const authRequired = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Nicht autorisiert." });
  }
  const token = header.substring("Bearer ".length);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthUser;
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Token ungültig." });
  }
};

export const optionalAuth = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next();
  }
  const token = header.substring("Bearer ".length);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthUser;
    req.user = payload;
  } catch {
    // ignore invalid token for optional auth
  }
  return next();
};

export const requireRole =
  (...roles: Array<AuthUser["role"]>) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Keine Berechtigung." });
    }
    return next();
  };
