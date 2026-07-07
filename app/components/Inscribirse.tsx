"use client";

import { useState } from "react";
import { PublicKey, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { useProgram } from "../hooks/useProgram";
import { pdaBoveda, pdaPlayerRecord } from "../lib/pdas";

export default function Inscribirse() {
  const { program, wallet, connection, puedeFirmar } = useProgram();

  const [direccionTorneo, setDireccionTorneo] = useState("");
  const [entrantId, setEntrantId] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    record: string;
    firma: string;
  } | null>(null);
  const [feeSol, setFeeSol] = useState<string | null>(null);

  const cluster = connection.rpcEndpoint.includes("devnet")
    ? "?cluster=devnet"
    : connection.rpcEndpoint.includes("127.0.0.1")
      ? "?cluster=custom&customUrl=http://127.0.0.1:8899"
      : "";

  function traducirError(e: unknown): string {
    const err = e as {
      error?: { errorMessage?: string };
      message?: string;
      logs?: string[];
    };
    if (err?.error?.errorMessage) return err.error.errorMessage;
    const texto = (err?.message ?? "") + (err?.logs?.join(" ") ?? "");
    if (texto.includes("already in use"))
      return "Ese entrant ya esta inscrito en este torneo (no se puede inscribir dos veces).";
    if (texto.toLowerCase().includes("user rejected"))
      return "Rechazaste la transaccion en la wallet.";
    if (texto.includes("insufficient"))
      return "SOL insuficiente para pagar la inscripcion.";
    return err?.message ?? "Error desconocido al inscribirse.";
  }

  async function inscribirse() {
    setError(null);
    setResultado(null);
    setFeeSol(null);

    if (!puedeFirmar || !wallet) {
      setError("Conecta tu wallet (MetaMask) primero.");
      return;
    }

    let torneoPk: PublicKey;
    try {
      torneoPk = new PublicKey(direccionTorneo.trim());
    } catch {
      setError("La direccion del torneo no es valida.");
      return;
    }

    const entrant = parseInt(entrantId, 10);
    if (isNaN(entrant) || entrant < 0 || entrant > 4294967295) {
      setError("El Entrant ID debe ser un numero entero valido.");
      return;
    }

    setEnviando(true);
    try {
      const torneo = await program.account.tournamentAccount.fetch(torneoPk);
      if (!torneo.isOpen) {
        setError("Este torneo ya esta cerrado; no acepta inscripciones.");
        setEnviando(false);
        return;
      }
      setFeeSol(
        (Number(torneo.entryFee.toString()) / LAMPORTS_PER_SOL).toString(),
      );

      const [bovedaPda] = pdaBoveda(torneoPk);
      const [recordPda] = pdaPlayerRecord(torneoPk, entrant);

      const firma = await program.methods
        .registerPlayer(entrant)
        .accountsPartial({
          tournament: torneoPk,
          vault: bovedaPda,
          playerRecord: recordPda,
          playerWallet: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setResultado({ record: recordPda.toBase58(), firma });
    } catch (e) {
      const err = e as { message?: string };
      if (err?.message?.includes("Account does not exist")) {
        setError("No existe ningun torneo en esa direccion (en este cluster).");
      } else {
        setError(traducirError(e));
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mt-6 w-full max-w-xl rounded-lg border border-gray-600 p-5">
      <h2 className="mb-4 text-lg font-semibold">Inscribirme en un torneo</h2>

      <label className="mb-1 block text-sm opacity-70">
        Direccion del torneo
      </label>
      <input
        className="mb-4 w-full rounded border border-gray-500 bg-transparent p-2"
        value={direccionTorneo}
        onChange={(e) => setDireccionTorneo(e.target.value)}
        placeholder="Pega aqui la direccion del torneo"
      />

      <label className="mb-1 block text-sm opacity-70">
        Tu Entrant ID de Start.gg
      </label>
      <input
        className="mb-4 w-full rounded border border-gray-500 bg-transparent p-2"
        value={entrantId}
        onChange={(e) => setEntrantId(e.target.value)}
        placeholder="Ej: 987654"
        inputMode="numeric"
      />

      <button
        onClick={inscribirse}
        disabled={enviando}
        className="w-full rounded bg-blue-600 p-2 font-medium disabled:opacity-50"
      >
        {enviando ? "Procesando..." : "Inscribirme y pagar"}
      </button>

      {feeSol && !error && !resultado && (
        <p className="mt-3 text-sm opacity-70">
          Costo de inscripcion: {feeSol} SOL
        </p>
      )}

      {error && (
        <p className="mt-3 rounded bg-red-900/40 p-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {resultado && (
        <div className="mt-3 rounded bg-green-900/30 p-3 text-sm">
          <p className="mb-1 font-medium text-green-300">
            Inscripcion confirmada on-chain
          </p>
          <p className="break-all">
            <span className="opacity-70">Tu registro: </span>
            <a
              className="text-blue-300 underline"
              href={
                "https://explorer.solana.com/address/" +
                resultado.record +
                cluster
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              {resultado.record}
            </a>
          </p>
          <p className="break-all">
            <span className="opacity-70">Transaccion: </span>
            <a
              className="text-blue-300 underline"
              href={
                "https://explorer.solana.com/tx/" + resultado.firma + cluster
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              ver en el explorador
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
