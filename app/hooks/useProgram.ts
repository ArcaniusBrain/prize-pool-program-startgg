"use client";

import { useMemo } from "react";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";

// IDL y types generados por `anchor build` (copiados en el Paso 1)
import idl from "../lib/idl/prize_pool_program.json";
import type { PrizePoolProgram } from "../lib/idl/prize_pool_program";

/**
 * Construye el cliente de Anchor para el programa Prize Pool.
 *
 * - Con wallet conectada: el programa puede FIRMAR transacciones
 *   (initialize_tournament, register_player, refund_player, distribute_prizes).
 * - Sin wallet: queda en modo SOLO LECTURA (suficiente para leer
 *   TournamentAccount y PlayerRecord en la vista pública del torneo).
 */
export function useProgram() {
    const { connection } = useConnection();
    const wallet = useAnchorWallet(); // undefined si no hay wallet conectada

    // Provider de Anchor: conexión RPC + wallet que firma
    const provider = useMemo(() => {
        if (!wallet) return null;
        return new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    }, [connection, wallet]);

    // Programa tipado. OJO (sorpresa de la API moderna, como las de Rust):
    // desde @coral-xyz/anchor 0.30+ el constructor es new Program(idl, provider).
    // El Program ID se lee de idl.address — ya NO se pasa como argumento aparte.
    const program = useMemo(() => {
        return new Program<PrizePoolProgram>(
            idl as PrizePoolProgram,
            provider ?? { connection }, // sin wallet => solo lectura
        );
    }, [provider, connection]);

    return {
        program,
        provider, // null si no hay wallet
        connection,
        wallet, // undefined si no hay wallet
        puedeFirmar: !!wallet,
    };
}