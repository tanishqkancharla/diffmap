import type { NextFunction, Request, Response } from "express";
import { findSession } from "../sessions/memory";

export function requireSession(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const session = findSession(req.cookies.sid);
  if (session === undefined) {
    return res.status(401).json({ error: "Sign in again" });
  }
  res.locals.session = session;
  next();
}
