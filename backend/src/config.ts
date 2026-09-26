import "dotenv/config";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required("JWT_SECRET", "dev-secret-change-me"),
  databasePath: required("DATABASE_PATH", "./data.sqlite"),
  frontendOrigin: required("FRONTEND_ORIGIN", "http://localhost:5173"),

  rpcUrl: required("MONAD_TESTNET_RPC_URL", "https://testnet-rpc.monad.xyz"),
  contractAddress: (process.env.CONTRACT_ADDRESS ?? "") as `0x${string}`,
  operatorPrivateKey: (process.env.OPERATOR_PRIVATE_KEY ?? "") as `0x${string}`,

  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.EMAIL_FROM ?? "Monad Memory Challenge <no-reply@example.com>"
  },

  // Gameplay timing, per the spec: 5s per photo, 5s per question, up to 5 rounds.
  // Overridable via env for automated/local testing so a full game does not take 50s+.
  photoSeconds: Number(process.env.PHOTO_SECONDS ?? 5),
  questionSeconds: Number(process.env.QUESTION_SECONDS ?? 5),
  maxRounds: Number(process.env.MAX_ROUNDS ?? 5)
};
