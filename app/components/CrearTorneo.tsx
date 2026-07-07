"use client";

import { useState } from "react";
import { BN } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { useProgram } from "../hooks/useProgram";
import { pdaTorneo, pdaBoveda } from "../lib/pdas";

export default function CrearTorneo() {
  const { program, wallet, connection, puedeFirmar } = useProgram();

  const [bracketId, setBracketId] = useState("");
  const [entryFeeSol, setEntryFeeSol] = useState("");
  const [porcentajes, setPorcentajes] = useState<number[]>([60, 30, 10]);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    torneo: string;
    firma: string;
  } | null>(null);

  const suma = porcentajes.reduce((a, b) => a + b, 0);

  const cluster = connection.rpcEndpoint.includes("devnet")
    ? "?cluster=devnet"
    : connection.rpcEndpoint.includes("127.0.0.1")
      ? "?cluster=custom&customUrl=http://127.0.0.1:8899"
      : "";

  function cambiarPorcentaje(indice: number, valor: string) {
    const n = parseInt(valor, 10);
    setPorcentajes((prev) =>
      prev.map((p, i) => (i === indice ? (isNaN(n) ? 0 : n) : p)),
    );
  }
  function agregarPosicion() {
    if (porcentajes.length < 10) setPorcentajes((prev) => [...prev, 0]);
  }
  function quitarPosicion(indice: number) {
    if (porcentajes.length > 1)
      setPorcentajes((prev) => prev.filter((_, i) => i !== indice));
  }

  function traducirError(e: unknown): string {
    const err = e as {
      error?: { errorMessage?: string };
      message?: string;
      logs?: string[];
    };
    if (err?.error?.errorMessage) return err.error.errorMessage;
    const texto = (err?.message ?? "") + (err?.logs?.join(" ") ?? "");
    if (texto.includes("already in use"))
      return "Ya existe un torneo con ese Bracket ID para tu wallet.";
    if (texto.toLowerCase().includes("user rejected"))
      return "Rechazaste la transaccion en la wallet.";
    if (texto.includes("insufficient"))
      return "SOL insuficiente para pagar la creacion (necesitas SOL de Devnet).";
    return err?.message ?? "Error desconocido al crear el torneo.";
  }

  async function crearTorneo() {
    setError(null);
    setResultado(null);

    if (!puedeFirmar || !wallet) {
      setError("Conecta tu wallet (MetaMask) primero.");
      return;
    }
    const bracket = parseInt(bracketId, 10);
    if (isNaN(bracket) || bracket < 0 || bracket > 4294967295) {
      setError("El Bracket ID debe ser un numero entero valido.");
      return;
    }
    const fee = parseFloat(entryFeeSol);
    if (isNaN(fee) || fee <= 0) {
      setError("El entry fee debe ser un numero mayor que 0.");
      return;
    }
    if (porcentajes.length < 1 || porcentajes.length > 10) {
      setError("Debe haber entre 1 y 10 posiciones de premio.");
      return;
    }
    if (suma !== 100) {
      setError("Los porcentajes deben sumar 100 (ahora suman " + suma + ").");
      return;
    }

    setEnviando(true);
    try {
      const admin = wallet.publicKey;
      const [torneoPda] = pdaTorneo(admin, bracket);
      const [bovedaPda] = pdaBoveda(torneoPda);
      const lamports = new BN(Math.round(fee * LAMPORTS_PER_SOL));

      const firma = await program.methods
        .initializeTournament(bracket, lamports, porcentajes)
        .accountsPartial({
          tournament: torneoPda,
          vault: bovedaPda,
          admin,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setResultado({ torneo: torneoPda.toBase58(), firma });
    } catch (e) {
      setError(traducirError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mt-6 w-full max-w-xl rounded-lg border border-gray-600 p-5">
      <h2 className="mb-4 text-lg font-semibold">Crear torneo</h2>

      <label className="mb-1 block text-sm opacity-70">
        Bracket ID de Start.gg
      </label>
      <input
        className="mb-4 w-full rounded border border-gray-500 bg-transparent p-2"
        value={bracketId}
        onChange={(e) => setBracketId(e.target.value)}
        placeholder="Ej: 123456"
        inputMode="numeric"
      />

      <label className="mb-1 block text-sm opacity-70">
        Costo de inscripcion (SOL)
      </label>
      <input
        className="mb-4 w-full rounded border border-gray-500 bg-transparent p-2"
        value={entryFeeSol}
        onChange={(e) => setEntryFeeSol(e.target.value)}
        placeholder="Ej: 0.1"
        inputMode="decimal"
      />

      <label className="mb-1 block text-sm opacity-70">
        Reparto de premios por posicion (debe sumar 100)
      </label>
      <div className="mb-2 space-y-2">
        {porcentajes.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-16 text-sm opacity-70">{i + 1} lugar</span>
            <input
              className="w-24 rounded border border-gray-500 bg-transparent p-2"
              value={p}
              onChange={(e) => cambiarPorcentaje(i, e.target.value)}
              inputMode="numeric"
            />
            <span className="opacity-70">%</span>
            {porcentajes.length > 1 && (
              <button
                onClick={() => quitarPosicion(i)}
                className="text-sm text-red-400"
              >
                quitar
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="mb-4 flex items-center gap-3 text-sm">
        {porcentajes.length < 10 && (
          <button onClick={agregarPosicion} className="text-blue-400">
            + agregar posicion
          </button>
        )}
        <span className={suma === 100 ? "text-green-400" : "text-yellow-400"}>
          Suma actual: {suma}
        </span>
      </div>

      <button
        onClick={crearTorneo}
        disabled={enviando}
        className="w-full rounded bg-blue-600 p-2 font-medium disabled:opacity-50"
      >
        {enviando ? "Creando torneo..." : "Crear torneo"}
      </button>

      {error && (
        <p className="mt-3 rounded bg-red-900/40 p-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {resultado && (
        <div className="mt-3 rounded bg-green-900/30 p-3 text-sm">
          <p className="mb-1 font-medium text-green-300">
            Torneo creado on-chain
          </p>
          <p className="break-all">
            <span className="opacity-70">Direccion del torneo: </span>
            <a
              className="text-blue-300 underline"
              href={
                "https://explorer.solana.com/address/" +
                resultado.torneo +
                cluster
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              {resultado.torneo}
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
