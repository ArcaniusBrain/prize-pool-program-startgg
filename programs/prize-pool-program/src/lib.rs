use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("DLo6qSd1fZ4D2T5cyeuDKSSWjgPcdGxwKVjTojEuL3N4");

#[program]
pub mod prize_pool_program {
    use super::*;

    /// Crea el TournamentAccount y deja lista la PDA de la bóveda.
    /// (Si tu versión ya implementada difiere, mantén la tuya: register_player
    /// solo necesita que el torneo guarde entry_fee, is_open, total_funds y vault_bump.)
    pub fn initialize_tournament(
        ctx: Context<InitializeTournament>,
        startgg_bracket_id: u32,
        entry_fee: u64,
        prize_percentages: Vec<u8>,
    ) -> Result<()> {
        require!(entry_fee > 0, PrizePoolError::InvalidEntryFee);

        // El reparto lo define el TO al habilitar el prize pool (ej. 60/30/10):
        // entre 1 y 10 posiciones, y los porcentajes deben sumar exactamente 100.
        // Queda grabado on-chain ANTES de que nadie pague: el admin no puede
        // cambiarlo después de recaudar.
        require!(
            !prize_percentages.is_empty() && prize_percentages.len() <= 10,
            PrizePoolError::InvalidPercentages
        );
        let suma: u32 = prize_percentages.iter().map(|p| *p as u32).sum();
        require!(suma == 100, PrizePoolError::InvalidPercentages);

        let tournament = &mut ctx.accounts.tournament;
        tournament.admin = ctx.accounts.admin.key();
        tournament.startgg_bracket_id = startgg_bracket_id;
        tournament.entry_fee = entry_fee;
        tournament.total_funds = 0;
        tournament.is_open = true;
        tournament.vault_bump = ctx.bumps.vault;
        tournament.prize_percentages = prize_percentages;

        Ok(())
    }

    /// Inscribe a un jugador: transfiere el entry_fee a la bóveda y crea su
    /// PlayerRecord on-chain. Los seeds de la PDA incluyen el startgg_entrant_id,
    /// por lo que un mismo entrant NO puede inscribirse dos veces en la misma
    /// bracket (el init de la PDA fallaría con "already in use").
    pub fn register_player(
        ctx: Context<RegisterPlayer>,
        startgg_entrant_id: u32,
    ) -> Result<()> {
        require!(
            ctx.accounts.tournament.is_open,
            PrizePoolError::RegistrationClosed
        );

        let entry_fee = ctx.accounts.tournament.entry_fee;

        // 1) Pago: wallet del jugador -> bóveda (PDA). El jugador firma, así que
        //    es una transferencia normal del System Program vía CPI.
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                Transfer {
                    from: ctx.accounts.player_wallet.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            entry_fee,
        )?;

        // 2) Registro on-chain del pago (fuente de verdad para el dashboard del TO).
        let player_record = &mut ctx.accounts.player_record;
        player_record.tournament = ctx.accounts.tournament.key();
        player_record.player_wallet = ctx.accounts.player_wallet.key();
        player_record.startgg_entrant_id = startgg_entrant_id;
        player_record.amount_paid = entry_fee;

        // 3) Acumulado del pozo.
        let tournament = &mut ctx.accounts.tournament;
        tournament.total_funds = tournament
            .total_funds
            .checked_add(entry_fee)
            .ok_or(PrizePoolError::MathOverflow)?;

        Ok(())
    }

    /// Reembolsa a un jugador. SOLO el admin del torneo puede ejecutarla
    /// (el jugador no puede autogestionarse el reembolso, por diseño).
    /// Devuelve el entry_fee desde la bóveda a la wallet del jugador y cierra
    /// su PlayerRecord (close = player_wallet le devuelve además la renta).
    pub fn refund_player(ctx: Context<RefundPlayer>) -> Result<()> {
        let amount = ctx.accounts.player_record.amount_paid;
        let tournament_key = ctx.accounts.tournament.key();
        let vault_bump = ctx.accounts.tournament.vault_bump;

        // La bóveda es una PDA: el programa firma la transferencia con sus seeds.
        let signer_seeds: &[&[&[u8]]] =
            &[&[b"vault", tournament_key.as_ref(), &[vault_bump]]];

        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.key(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.player_wallet.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        let tournament = &mut ctx.accounts.tournament;
        tournament.total_funds = tournament
            .total_funds
            .checked_sub(amount)
            .ok_or(PrizePoolError::MathOverflow)?;

        Ok(())
    }

    /// Reparte el pozo entre los ganadores según los porcentajes definidos al
    /// crear el torneo, y lo cierra (is_open = false). SOLO el admin puede
    /// ejecutarla. Los ganadores se pasan en orden (1°, 2°, 3°...) como
    /// remaining_accounts en pares [PlayerRecord, wallet], y sus entrant_ids
    /// (obtenidos de standings de Start.gg) como argumento.
    pub fn distribute_prizes<'info>(
        ctx: Context<'info, DistributePrizes<'info>>,
        winner_entrant_ids: Vec<u32>,
    ) -> Result<()> {
        let tournament = &ctx.accounts.tournament;
        require!(tournament.is_open, PrizePoolError::TournamentClosed);
        require!(
            winner_entrant_ids.len() == tournament.prize_percentages.len(),
            PrizePoolError::WrongWinnerCount
        );
        require!(
            ctx.remaining_accounts.len() == winner_entrant_ids.len() * 2,
            PrizePoolError::WrongWinnerCount
        );

        let pot = tournament.total_funds;
        let tournament_key = tournament.key();
        let vault_bump = tournament.vault_bump;
        let percentages = tournament.prize_percentages.clone();

        let signer_seeds: &[&[&[u8]]] =
            &[&[b"vault", tournament_key.as_ref(), &[vault_bump]]];

        let mut distributed: u64 = 0;

        for (i, entrant_id) in winner_entrant_ids.iter().enumerate() {
            let record_info = &ctx.remaining_accounts[i * 2];
            let wallet_info = &ctx.remaining_accounts[i * 2 + 1];

            // 1) El PlayerRecord debe ser la PDA exacta de este entrant en este
            //    torneo => el "ganador" realmente pagó su inscripción aquí.
            let (expected_record, _) = Pubkey::find_program_address(
                &[
                    b"player_record",
                    tournament_key.as_ref(),
                    &entrant_id.to_le_bytes(),
                ],
                ctx.program_id,
            );
            require_keys_eq!(
                record_info.key(),
                expected_record,
                PrizePoolError::WinnerAccountMismatch
            );

            // 2) La wallet destino debe ser la misma que pagó la inscripción.
            let record: Account<PlayerRecord> = Account::try_from(record_info)?;
            require_keys_eq!(
                record.player_wallet,
                wallet_info.key(),
                PrizePoolError::WinnerAccountMismatch
            );

            // 3) Premio = pozo * porcentaje / 100 (u128 evita overflow; el polvo
            //    por redondeo entero queda en la bóveda).
            let amount = ((pot as u128) * (percentages[i] as u128) / 100) as u64;

            transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.key(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: wallet_info.clone(),
                    },
                    signer_seeds,
                ),
                amount,
            )?;

            distributed = distributed
                .checked_add(amount)
                .ok_or(PrizePoolError::MathOverflow)?;
        }

        let tournament = &mut ctx.accounts.tournament;
        tournament.total_funds = tournament
            .total_funds
            .checked_sub(distributed)
            .ok_or(PrizePoolError::MathOverflow)?;
        tournament.is_open = false;

        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Contextos de cuentas
// ---------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(startgg_bracket_id: u32)]
pub struct InitializeTournament<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + TournamentAccount::INIT_SPACE,
        seeds = [b"tournament", admin.key().as_ref(), &startgg_bracket_id.to_le_bytes()],
        bump
    )]
    pub tournament: Account<'info, TournamentAccount>,

    /// Bóveda: cuenta del System Program (solo guarda SOL, sin datos).
    /// No se inicializa aquí; existe en cuanto recibe lamports.
    #[account(
        seeds = [b"vault", tournament.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(startgg_entrant_id: u32)]
pub struct RegisterPlayer<'info> {
    #[account(mut)]
    pub tournament: Account<'info, TournamentAccount>,

    #[account(
        mut,
        seeds = [b"vault", tournament.key().as_ref()],
        bump = tournament.vault_bump
    )]
    pub vault: SystemAccount<'info>,

    /// Seeds con el entrant_id => imposibilita físicamente la doble inscripción.
    #[account(
        init,
        payer = player_wallet,
        space = 8 + PlayerRecord::INIT_SPACE,
        seeds = [
            b"player_record",
            tournament.key().as_ref(),
            &startgg_entrant_id.to_le_bytes()
        ],
        bump
    )]
    pub player_record: Account<'info, PlayerRecord>,

    #[account(mut)]
    pub player_wallet: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RefundPlayer<'info> {
    /// has_one = admin: la firma DEBE ser la wallet guardada como admin del torneo.
    #[account(mut, has_one = admin @ PrizePoolError::Unauthorized)]
    pub tournament: Account<'info, TournamentAccount>,

    #[account(
        mut,
        seeds = [b"vault", tournament.key().as_ref()],
        bump = tournament.vault_bump
    )]
    pub vault: SystemAccount<'info>,

    /// Se cierra al reembolsar: la renta vuelve al jugador junto con su entry_fee.
    /// has_one valida que el record pertenece a este torneo y a esta wallet.
    #[account(
        mut,
        close = player_wallet,
        has_one = tournament,
        has_one = player_wallet
    )]
    pub player_record: Account<'info, PlayerRecord>,

    /// Wallet del jugador que recibe el reembolso. No firma: el admin ejecuta.
    #[account(mut)]
    pub player_wallet: SystemAccount<'info>,

    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Los ganadores van como remaining_accounts: [record_1°, wallet_1°, record_2°, wallet_2°, ...]
#[derive(Accounts)]
pub struct DistributePrizes<'info> {
    #[account(mut, has_one = admin @ PrizePoolError::Unauthorized)]
    pub tournament: Account<'info, TournamentAccount>,

    #[account(
        mut,
        seeds = [b"vault", tournament.key().as_ref()],
        bump = tournament.vault_bump
    )]
    pub vault: SystemAccount<'info>,

    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

// ---------------------------------------------------------------------------
// Cuentas (estado on-chain) — según el diseño cerrado del proyecto
// ---------------------------------------------------------------------------

#[account]
#[derive(InitSpace)]
pub struct TournamentAccount {
    pub admin: Pubkey,           // Wallet del organizador (TO)
    pub startgg_bracket_id: u32, // ID de la bracket en Start.gg
    pub entry_fee: u64,          // Costo de inscripción en lamports
    pub total_funds: u64,        // Fondos acumulados en la bóveda
    pub is_open: bool,           // Estado del registro
    pub vault_bump: u8,
    #[max_len(10)]
    pub prize_percentages: Vec<u8>, // Reparto por posición (1°, 2°...). Suma 100.
}

#[account]
#[derive(InitSpace)]
pub struct PlayerRecord {
    pub tournament: Pubkey,      // Torneo asociado
    pub player_wallet: Pubkey,   // Wallet que pagó (destino del refund)
    pub startgg_entrant_id: u32, // ID del jugador en Start.gg
    pub amount_paid: u64,
}

// ---------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------

#[error_code]
pub enum PrizePoolError {
    #[msg("Las inscripciones de este torneo están cerradas.")]
    RegistrationClosed,
    #[msg("El entry fee debe ser mayor que cero.")]
    InvalidEntryFee,
    #[msg("Overflow aritmético al acumular fondos.")]
    MathOverflow,
    #[msg("Solo el admin del torneo puede ejecutar esta acción.")]
    Unauthorized,
    #[msg("Los porcentajes de premio deben ser de 1 a 10 posiciones y sumar exactamente 100.")]
    InvalidPercentages,
    #[msg("El torneo ya fue cerrado; los premios ya se repartieron.")]
    TournamentClosed,
    #[msg("La cantidad de ganadores no coincide con los porcentajes definidos.")]
    WrongWinnerCount,
    #[msg("Un ganador no coincide: el PlayerRecord o la wallet no corresponden a ese entrant.")]
    WinnerAccountMismatch,
}
