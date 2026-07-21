"use client";

import { useEffect, useState } from "react";
import { useProgram } from "../hooks/useProgram";

type Estado = "cargando" | "desplegado" | "no-encontrado" | "error";

/**
 * Diagnóstico de la Tarea 1: confirma que el IDL cargó, muestra el
 * Program ID y verifica on-chain que el programa existe en el clúster.
 */
export default function EstadoPrograma() {
    const { program, connection, puedeFirmar } = useProgram();
    const [estado, setEstado] = useState<Estado>("cargando");

    const programId = program.programId.toBase58();
    const endpoint = connection.rpcEndpoint;

    useEffect(() => {
        // Regla de React 19 que ya nos mordió una vez: nada de setState en el
        // cuerpo del efecto; solo en el callback de la promesa, con flag.
        let cancelado = false;

        connection
            .getAccountInfo(program.programId)
            .then((info) => {
                if (cancelado) return;
                setEstado(info?.executable ? "desplegado" : "no-encontrado");
            })
            .catch(() => {
                if (!cancelado) setEstado("error");
            });

        return () => {
            cancelado = true;
        };
    }, [connection, program.programId]);

    const mensajes: Record<Estado, string> = {
        cargando: "Verificando programa en el clúster…",
        desplegado: "✅ Programa desplegado y ejecutable en este clúster",
        "no-encontrado":
            "❌ El programa NO existe en este clúster (¿deploy pendiente o RPC equivocado?)",
        error: "⚠️ Error consultando el RPC (¿conexión / VPN?)",
    };

    return (
        <div className="mt-6 w-full max-w-xl rounded-lg border border-gray-600 p-4 text-sm">
            <h2 className="mb-2 font-semibold">Cliente Anchor — Tarea 1</h2>
            <p>
                <span className="opacity-60">Program ID: </span>
                <code className="break-all">{programId}</code>
            </p>
            <p>
                <span className="opacity-60">RPC: </span>
                <code>{endpoint}</code>
            </p>
            <p>
                <span className="opacity-60">Wallet puede firmar: </span>
                {puedeFirmar ? "sí" : "no (conecta MetaMask)"}
            </p>
            <p className="mt-2">{mensajes[estado]}</p>
        </div>
    );
}