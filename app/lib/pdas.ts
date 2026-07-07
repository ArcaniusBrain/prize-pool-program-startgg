import { PublicKey } from "@solana/web3.js";

/** Program ID del contrato (mismo declare_id! de lib.rs). */
export const PROGRAM_ID = new PublicKey(
    "DLo6qSd1fZ4D2T5cyeuDKSSWjgPcdGxwKVjTojEuL3N4",
);

const codificador = new TextEncoder();

/**
 * u32 en little-endian (4 bytes): equivalente EXACTO de
 * `valor.to_le_bytes()` en Rust, que es lo que usan los seeds del programa.
 */
export function u32Le(valor: number): Uint8Array {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, valor, true); // true = little-endian
    return bytes;
}

/** PDA del torneo: seeds = ["tournament", admin, bracket_id (u32 LE)] */
export function pdaTorneo(
    admin: PublicKey,
    bracketId: number,
): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [codificador.encode("tournament"), admin.toBytes(), u32Le(bracketId)],
        PROGRAM_ID,
    );
}

/** PDA de la bóveda: seeds = ["vault", tournament] */
export function pdaBoveda(tournament: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [codificador.encode("vault"), tournament.toBytes()],
        PROGRAM_ID,
    );
}

/** PDA del registro de jugador: seeds = ["player_record", tournament, entrant_id (u32 LE)] */
export function pdaPlayerRecord(
    tournament: PublicKey,
    entrantId: number,
): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [
            codificador.encode("player_record"),
            tournament.toBytes(),
            u32Le(entrantId),
        ],
        PROGRAM_ID,
    );
}