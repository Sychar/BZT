import { NextFunction, Request, Response } from "express";
import { ZodError, ZodSchema } from "zod";

export const validateBody =
  <T>(schema: ZodSchema<T>) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Ungültige Daten.", details: error.errors });
      }
      return res.status(400).json({ error: "Ungültige Daten." });
    }
  };

export const validateQuery =
  <T>(schema: ZodSchema<T>) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query) as unknown as Request["query"];
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Ungültige Anfrage.", details: error.errors });
      }
      return res.status(400).json({ error: "Ungültige Anfrage." });
    }
  };
