import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "./lib/wagmi";
import { Layout } from "./components/Layout";
import { AccountPage } from "./pages/AccountPage";
import { GamesPage } from "./pages/GamesPage";
import { LobbyPage } from "./pages/LobbyPage";
import { ResultsPage } from "./pages/ResultsPage";
import "./index.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/games" replace />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/games" element={<GamesPage />} />
              <Route path="/games/:gameId/lobby" element={<LobbyPage />} />
              <Route path="/games/:gameId/results" element={<ResultsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
