"use client";

import { useState } from "react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useProgram } from "../hooks/useProgram";

type DatosTorneo = {
  admin: PublicKey;
  startggBracketId: number;
  entryFee: { toString(): string };
  totalFunds: { toString(): string };
  isOpen: boolean;
  vaultBump: number;
  prizePercentages: number[];
};

function aSol(lamportsBN: { toString(): string }): string {
  const sol = Number(lamportsBN.toString()) / LAMPORTS_PER_SOL;
  return sol.toLocaleString("es-VE", { maximumFractionDigits: 9 });
}

export default function VerTorneo() {
  const { program, connection } = useProgram();

  const [direccion, setDireccion] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datos, setDatos] = useState<DatosTorneo | null>(null);

  const cluster = connection.rpcEndpoint.includes("devnet")
    ? "?cluster=devnet"
    : connection.rpcEndpoint.includes("127.0.0.1")
      ? "?cluster=custom&customUrl=http://127.0.0.1:8899"
      : "";

  async function consultar() {
    setError(null);
    setDatos(null);

    let pubkey: PublicKey;
    try {
      pubkey = new PublicKey(direccion.trim());
    } catch {
      setError("La direccion no es una PublicKey valida.");
      return;
    }

    setCargando(true);
    try {
      const cuenta = await program.account.tournamentAccount.fetch(pubkey);
      setDatos(cuenta as unknown as DatosTorneo);
    } catch (e) {
      const err = e as { message?: string };
      if (err?.message?.includes("Account does not exist")) {
        setError("No existe ningun torneo en esa direccion (en este cluster).");
      } else {
        setError(err?.message ?? "Error al leer el torneo.");
      }
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="mt-6 w-full max-w-xl rounded-lg border border-gray-600 p-5">
      <h2 className="mb-4 text-lg font-semibold">Ver torneo</h2>

      <label className="mb-1 block text-sm opacity-70">
        Direccion del torneo (la que te dio Crear torneo)
      </label>
      <div className="mb-4 flex gap-2">
        <input
          className="w-full rounded border border-gray-500 bg-transparent p-2"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          placeholder="Pega aqui la direccion del torneo"
        />
        <button
          onClick={consultar}
          disabled={cargando}
          className="rounded bg-blue-600 px-4 font-medium disabled:opacity-50"
        >
          {cargando ? "..." : "Ver"}
        </button>
      </div>

      {error && (
        <p className="rounded bg-red-900/40 p-2 text-sm text-red-300">{error}</p>
      )}

      {datos && (
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="opacity-70">Estado:</span>
            {datos.isOpen ? (
              <span className="rounded bg-green-900/50 px-2 py-0.5 text-green-300">
                Abierto (aceptando inscripciones)
              </span>
            ) : (
              <span className="rounded bg-gray-700 px-2 py-0.5 text-gray-300">
                Cerrado (premios repartidos)
              </span>
            )}
          </div>

          <p>
            <span className="opacity-70">Bracket ID (Start.gg): </span>
            {datos.startggBracketId}
          </p>
          <p>
            <span className="opacity-70">Costo de inscripcion: </span>
            {aSol(datos.entryFee)} SOL
          </p>
          <p>
            <span className="opacity-70">Pozo acumulado: </span>
            {aSol(datos.totalFunds)} SOL
          </p>

          <div>
            <span className="opacity-70">Reparto de premios:</span>
            <ul className="ml-4 mt-1 list-disc">
              {datos.prizePercentages.map((p, i) => (
                <li key={i}>
                  {i + 1} lugar: {p}%
                </li>
              ))}
            </ul>
          </div>

          <p className="break-all">
            <span className="opacity-70">Organizador (admin): </span>
            <a
              className="text-blue-300 underline"
              href={
                "https://explorer.solana.com/address/" +
                datos.admin.toBase58() +
                cluster
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              {datos.admin.toBase58()}
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
