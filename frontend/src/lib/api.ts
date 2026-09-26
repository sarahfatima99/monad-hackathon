const API_URL = import.meta.env.VITE_API_URL as string;

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(init?.headers ?? {}) }
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  register: (email: string) => request("/auth/register", { method: "POST", body: JSON.stringify({ email }) }),
  verify: (email: string, code: string) =>
    request<{ token: string }>("/auth/verify", { method: "POST", body: JSON.stringify({ email, code }) }),
  setNickname: (nickname: string) =>
    request("/auth/nickname", { method: "POST", body: JSON.stringify({ nickname }) }),
  walletNonce: () => request<{ message: string }>("/auth/wallet/nonce", { method: "POST" }),
  linkWallet: (address: string, signature: string) =>
    request("/auth/wallet/link", { method: "POST", body: JSON.stringify({ address, signature }) }),
  me: () =>
    request<{
      email: string;
      emailVerified: boolean;
      nickname: string | null;
      walletAddress: string | null;
      walletBalanceWei: string;
      totalRewardsWei: string;
    }>("/auth/me"),
  games: () =>
    request<{
      games: { id: string; name: string; startTime: number; status: string; poolWei: string; participantCount: number }[];
    }>("/games"),
  game: (id: string) => request<{ id: string; name: string; startTime: number; status: string; joined: boolean }>(`/games/${id}`),
  joinGame: (id: string, txHash?: string) =>
    request(`/games/${id}/join`, { method: "POST", body: JSON.stringify({ txHash }) }),
  round: (id: string) => request<any>(`/games/${id}/round`),
  answer: (id: string, roundIndex: number, selectedOptionIndex: number) =>
    request(`/games/${id}/answer`, { method: "POST", body: JSON.stringify({ roundIndex, selectedOptionIndex }) }),
  leaderboard: (id: string) =>
    request<{ status: string; leaderboard: { accountId: string; nickname: string; score: number; rank: number }[] }>(
      `/games/${id}/leaderboard`
    ),
  claimInfo: (id: string) =>
    request<{ eligible: boolean; onchainGameId?: number; amountWei?: string; proof?: string[] }>(
      `/games/${id}/claim-info`
    )
};
