"use client";

import { useState } from "react";
import {
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  AccountMeta,
} from "@solana/web3.js";
import { useProgram } from "../hooks/useProgram";
import { pdaBoveda, pdaPlayerRecord } from "../lib/pdas";

type Jugador = {
  record: PublicKey;
  wallet: PublicKey;
  entrantId: number;
  pagado: number;
};

export default function PanelAdmin() {
  const { program, wallet, connection, puedeFirmar } = useProgram();

  const [direccionTorneo, setDireccionTorneo] = useState("");
  const [torneoPk, setTorneoPk] = useState<PublicKey | null>(null);
  const [numPorcentajes, setNumPorcentajes] = useState(0);
  const [pozoSol, setPozoSol] = useState<string>("0");
  const [abierto, setAbierto] = useState(true);

  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [ganadores, setGanadores] = useState<number[]>([]);

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
    if (texto.toLowerCase().includes("user rejected"))
      return "Rechazaste la transaccion en la wallet.";
    return err?.message ?? "Error desconocido.";
  }

  async function cargar() {
    setError(null);
    setAviso(null);
    setJugadores([]);
    setGanadores([]);
    setTorneoPk(null);

    let pk: PublicKey;
    try {
      pk = new PublicKey(direccionTorneo.trim());
    } catch {
      setError("La direccion del torneo no es valida.");
      return;
    }

    setCargando(true);
    try {
      const torneo = await program.account.tournamentAccount.fetch(pk);
      setNumPorcentajes(torneo.prizePercentages.length);
      setPozoSol(
        (Number(torneo.totalFunds.toString()) / LAMPORTS_PER_SOL).toString(),
      );
      setAbierto(torneo.isOpen);

      const records = await program.account.playerRecord.all([
        { memcmp: { offset: 8, bytes: pk.toBase58() } },
      ]);

      const lista: Jugador[] = records.map((r) => ({
        record: r.publicKey,
        wallet: r.account.playerWallet,
        entrantId: r.account.startggEntrantId,
        pagado: Number(r.account.amountPaid.toString()),
      }));

      setJugadores(lista);
      setTorneoPk(pk);
      if (lista.length === 0) setAviso("Este torneo aun no tiene inscritos.");
    } catch (e) {
      const err = e as { message?: string };
      if (err?.message?.includes("Account does not exist")) {
        setError("No existe ningun torneo en esa direccion (en este cluster).");
      } else {
        setError(traducirError(e));
      }
    } finally {
      setCargando(false);
    }
  }

  async function reembolsar(j: Jugador) {
    if (!puedeFirmar || !wallet || !torneoPk) return;
    setError(null);
    setAviso(null);
    setCargando(true);
    try {
      const [bovedaPda] = pdaBoveda(torneoPk);
      const firma = await program.methods
        .refundPlayer()
        .accountsPartial({
          tournament: torneoPk,
          vault: bovedaPda,
          playerRecord: j.record,
          playerWallet: j.wallet,
          admin: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      setAviso("Reembolso hecho al entrant " + j.entrantId + ". Tx: " + firma);
      await cargar();
    } catch (e) {
      setError(traducirError(e));
    } finally {
      setCargando(false);
    }
  }

  function alternarGanador(entrantId: number) {
    setGanadores((prev) =>
      prev.includes(entrantId)
        ? prev.filter((id) => id !== entrantId)
        : prev.length < numPorcentajes
          ? [...prev, entrantId]
          : prev,
    );
  }

  async function distribuir() {
    if (!puedeFirmar || !wallet || !torneoPk) return;
    setError(null);
    setAviso(null);

    if (ganadores.length !== numPorcentajes) {
      setError(
        "Debes elegir exactamente " +
          numPorcentajes +
          " ganador(es), en orden.",
      );
      return;
    }

    setCargando(true);
    try {
      const [bovedaPda] = pdaBoveda(torneoPk);

      const remaining: AccountMeta[] = [];
      for (const entrantId of ganadores) {
        const jugador = jugadores.find((j) => j.entrantId === entrantId);
        if (!jugador) throw new Error("No se encontro el entrant " + entrantId);
        const [recordPda] = pdaPlayerRecord(torneoPk, entrantId);
        remaining.push({
          pubkey: recordPda,
          isSigner: false,
          isWritable: false,
        });
        remaining.push({
          pubkey: jugador.wallet,
          isSigner: false,
          isWritable: true,
        });
      }

      const firma = await program.methods
        .distributePrizes(ganadores)
        .accountsPartial({
          tournament: torneoPk,
          vault: bovedaPda,
          admin: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(remaining)
        .rpc();

      setAviso("Premios repartidos. Tx: " + firma);
      await cargar();
    } catch (e) {
      setError(traducirError(e));
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="mt-6 w-full max-w-xl rounded-lg border border-gray-600 p-5">
      <h2 className="mb-4 text-lg font-semibold">Panel del organizador</h2>

      <label className="mb-1 block text-sm opacity-70">
        Direccion del torneo (debes ser su admin)
      </label>
      <div className="mb-4 flex gap-2">
        <input
          className="w-full rounded border border-gray-500 bg-transparent p-2"
          value={direccionTorneo}
          onChange={(e) => setDireccionTorneo(e.target.value)}
          placeholder="Pega aqui la direccion del torneo"
        />
        <button
          onClick={cargar}
          disabled={cargando}
          className="rounded bg-blue-600 px-4 font-medium disabled:opacity-50"
        >
          {cargando ? "..." : "Cargar"}
        </button>
      </div>

      {error && (
        <p className="mb-3 rounded bg-red-900/40 p-2 text-sm text-red-300">
          {error}
        </p>
      )}
      {aviso && (
        <p className="mb-3 break-all rounded bg-green-900/30 p-2 text-sm text-green-300">
          {aviso}
        </p>
      )}

      {torneoPk && (
        <>
          <div className="mb-4 text-sm">
            <p>
              <span className="opacity-70">Pozo acumulado: </span>
              {pozoSol} SOL
            </p>
            <p>
              <span className="opacity-70">Estado: </span>
              {abierto ? "Abierto" : "Cerrado (premios ya repartidos)"}
            </p>
            <p>
              <span className="opacity-70">Posiciones premiadas: </span>
              {numPorcentajes}
            </p>
          </div>

          <h3 className="mb-2 font-medium">
            Jugadores inscritos ({jugadores.length})
          </h3>
          {jugadores.length === 0 ? (
            <p className="text-sm opacity-60">Sin inscritos.</p>
          ) : (
            <ul className="space-y-2">
              {jugadores.map((j) => {
                const posicion = ganadores.indexOf(j.entrantId);
                return (
                  <li
                    key={j.record.toBase58()}
                    className="flex items-center justify-between gap-2 rounded border border-gray-700 p-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p>Entrant {j.entrantId}</p>
                      <p className="break-all text-xs opacity-60">
                        {j.wallet.toBase58()}
                      </p>
                      <p className="text-xs opacity-60">
                        Pago {j.pagado / LAMPORTS_PER_SOL} SOL
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {abierto && (
                        <button
                          onClick={() => reembolsar(j)}
                          disabled={cargando || !puedeFirmar}
                          className="text-xs text-red-400 disabled:opacity-40"
                        >
                          reembolsar
                        </button>
                      )}
                      {abierto && (
                        <button
                          onClick={() => alternarGanador(j.entrantId)}
                          className={
                            "rounded px-2 py-0.5 text-xs " +
                            (posicion >= 0
                              ? "bg-yellow-600 text-white"
                              : "bg-gray-700 text-gray-300")
                          }
                        >
                          {posicion >= 0
                            ? posicion + 1 + " ganador"
                            : "marcar ganador"}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {abierto && (
            <div className="mt-5 border-t border-gray-700 pt-4">
              <h3 className="mb-2 font-medium">Repartir premios</h3>
              <p className="mb-2 text-sm opacity-70">
                Ganadores elegidos ({ganadores.length}/{numPorcentajes}), en
                orden: {ganadores.length ? ganadores.join(" - ") : "ninguno"}
              </p>
              <button
                onClick={distribuir}
                disabled={
                  cargando ||
                  !puedeFirmar ||
                  ganadores.length !== numPorcentajes
                }
                className="w-full rounded bg-yellow-600 p-2 font-medium disabled:opacity-50"
              >
                Repartir y cerrar torneo
              </button>
              <p className="mt-2 text-xs opacity-50">
                Esto cierra el torneo definitivamente: no se podra volver a
                repartir ni inscribir a nadie.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
