import type { NextFunction, Request, Response } from "express";
import { sessions } from "../db";

export async function requireSession(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const session = await sessions.find(req.cookies.sid);
  if (session === undefined) {
    return res.status(401).json({ error: "Sign in again" });
  }
  res.locals.session = session;
  next();
}
