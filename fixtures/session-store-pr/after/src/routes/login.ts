import type { Request, Response } from "express";
import { verifyPassword } from "../auth/password";
import { sessions } from "../db";

export async function login(req: Request, res: Response) {
  const user = await verifyPassword(req.body.email, req.body.password);
  if (user === undefined) {
    return res.status(401).json({ error: "Wrong email or password" });
  }

  const session = await sessions.create(user.id);
  res.cookie("sid", session.id, { httpOnly: true, expires: session.expiresAt });
  return res.json({ userId: user.id });
}
