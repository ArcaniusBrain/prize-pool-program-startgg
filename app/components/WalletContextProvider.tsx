"use client";

import { ReactNode, useMemo } from "react";
import {
    ConnectionProvider,
    WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";

// Estilos del botón/modal de wallet (necesarios para que se vea bien)
import "@solana/wallet-adapter-react-ui/styles.css";

/**
 * Provee la conexión RPC y el contexto de wallet a toda la app.
 * MetaMask (y otras wallets de Solana) se detectan solas por Wallet Standard,
 * por eso la lista de wallets va vacía.
 */
export default function WalletContextProvider({
    children,
}: {
    children: ReactNode;
}) {
    const endpoint =
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

    const wallets = useMemo(() => [], []);

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>{children}</WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
}