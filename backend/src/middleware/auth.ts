import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export interface AuthedRequest extends Request {
  accountId?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as { accountId: string };
    req.accountId = payload.accountId;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function signToken(accountId: string): string {
  return jwt.sign({ accountId }, config.jwtSecret, { expiresIn: "30d" });
}
