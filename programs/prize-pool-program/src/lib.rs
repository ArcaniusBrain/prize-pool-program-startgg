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
    ) -> Result<()> {
        require!(entry_fee > 0, PrizePoolError::InvalidEntryFee);

        let tournament = &mut ctx.accounts.tournament;
        tournament.admin = ctx.accounts.admin.key();
        tournament.startgg_bracket_id = startgg_bracket_id;
        tournament.entry_fee = entry_fee;
        tournament.total_funds = 0;
        tournament.is_open = true;
        tournament.vault_bump = ctx.bumps.vault;

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
}
