import { Router } from "express";
import { z } from "zod";
import { nanoid } from "nanoid";
import { verifyMessage } from "viem";
import { db } from "../db.js";
import { sendVerificationEmail } from "../services/email.js";
import { signToken, requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { getWalletBalance } from "../services/chain.js";

export const authRouter = Router();

function sixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// 1. Register with email -> sends a verification code.
authRouter.post("/register", async (req, res) => {
  const schema = z.object({ email: z.string().email() });
  const { email } = schema.parse(req.body);

  const code = sixDigitCode();
  const expiresAt = Date.now() + 15 * 60 * 1000;

  const existing = db.prepare("SELECT id FROM accounts WHERE email = ?").get(email) as
    | { id: string }
    | undefined;

  if (existing) {
    db.prepare("UPDATE accounts SET verification_code = ?, verification_expires_at = ? WHERE id = ?").run(
      code,
      expiresAt,
      existing.id
    );
  } else {
    db.prepare(
      "INSERT INTO accounts (id, email, verification_code, verification_expires_at, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(nanoid(), email, code, expiresAt, Date.now());
  }

  await sendVerificationEmail(email, code);
  res.json({ ok: true });
});

// 2. Verify the emailed code, get back a session token.
authRouter.post("/verify", (req, res) => {
  const schema = z.object({ email: z.string().email(), code: z.string() });
  const { email, code } = schema.parse(req.body);

  const account = db.prepare("SELECT * FROM accounts WHERE email = ?").get(email) as any;
  if (!account) return res.status(404).json({ error: "No such account" });
  if (account.verification_code !== code || Date.now() > account.verification_expires_at) {
    return res.status(400).json({ error: "Invalid or expired code" });
  }

  db.prepare("UPDATE accounts SET email_verified = 1, verification_code = NULL WHERE id = ?").run(account.id);
  res.json({ token: signToken(account.id) });
});

// 3. Choose a unique nickname (requires verified email).
authRouter.post("/nickname", requireAuth, (req: AuthedRequest, res) => {
  const schema = z.object({ nickname: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/) });
  const { nickname } = schema.parse(req.body);

  const account = db.prepare("SELECT * FROM accounts WHERE id = ?").get(req.accountId) as any;
  if (!account?.email_verified) return res.status(403).json({ error: "Email not verified" });

  const taken = db.prepare("SELECT id FROM accounts WHERE nickname = ? AND id != ?").get(nickname, req.accountId);
  if (taken) return res.status(409).json({ error: "Nickname already taken" });

  db.prepare("UPDATE accounts SET nickname = ? WHERE id = ?").run(nickname, req.accountId);
  res.json({ ok: true });
});

// 4a. Get a one-time nonce to sign, proving wallet ownership.
authRouter.post("/wallet/nonce", requireAuth, (req: AuthedRequest, res) => {
  const nonce = nanoid(24);
  db.prepare("UPDATE accounts SET wallet_nonce = ? WHERE id = ?").run(nonce, req.accountId);
  const message = `Monad Memory Challenge\n\nSign this message to link your wallet.\nNonce: ${nonce}`;
  res.json({ message });
});

// 4b. Verify the signature and link the wallet to the account.
authRouter.post("/wallet/link", requireAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({ address: z.string(), signature: z.string() });
  const { address, signature } = schema.parse(req.body);

  const account = db.prepare("SELECT * FROM accounts WHERE id = ?").get(req.accountId) as any;
  if (!account?.wallet_nonce) return res.status(400).json({ error: "Request a nonce first" });

  const message = `Monad Memory Challenge\n\nSign this message to link your wallet.\nNonce: ${account.wallet_nonce}`;
  const valid = await verifyMessage({
    address: address as `0x${string}`,
    message,
    signature: signature as `0x${string}`
  });
  if (!valid) return res.status(400).json({ error: "Signature does not match address" });

  const inUse = db.prepare("SELECT id FROM accounts WHERE wallet_address = ? AND id != ?").get(address, req.accountId);
  if (inUse) return res.status(409).json({ error: "Wallet already linked to another account" });

  db.prepare("UPDATE accounts SET wallet_address = ?, wallet_nonce = NULL WHERE id = ?").run(address, req.accountId);
  res.json({ ok: true });
});

// Player info shown at the top of the screen.
authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const account = db.prepare("SELECT * FROM accounts WHERE id = ?").get(req.accountId) as any;
  if (!account) return res.status(404).json({ error: "Not found" });

  let walletBalanceWei = "0";
  if (account.wallet_address) {
    try {
      walletBalanceWei = (await getWalletBalance(account.wallet_address)).toString();
    } catch {
      // chain not reachable in this environment; leave as 0
    }
  }

  const rewards = db
    .prepare(
      `SELECT COALESCE(SUM(CAST(reward_amount_wei as INTEGER)), 0) as total
       FROM game_participants WHERE account_id = ? AND reward_amount_wei IS NOT NULL`
    )
    .get(req.accountId) as { total: number };

  res.json({
    email: account.email,
    emailVerified: !!account.email_verified,
    nickname: account.nickname,
    walletAddress: account.wallet_address,
    walletBalanceWei,
    totalRewardsWei: String(rewards.total)
  });
});
