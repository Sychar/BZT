import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Eintrag existiert bereits." });
    }
  }

  console.error(error);
  return res.status(500).json({ error: "Unerwarteter Fehler." });
};
