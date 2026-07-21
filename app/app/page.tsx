"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

import EstadoPrograma from "../components/EstadoPrograma";
import CrearTorneo from "../components/CrearTorneo";
import VerTorneo from "../components/VerTorneo";
import Inscribirse from "../components/Inscribirse";
import PanelAdmin from "../components/PanelAdmin";

// El botón de wallet se importa sin SSR (usa APIs del navegador).
const WalletMultiButton = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false },
);

export default function Home() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    // Regla de React 19: setState solo en el callback de la promesa, con flag.
    let cancelled = false;

    if (!publicKey) {
      setBalance(null);
      return;
    }

    connection
      .getBalance(publicKey)
      .then((lamports) => {
        if (!cancelled) setBalance(lamports / LAMPORTS_PER_SOL);
      })
      .catch(() => {
        if (!cancelled) setBalance(null);
      });

    return () => {
      cancelled = true;
    };
  }, [publicKey, connection]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">Prize Pool Esports</h1>

      <WalletMultiButton />

      {publicKey && (
        <div className="mt-4 text-center text-sm">
          <p className="break-all opacity-70">{publicKey.toBase58()}</p>
          <p className="mt-1">
            Balance: {balance === null ? "…" : `${balance} SOL`}
          </p>
        </div>
      )}

      {/* Tarea 1: diagnóstico del cliente Anchor */}
      <EstadoPrograma />

      {/* Tarea 2: crear torneo */}
      <CrearTorneo />

      {/* Tarea 3: ver torneo */}
      <VerTorneo />

      {/* Tarea 4: inscribirse */}
      <Inscribirse />

      {/* Tarea 5: panel del admin */}
      <PanelAdmin />
    </main>
  );
}