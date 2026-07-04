// Tests del contrato prize-pool-program sobre litesvm (SVM en memoria).
// Se corren con: anchor build && cargo test
// No requieren Surfpool ni validador externo.

use {
    anchor_lang::{
        prelude::Pubkey, solana_program::instruction::Instruction, AccountDeserialize,
        InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const BRACKET_ID: u32 = 987_654;
const ENTRANT_1: u32 = 111;
const ENTRANT_2: u32 = 222;
const ENTRY_FEE: u64 = 100_000_000; // 0.1 SOL en lamports
const SOL: u64 = 1_000_000_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Envía una instrucción firmada por `payer`. Devuelve Ok(()) si la tx pasó.
fn send_ix(svm: &mut LiteSVM, ix: Instruction, payer: &Keypair) -> Result<(), String> {
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[ix], Some(&payer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[payer]).unwrap();
    svm.send_transaction(tx).map(|_| ()).map_err(|e| format!("{e:?}"))
}

fn tournament_pda(admin: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[b"tournament", admin.as_ref(), &BRACKET_ID.to_le_bytes()],
        &prize_pool_program::id(),
    )
    .0
}

fn vault_pda(tournament: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"vault", tournament.as_ref()], &prize_pool_program::id()).0
}

fn player_record_pda(tournament: &Pubkey, entrant_id: u32) -> Pubkey {
    Pubkey::find_program_address(
        &[
            b"player_record",
            tournament.as_ref(),
            &entrant_id.to_le_bytes(),
        ],
        &prize_pool_program::id(),
    )
    .0
}

fn register_ix(tournament: &Pubkey, player_wallet: &Pubkey, entrant_id: u32) -> Instruction {
    Instruction::new_with_bytes(
        prize_pool_program::id(),
        &prize_pool_program::instruction::RegisterPlayer {
            startgg_entrant_id: entrant_id,
        }
        .data(),
        prize_pool_program::accounts::RegisterPlayer {
            tournament: *tournament,
            vault: vault_pda(tournament),
            player_record: player_record_pda(tournament, entrant_id),
            player_wallet: *player_wallet,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn refund_ix(
    tournament: &Pubkey,
    player_wallet: &Pubkey,
    entrant_id: u32,
    admin: &Pubkey,
) -> Instruction {
    Instruction::new_with_bytes(
        prize_pool_program::id(),
        &prize_pool_program::instruction::RefundPlayer {}.data(),
        prize_pool_program::accounts::RefundPlayer {
            tournament: *tournament,
            vault: vault_pda(tournament),
            player_record: player_record_pda(tournament, entrant_id),
            player_wallet: *player_wallet,
            admin: *admin,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn read_tournament(svm: &LiteSVM, pda: &Pubkey) -> prize_pool_program::TournamentAccount {
    let acct = svm.get_account(pda).expect("TournamentAccount no existe");
    prize_pool_program::TournamentAccount::try_deserialize(&mut acct.data.as_slice()).unwrap()
}

fn read_player_record(svm: &LiteSVM, pda: &Pubkey) -> prize_pool_program::PlayerRecord {
    let acct = svm.get_account(pda).expect("PlayerRecord no existe");
    prize_pool_program::PlayerRecord::try_deserialize(&mut acct.data.as_slice()).unwrap()
}

fn vault_balance(svm: &LiteSVM, vault: &Pubkey) -> u64 {
    svm.get_account(vault).map(|a| a.lamports).unwrap_or(0)
}

/// Crea la SVM, carga el programa, fondea al admin e inicializa el torneo.
fn setup() -> (LiteSVM, Keypair, Pubkey, Pubkey) {
    let program_id = prize_pool_program::id();
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../target/deploy/prize_pool_program.so");
    svm.add_program(program_id, bytes).unwrap();

    let admin = Keypair::new();
    svm.airdrop(&admin.pubkey(), 2 * SOL).unwrap();

    let tournament = tournament_pda(&admin.pubkey());
    let vault = vault_pda(&tournament);

    let ix = Instruction::new_with_bytes(
        program_id,
        &prize_pool_program::instruction::InitializeTournament {
            startgg_bracket_id: BRACKET_ID,
            entry_fee: ENTRY_FEE,
        }
        .data(),
        prize_pool_program::accounts::InitializeTournament {
            tournament,
            vault,
            admin: admin.pubkey(),
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    );
    send_ix(&mut svm, ix, &admin).expect("initialize_tournament falló");

    (svm, admin, tournament, vault)
}

/// Crea un jugador con 1 SOL de saldo.
fn new_player(svm: &mut LiteSVM) -> Keypair {
    let player = Keypair::new();
    svm.airdrop(&player.pubkey(), SOL).unwrap();
    player
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[test]
fn test_initialize_tournament() {
    let (svm, admin, tournament, vault) = setup();

    let t = read_tournament(&svm, &tournament);
    assert_eq!(t.admin, admin.pubkey());
    assert_eq!(t.startgg_bracket_id, BRACKET_ID);
    assert_eq!(t.entry_fee, ENTRY_FEE);
    assert_eq!(t.total_funds, 0);
    assert!(t.is_open);

    // La bóveda arranca vacía
    assert_eq!(vault_balance(&svm, &vault), 0);
}

#[test]
fn test_register_player_paga_a_la_boveda() {
    let (mut svm, _admin, tournament, vault) = setup();
    let player1 = new_player(&mut svm);

    let vault_antes = vault_balance(&svm, &vault);

    send_ix(
        &mut svm,
        register_ix(&tournament, &player1.pubkey(), ENTRANT_1),
        &player1,
    )
    .expect("register_player falló");

    // El PlayerRecord quedó bien escrito
    let rec = read_player_record(&svm, &player_record_pda(&tournament, ENTRANT_1));
    assert_eq!(rec.tournament, tournament);
    assert_eq!(rec.player_wallet, player1.pubkey());
    assert_eq!(rec.startgg_entrant_id, ENTRANT_1);
    assert_eq!(rec.amount_paid, ENTRY_FEE);

    // La bóveda recibió exactamente el entry_fee
    assert_eq!(vault_balance(&svm, &vault) - vault_antes, ENTRY_FEE);

    // El acumulado del torneo se actualizó
    let t = read_tournament(&svm, &tournament);
    assert_eq!(t.total_funds, ENTRY_FEE);
}

#[test]
fn test_acumula_fondos_con_dos_jugadores() {
    let (mut svm, _admin, tournament, vault) = setup();
    let player1 = new_player(&mut svm);
    let player2 = new_player(&mut svm);

    send_ix(
        &mut svm,
        register_ix(&tournament, &player1.pubkey(), ENTRANT_1),
        &player1,
    )
    .expect("registro del jugador 1 falló");

    send_ix(
        &mut svm,
        register_ix(&tournament, &player2.pubkey(), ENTRANT_2),
        &player2,
    )
    .expect("registro del jugador 2 falló");

    assert_eq!(vault_balance(&svm, &vault), 2 * ENTRY_FEE);

    let t = read_tournament(&svm, &tournament);
    assert_eq!(t.total_funds, 2 * ENTRY_FEE);
}

#[test]
fn test_rechaza_doble_inscripcion_del_mismo_entrant() {
    let (mut svm, _admin, tournament, _vault) = setup();
    let player1 = new_player(&mut svm);
    let player2 = new_player(&mut svm);

    // Primera inscripción del ENTRANT_1: pasa
    send_ix(
        &mut svm,
        register_ix(&tournament, &player1.pubkey(), ENTRANT_1),
        &player1,
    )
    .expect("registro del jugador 1 falló");

    // Segunda inscripción del MISMO entrant_id (aunque pague otra wallet):
    // debe fallar porque la PDA [player_record, tournament, entrant_id] ya existe.
    let res = send_ix(
        &mut svm,
        register_ix(&tournament, &player2.pubkey(), ENTRANT_1),
        &player2,
    );
    assert!(res.is_err(), "la doble inscripción debió fallar y no falló");

    // El estado no cambió: sigue habiendo un solo pago acumulado
    let t = read_tournament(&svm, &tournament);
    assert_eq!(t.total_funds, ENTRY_FEE);
}

#[test]
fn test_refund_devuelve_fondos_y_cierra_el_record() {
    let (mut svm, admin, tournament, vault) = setup();
    let player1 = new_player(&mut svm);

    send_ix(
        &mut svm,
        register_ix(&tournament, &player1.pubkey(), ENTRANT_1),
        &player1,
    )
    .expect("registro falló");

    let record = player_record_pda(&tournament, ENTRANT_1);
    let record_rent = svm.get_account(&record).unwrap().lamports;
    let player_antes = svm.get_account(&player1.pubkey()).unwrap().lamports;
    let vault_antes = vault_balance(&svm, &vault);

    // El ADMIN ejecuta el reembolso (el jugador no firma nada)
    send_ix(
        &mut svm,
        refund_ix(&tournament, &player1.pubkey(), ENTRANT_1, &admin.pubkey()),
        &admin,
    )
    .expect("refund_player falló");

    // El jugador recupera su entry_fee + la renta del PlayerRecord cerrado
    let player_despues = svm.get_account(&player1.pubkey()).unwrap().lamports;
    assert_eq!(player_despues - player_antes, ENTRY_FEE + record_rent);

    // La bóveda devolvió exactamente el entry_fee
    assert_eq!(vault_antes - vault_balance(&svm, &vault), ENTRY_FEE);

    // El acumulado volvió a cero y el record quedó cerrado
    let t = read_tournament(&svm, &tournament);
    assert_eq!(t.total_funds, 0);
    assert!(svm
        .get_account(&record)
        .map_or(true, |a| a.lamports == 0));
}

#[test]
fn test_refund_rechaza_a_quien_no_es_admin() {
    let (mut svm, _admin, tournament, _vault) = setup();
    let player1 = new_player(&mut svm);

    send_ix(
        &mut svm,
        register_ix(&tournament, &player1.pubkey(), ENTRANT_1),
        &player1,
    )
    .expect("registro falló");

    // El propio jugador intenta autogestionarse el reembolso: debe fallar
    // por la restricción has_one = admin del torneo.
    let res = send_ix(
        &mut svm,
        refund_ix(&tournament, &player1.pubkey(), ENTRANT_1, &player1.pubkey()),
        &player1,
    );
    assert!(res.is_err(), "el reembolso por un no-admin debió fallar");

    // Nada cambió: el pago sigue en la bóveda
    let t = read_tournament(&svm, &tournament);
    assert_eq!(t.total_funds, ENTRY_FEE);
}

#[test]
fn test_refund_no_puede_ejecutarse_dos_veces() {
    let (mut svm, admin, tournament, _vault) = setup();
    let player1 = new_player(&mut svm);

    send_ix(
        &mut svm,
        register_ix(&tournament, &player1.pubkey(), ENTRANT_1),
        &player1,
    )
    .expect("registro falló");

    // Primer reembolso: pasa
    send_ix(
        &mut svm,
        refund_ix(&tournament, &player1.pubkey(), ENTRANT_1, &admin.pubkey()),
        &admin,
    )
    .expect("el primer reembolso falló");

    // Avanzamos el blockhash para que la segunda tx no sea idéntica a la
    // primera (litesvm la rechazaría por duplicada antes de ejecutarla).
    svm.expire_blockhash();

    // Segundo reembolso del mismo record: debe fallar porque el
    // PlayerRecord ya fue cerrado y no existe.
    let res = send_ix(
        &mut svm,
        refund_ix(&tournament, &player1.pubkey(), ENTRANT_1, &admin.pubkey()),
        &admin,
    );
    assert!(res.is_err(), "el segundo reembolso debió fallar");
}
