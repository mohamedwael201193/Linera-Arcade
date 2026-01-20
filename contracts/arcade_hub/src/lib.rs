// Copyright (c) Linera Arcade Hub
// SPDX-License-Identifier: Apache-2.0

//! ABI and shared types for the Arcade Hub application.
//! Extended with Token Economy, Prediction Markets, and On-Chain Multiplayer.

use async_graphql::{InputObject, Request, Response, SimpleObject, Union};
use linera_sdk::{
    graphql::GraphQLMutationRoot,
    linera_base_types::{AccountOwner, ChainId, ContractAbi, ServiceAbi},
};
use serde::{Deserialize, Serialize};

/// The ABI for the Arcade Hub application.
pub struct ArcadeHubAbi;

impl ContractAbi for ArcadeHubAbi {
    type Operation = Operation;
    type Response = ArcadeResponse;
}

impl ServiceAbi for ArcadeHubAbi {
    type Query = Request;
    type QueryResponse = Response;
}

/// Unique identifier for game types.
pub type GameId = u16;

/// The supported game types in the arcade.
/// ALL 8 games are now natively supported in the contract.
#[derive(
    Clone, Copy, Debug, Eq, PartialEq, Hash, Serialize, Deserialize, async_graphql::Enum,
)]
pub enum GameType {
    SpeedClicker,
    MemoryMatrix,
    ReactionStrike,
    MathBlitz,
    SnakeSprint,
    // NEW: Added missing game types
    AimTrainer,
    ColorRush,
    TypingBlitz,
}

/// XP calculation constants - CAPPED to prevent XP explosion
/// Each game awards 30-75 XP max per play
const XP_HARD_CAP: u64 = 75;
const XP_MIN: u64 = 30;

impl GameType {
    /// Calculate XP earned based on game type and score.
    /// 
    /// XP ECONOMY RULES (Non-Negotiable):
    /// 1. XP per game is CAPPED (max 75 XP)
    /// 2. XP is calculated ONCE in contract only
    /// 3. Frontend NEVER calculates or guesses XP
    /// 
    /// Formula: base_xp + bonus (capped at 10) with hard cap of 75
    pub fn calculate_xp(&self, score: u64, bonus_data: Option<u64>) -> u64 {
        // Base XP per game type
        let base = match self {
            GameType::SpeedClicker => 40,   // Click speed game
            GameType::MemoryMatrix => 45,   // Memory pattern game
            GameType::ReactionStrike => 50, // Reaction time game
            GameType::MathBlitz => 55,      // Math solving game
            GameType::SnakeSprint => 35,    // Classic snake game
            GameType::AimTrainer => 45,     // Aim precision game
            GameType::ColorRush => 35,      // Color matching game
            GameType::TypingBlitz => 60,    // Typing speed game
        };
        
        // Bonus XP based on performance (max +10 XP)
        // Score is capped at 100 for bonus calculation
        let capped_score = score.min(100);
        let bonus = capped_score / 10; // 0-10 bonus XP
        
        // Additional bonus from bonus_data (e.g., streaks, perfect rounds)
        let extra = bonus_data.unwrap_or(0).min(50) / 10; // 0-5 extra XP
        
        // Total with hard cap
        let total = base + bonus + extra;
        total.clamp(XP_MIN, XP_HARD_CAP)
    }

    /// Get the game ID for this game type.
    pub fn id(&self) -> GameId {
        match self {
            GameType::SpeedClicker => 1,
            GameType::MemoryMatrix => 2,
            GameType::ReactionStrike => 3,
            GameType::MathBlitz => 4,
            GameType::SnakeSprint => 5,
            GameType::AimTrainer => 6,
            GameType::ColorRush => 7,
            GameType::TypingBlitz => 8,
        }
    }

    /// Get the display name for this game type.
    pub fn name(&self) -> &'static str {
        match self {
            GameType::SpeedClicker => "Speed Clicker",
            GameType::MemoryMatrix => "Memory Matrix",
            GameType::ReactionStrike => "Reaction Strike",
            GameType::MathBlitz => "Math Blitz",
            GameType::SnakeSprint => "Snake Sprint",
            GameType::AimTrainer => "Aim Trainer",
            GameType::ColorRush => "Color Rush",
            GameType::TypingBlitz => "Typing Blitz",
        }
    }
}

// =============================================================================
// ON-CHAIN MULTIPLAYER GAME TYPES
// =============================================================================

/// Multiplayer game types (turn-based only).
/// Speed/reflex games are NOT supported on-chain.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash, Serialize, Deserialize, async_graphql::Enum)]
pub enum MultiplayerGameType {
    TicTacToe,
    ConnectFour,
    Chess,
    Checkers,
    QuickMath,
}

impl MultiplayerGameType {
    /// Get the game name.
    pub fn name(&self) -> &'static str {
        match self {
            MultiplayerGameType::TicTacToe => "Tic Tac Toe",
            MultiplayerGameType::ConnectFour => "Connect Four",
            MultiplayerGameType::Chess => "Chess",
            MultiplayerGameType::Checkers => "Checkers",
            MultiplayerGameType::QuickMath => "Quick Math",
        }
    }

    /// Get default move timeout in seconds.
    pub fn default_timeout_secs(&self) -> u64 {
        match self {
            MultiplayerGameType::TicTacToe => 30,
            MultiplayerGameType::ConnectFour => 30,
            MultiplayerGameType::Chess => 300,      // 5 minutes for chess
            MultiplayerGameType::Checkers => 120,   // 2 minutes
            MultiplayerGameType::QuickMath => 15,   // Fast math rounds
        }
    }

    /// Calculate XP for winner.
    pub fn winner_xp(&self) -> u64 {
        match self {
            MultiplayerGameType::TicTacToe => 80,
            MultiplayerGameType::ConnectFour => 90,
            MultiplayerGameType::Chess => 120,
            MultiplayerGameType::Checkers => 100,
            MultiplayerGameType::QuickMath => 75,
        }
    }

    /// Calculate XP for loser (participation XP).
    pub fn loser_xp(&self) -> u64 {
        match self {
            MultiplayerGameType::TicTacToe => 25,
            MultiplayerGameType::ConnectFour => 30,
            MultiplayerGameType::Chess => 40,
            MultiplayerGameType::Checkers => 35,
            MultiplayerGameType::QuickMath => 20,
        }
    }

    /// Calculate XP for draw.
    pub fn draw_xp(&self) -> u64 {
        (self.winner_xp() + self.loser_xp()) / 2
    }

    /// Coins for winner.
    pub fn winner_coins(&self) -> u64 {
        self.winner_xp() / 5
    }

    /// Coins for loser.
    pub fn loser_coins(&self) -> u64 {
        self.loser_xp() / 5
    }
}

/// Player identifier in a multiplayer game.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq, Hash, Serialize, Deserialize, async_graphql::Enum)]
pub enum MultiplayerPlayer {
    #[default]
    One,
    Two,
}

impl MultiplayerPlayer {
    /// Get the other player.
    pub fn other(&self) -> Self {
        match self {
            MultiplayerPlayer::One => MultiplayerPlayer::Two,
            MultiplayerPlayer::Two => MultiplayerPlayer::One,
        }
    }

    /// Get index (0 or 1).
    pub fn index(&self) -> usize {
        match self {
            MultiplayerPlayer::One => 0,
            MultiplayerPlayer::Two => 1,
        }
    }
}

/// Status of a multiplayer game room.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq, Hash, Serialize, Deserialize, async_graphql::Enum)]
pub enum MultiplayerGameStatus {
    #[default]
    /// Waiting for second player to join.
    WaitingForPlayer,
    /// Game is in progress.
    InProgress,
    /// Game finished with a winner.
    Finished,
    /// Game ended in a draw.
    Draw,
    /// Game was forfeited.
    Forfeited,
    /// Game was abandoned (timeout).
    Abandoned,
}

/// A cell in Tic Tac Toe or similar games.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq, Hash, Serialize, Deserialize, SimpleObject, InputObject)]
#[graphql(input_name = "CellInput")]
pub struct Cell {
    /// The player who placed here, if any.
    pub player: Option<MultiplayerPlayer>,
}

/// Tic Tac Toe board (3x3).
#[derive(Clone, Debug, Serialize, Deserialize, SimpleObject, InputObject)]
#[graphql(input_name = "TicTacToeBoardInput")]
pub struct TicTacToeBoard {
    /// 9 cells, row by row: [0,1,2], [3,4,5], [6,7,8]
    pub cells: [Cell; 9],
}

impl Default for TicTacToeBoard {
    fn default() -> Self {
        Self {
            cells: [Cell::default(); 9],
        }
    }
}

impl TicTacToeBoard {
    /// Make a move at the given position (0-8).
    /// Returns true if the move is valid.
    pub fn make_move(&mut self, position: u8, player: MultiplayerPlayer) -> bool {
        if position >= 9 || self.cells[position as usize].player.is_some() {
            return false;
        }
        self.cells[position as usize].player = Some(player);
        true
    }

    /// Check if there's a winner.
    pub fn check_winner(&self) -> Option<MultiplayerPlayer> {
        const WIN_LINES: [[usize; 3]; 8] = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
            [0, 4, 8], [2, 4, 6],            // diagonals
        ];

        for line in WIN_LINES {
            let [a, b, c] = line;
            if let (Some(p1), Some(p2), Some(p3)) = (
                self.cells[a].player,
                self.cells[b].player,
                self.cells[c].player,
            ) {
                if p1 == p2 && p2 == p3 {
                    return Some(p1);
                }
            }
        }
        None
    }

    /// Check if the board is full (draw).
    pub fn is_full(&self) -> bool {
        self.cells.iter().all(|c| c.player.is_some())
    }
}

/// Connect Four board (6 rows x 7 columns).
#[derive(Clone, Debug, Serialize, Deserialize, SimpleObject, InputObject)]
#[graphql(input_name = "ConnectFourBoardInput")]
pub struct ConnectFourBoard {
    /// 42 cells, stored row by row from bottom to top.
    /// Index = row * 7 + col
    pub cells: Vec<Cell>,
}

impl Default for ConnectFourBoard {
    fn default() -> Self {
        Self {
            cells: vec![Cell::default(); 42],
        }
    }
}

impl ConnectFourBoard {
    /// Drop a piece in the given column (0-6).
    /// Returns the row where it landed, or None if column is full.
    pub fn drop_piece(&mut self, column: u8, player: MultiplayerPlayer) -> Option<u8> {
        if column >= 7 {
            return None;
        }
        // Find the lowest empty row in this column
        for row in 0..6u8 {
            let idx = (row as usize) * 7 + (column as usize);
            if self.cells[idx].player.is_none() {
                self.cells[idx].player = Some(player);
                return Some(row);
            }
        }
        None // Column is full
    }

    /// Check if there's a winner.
    pub fn check_winner(&self) -> Option<MultiplayerPlayer> {
        // Check all possible 4-in-a-row combinations
        for row in 0..6i32 {
            for col in 0..7i32 {
                if let Some(player) = self.get_cell(row, col) {
                    // Horizontal
                    if col <= 3 && self.check_line(row, col, 0, 1, player) {
                        return Some(player);
                    }
                    // Vertical
                    if row <= 2 && self.check_line(row, col, 1, 0, player) {
                        return Some(player);
                    }
                    // Diagonal up-right
                    if row <= 2 && col <= 3 && self.check_line(row, col, 1, 1, player) {
                        return Some(player);
                    }
                    // Diagonal down-right
                    if row >= 3 && col <= 3 && self.check_line(row, col, -1, 1, player) {
                        return Some(player);
                    }
                }
            }
        }
        None
    }

    fn get_cell(&self, row: i32, col: i32) -> Option<MultiplayerPlayer> {
        if row < 0 || row >= 6 || col < 0 || col >= 7 {
            return None;
        }
        self.cells[(row as usize) * 7 + (col as usize)].player
    }

    fn check_line(&self, row: i32, col: i32, dr: i32, dc: i32, player: MultiplayerPlayer) -> bool {
        for i in 0..4 {
            if self.get_cell(row + dr * i, col + dc * i) != Some(player) {
                return false;
            }
        }
        true
    }

    /// Check if the board is full.
    pub fn is_full(&self) -> bool {
        // Only need to check top row
        (0..7).all(|col| self.cells[5 * 7 + col].player.is_some())
    }
}

/// Quick Math game state.
#[derive(Clone, Debug, Default, Serialize, Deserialize, SimpleObject, InputObject)]
#[graphql(input_name = "QuickMathStateInput")]
pub struct QuickMathState {
    /// Current round (1-10).
    pub round: u8,
    /// Total rounds to play.
    pub total_rounds: u8,
    /// Current math problem as string (e.g., "7 + 5").
    pub current_problem: String,
    /// Correct answer for current problem.
    pub correct_answer: i32,
    /// Scores for each player [player1, player2].
    pub scores: [u8; 2],
    /// Who answered current round (None if pending).
    pub round_winner: Option<MultiplayerPlayer>,
    /// Seed for deterministic problem generation
    pub seed: u64,
}

impl QuickMathState {
    /// Create a new Quick Math game with initial problem.
    pub fn new(total_rounds: u8, seed: u64) -> Self {
        let mut state = Self {
            round: 0,
            total_rounds,
            current_problem: String::new(),
            correct_answer: 0,
            scores: [0, 0],
            round_winner: None,
            seed,
        };
        // Generate first problem immediately
        state.generate_next_problem();
        state
    }

    /// Generate the next problem deterministically using the seed.
    pub fn generate_next_problem(&mut self) {
        // Simple LCG for deterministic random numbers
        self.seed = self.seed.wrapping_mul(1103515245).wrapping_add(12345);
        let rand1 = ((self.seed >> 16) % 20) as i32 + 1; // 1-20
        
        self.seed = self.seed.wrapping_mul(1103515245).wrapping_add(12345);
        let rand2 = ((self.seed >> 16) % 20) as i32 + 1; // 1-20
        
        self.seed = self.seed.wrapping_mul(1103515245).wrapping_add(12345);
        let op_type = (self.seed >> 16) % 4;
        
        let (problem, answer) = match op_type {
            0 => (format!("{} + {}", rand1, rand2), rand1 + rand2),
            1 => {
                // Ensure subtraction doesn't go negative
                let (a, b) = if rand1 >= rand2 { (rand1, rand2) } else { (rand2, rand1) };
                (format!("{} - {}", a, b), a - b)
            },
            2 => {
                // Smaller numbers for multiplication
                let a = (rand1 % 12) + 1;
                let b = (rand2 % 12) + 1;
                (format!("{} × {}", a, b), a * b)
            },
            _ => {
                // Division with clean results
                let divisor = (rand2 % 10) + 1;
                let quotient = (rand1 % 10) + 1;
                let dividend = divisor * quotient;
                (format!("{} ÷ {}", dividend, divisor), quotient)
            }
        };
        
        self.round += 1;
        self.current_problem = problem;
        self.correct_answer = answer;
        self.round_winner = None;
    }

    /// Submit an answer. Returns (is_correct, round_complete, game_finished).
    pub fn submit_answer(&mut self, player: MultiplayerPlayer, answer: i32) -> (bool, bool, bool) {
        if self.round_winner.is_some() {
            return (false, false, false); // Round already answered
        }
        
        let is_correct = answer == self.correct_answer;
        if is_correct {
            self.scores[player.index()] += 1;
            self.round_winner = Some(player);
            
            // Check if game finished
            if self.round >= self.total_rounds {
                return (true, true, true);
            }
            
            // Generate next problem
            self.generate_next_problem();
            return (true, true, false);
        }
        
        (false, false, false)
    }

    /// Check if game is finished.
    pub fn is_finished(&self) -> bool {
        self.round >= self.total_rounds && self.round_winner.is_some()
    }

    /// Get the winner (player with higher score).
    pub fn get_winner(&self) -> Option<MultiplayerPlayer> {
        if !self.is_finished() {
            return None;
        }
        if self.scores[0] > self.scores[1] {
            Some(MultiplayerPlayer::One)
        } else if self.scores[1] > self.scores[0] {
            Some(MultiplayerPlayer::Two)
        } else {
            None // Draw
        }
    }
}

/// Union type for different game boards.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum GameBoard {
    TicTacToe(TicTacToeBoard),
    ConnectFour(ConnectFourBoard),
    Chess(ChessBoard),
    Checkers(CheckersBoard),
    QuickMath(QuickMathState),
}

/// Chess board with full on-chain state management.
#[derive(Clone, Debug, Default, Serialize, Deserialize, SimpleObject, InputObject)]
#[graphql(input_name = "ChessBoardInput")]
pub struct ChessBoard {
    /// Board state as 64 squares (a8=0, h1=63).
    /// Each square: " "=empty, "P"/"p"=pawn, "R"/"r"=rook, "N"/"n"=knight, 
    /// "B"/"b"=bishop, "Q"/"q"=queen, "K"/"k"=king
    /// Uppercase = white, lowercase = black
    /// NOTE: Using Vec<String> for proper JSON serialization (char doesn't serialize well)
    pub board: Vec<String>,
    /// Whose turn: true = white, false = black
    pub white_turn: bool,
    /// Castling rights: [white_kingside, white_queenside, black_kingside, black_queenside]
    pub castling: [bool; 4],
    /// En passant target square (-1 if none)
    pub en_passant: i8,
    /// Halfmove clock (for 50-move rule)
    pub halfmove: u16,
    /// Fullmove number
    pub fullmove: u16,
    /// Move history in UCI notation (e2e4 format).
    pub moves: Vec<String>,
    /// FEN notation for board state (computed from board array).
    pub fen: String,
}

impl ChessBoard {
    /// Create starting position.
    pub fn new() -> Self {
        let board: Vec<String> = vec![
            "r".to_string(), "n".to_string(), "b".to_string(), "q".to_string(), "k".to_string(), "b".to_string(), "n".to_string(), "r".to_string(),  // rank 8 (black)
            "p".to_string(), "p".to_string(), "p".to_string(), "p".to_string(), "p".to_string(), "p".to_string(), "p".to_string(), "p".to_string(),  // rank 7
            " ".to_string(), " ".to_string(), " ".to_string(), " ".to_string(), " ".to_string(), " ".to_string(), " ".to_string(), " ".to_string(),  // rank 6
            " ".to_string(), " ".to_string(), " ".to_string(), " ".to_string(), " ".to_string(), " ".to_string(), " ".to_string(), " ".to_string(),  // rank 5
            " ".to_string(), " ".to_string(), " ".to_string(), " ".to_string(), " ".to_string(), " ".to_string(), " ".to_string(), " ".to_string(),  // rank 4
            " ".to_string(), " ".to_string(), " ".to_string(), " ".to_string(), " ".to_string(), " ".to_string(), " ".to_string(), " ".to_string(),  // rank 3
            "P".to_string(), "P".to_string(), "P".to_string(), "P".to_string(), "P".to_string(), "P".to_string(), "P".to_string(), "P".to_string(),  // rank 2 (white)
            "R".to_string(), "N".to_string(), "B".to_string(), "Q".to_string(), "K".to_string(), "B".to_string(), "N".to_string(), "R".to_string(),  // rank 1
        ];
        let mut chess = Self {
            board,
            white_turn: true,
            castling: [true, true, true, true],
            en_passant: -1,
            halfmove: 0,
            fullmove: 1,
            moves: Vec::new(),
            fen: String::new(),
        };
        chess.update_fen();
        chess
    }

    /// Convert square name (e.g., "e2") to index.
    fn square_to_index(sq: &str) -> Option<usize> {
        if sq.len() < 2 { return None; }
        let file = sq.chars().next()? as i32 - 'a' as i32;
        let rank = sq.chars().nth(1)?.to_digit(10)? as i32;
        if file < 0 || file > 7 || rank < 1 || rank > 8 { return None; }
        Some(((8 - rank) * 8 + file) as usize)
    }

    /// Get piece char from board string
    fn get_piece(&self, idx: usize) -> char {
        self.board.get(idx).and_then(|s| s.chars().next()).unwrap_or(' ')
    }

    /// Set piece on board
    fn set_piece(&mut self, idx: usize, piece: char) {
        if idx < 64 {
            self.board[idx] = piece.to_string();
        }
    }

    /// Update FEN string from board state.
    pub fn update_fen(&mut self) {
        let mut fen = String::new();
        
        // Board position
        for rank in 0..8 {
            let mut empty = 0;
            for file in 0..8 {
                let piece = self.get_piece(rank * 8 + file);
                if piece == ' ' {
                    empty += 1;
                } else {
                    if empty > 0 {
                        fen.push_str(&empty.to_string());
                        empty = 0;
                    }
                    fen.push(piece);
                }
            }
            if empty > 0 {
                fen.push_str(&empty.to_string());
            }
            if rank < 7 {
                fen.push('/');
            }
        }
        
        // Active color
        fen.push(' ');
        fen.push(if self.white_turn { 'w' } else { 'b' });
        
        // Castling
        fen.push(' ');
        let mut castle = String::new();
        if self.castling[0] { castle.push('K'); }
        if self.castling[1] { castle.push('Q'); }
        if self.castling[2] { castle.push('k'); }
        if self.castling[3] { castle.push('q'); }
        if castle.is_empty() { castle.push('-'); }
        fen.push_str(&castle);
        
        // En passant
        fen.push(' ');
        if self.en_passant >= 0 && self.en_passant < 64 {
            let file = (self.en_passant % 8) as u8 + b'a';
            let rank = (8 - self.en_passant / 8) as u8 + b'0';
            fen.push(file as char);
            fen.push(rank as char);
        } else {
            fen.push('-');
        }
        
        // Halfmove and fullmove
        fen.push_str(&format!(" {} {}", self.halfmove, self.fullmove));
        
        self.fen = fen;
    }

    /// Make a move in UCI format (e.g., "e2e4", "e7e8q" for promotion).
    /// Returns true if move was valid and executed.
    pub fn make_move(&mut self, uci_move: &str, is_white: bool) -> bool {
        // Verify it's the correct player's turn
        if is_white != self.white_turn {
            return false;
        }

        if uci_move.len() < 4 {
            return false;
        }

        let from = &uci_move[0..2];
        let to = &uci_move[2..4];
        let promotion = if uci_move.len() > 4 { uci_move.chars().nth(4) } else { None };

        let from_idx = match Self::square_to_index(from) {
            Some(i) => i,
            None => return false,
        };
        let to_idx = match Self::square_to_index(to) {
            Some(i) => i,
            None => return false,
        };

        let piece = self.get_piece(from_idx);
        let target = self.get_piece(to_idx);

        // Basic validation: must move own piece
        let is_white_piece = piece.is_uppercase();
        if piece == ' ' || is_white_piece != is_white {
            return false;
        }

        // Cannot capture own piece
        if target != ' ' && target.is_uppercase() == is_white {
            return false;
        }

        // Execute the move
        self.set_piece(from_idx, ' ');
        
        // Handle pawn promotion
        if let Some(promo_char) = promotion {
            let promo_piece = if is_white { promo_char.to_uppercase().next().unwrap_or('Q') } 
                              else { promo_char.to_lowercase().next().unwrap_or('q') };
            self.set_piece(to_idx, promo_piece);
        } else {
            self.set_piece(to_idx, piece);
        }

        // Handle castling
        if piece == 'K' || piece == 'k' {
            let from_file = from_idx % 8;
            let to_file = to_idx % 8;
            
            // Kingside castling
            if from_file == 4 && to_file == 6 {
                let rook_from = from_idx + 3;
                let rook_to = from_idx + 1;
                let rook = self.get_piece(rook_from);
                self.set_piece(rook_to, rook);
                self.set_piece(rook_from, ' ');
            }
            // Queenside castling
            if from_file == 4 && to_file == 2 {
                let rook_from = from_idx - 4;
                let rook_to = from_idx - 1;
                let rook = self.get_piece(rook_from);
                self.set_piece(rook_to, rook);
                self.set_piece(rook_from, ' ');
            }
            
            // Remove castling rights for this side
            if is_white {
                self.castling[0] = false;
                self.castling[1] = false;
            } else {
                self.castling[2] = false;
                self.castling[3] = false;
            }
        }

        // Handle rook moves affecting castling
        if piece == 'R' {
            if from_idx == 63 { self.castling[0] = false; } // h1
            if from_idx == 56 { self.castling[1] = false; } // a1
        }
        if piece == 'r' {
            if from_idx == 7 { self.castling[2] = false; } // h8
            if from_idx == 0 { self.castling[3] = false; } // a8
        }

        // Handle en passant capture
        if (piece == 'P' || piece == 'p') && to_idx as i8 == self.en_passant {
            let captured_pawn_idx = if is_white { to_idx + 8 } else { to_idx - 8 };
            self.set_piece(captured_pawn_idx, ' ');
        }

        // Update en passant target
        self.en_passant = -1;
        if piece == 'P' && from_idx / 8 == 6 && to_idx / 8 == 4 {
            self.en_passant = (to_idx + 8) as i8;
        }
        if piece == 'p' && from_idx / 8 == 1 && to_idx / 8 == 3 {
            self.en_passant = (to_idx - 8) as i8;
        }

        // Update halfmove clock
        if piece == 'P' || piece == 'p' || target != ' ' {
            self.halfmove = 0;
        } else {
            self.halfmove += 1;
        }

        // Update fullmove number
        if !is_white {
            self.fullmove += 1;
        }

        // Switch turns
        self.white_turn = !self.white_turn;

        // Record move and update FEN
        self.moves.push(uci_move.to_string());
        self.update_fen();

        true
    }
}
#[derive(Clone, Debug, Default, Serialize, Deserialize, SimpleObject, InputObject)]
#[graphql(input_name = "CheckersBoardInput")]
pub struct CheckersBoard {
    /// Board state as array of 32 squares (dark squares only).
    /// 0 = empty, 1 = player1 (red), 2 = player2 (black), 3 = player1 king, 4 = player2 king
    pub squares: Vec<u8>,
    /// Move history in "from-to" format (e.g., "20-16").
    pub moves: Vec<String>,
}

impl CheckersBoard {
    /// Create starting position.
    pub fn new() -> Self {
        let mut squares = vec![0u8; 32];
        // Player 2 (Black) pieces at top (indices 0-11)
        for i in 0..12 {
            squares[i] = 2;
        }
        // Player 1 (Red) pieces at bottom (indices 20-31)
        for i in 20..32 {
            squares[i] = 1;
        }
        Self {
            squares,
            moves: Vec::new(),
        }
    }

    /// Check if a piece belongs to a player.
    fn is_player_piece(&self, idx: usize, is_player_one: bool) -> bool {
        if idx >= 32 { return false; }
        let piece = self.squares[idx];
        if is_player_one {
            piece == 1 || piece == 3
        } else {
            piece == 2 || piece == 4
        }
    }

    /// Check if a piece is a king.
    fn is_king(&self, idx: usize) -> bool {
        if idx >= 32 { return false; }
        self.squares[idx] == 3 || self.squares[idx] == 4
    }

    /// Get adjacent squares for a given position.
    fn get_adjacent(&self, idx: usize, is_forward: bool) -> Vec<usize> {
        let row = idx / 4;
        let col_offset = if row % 2 == 0 { 0 } else { 1 };
        let mut adj = Vec::new();
        
        if is_forward {
            // Moving "up" (decreasing row for player 1, increasing for player 2)
            if row > 0 {
                let left = idx - 4 - (1 - col_offset);
                let right = idx - 4 + col_offset;
                if left < 32 && (left / 4) == row - 1 { adj.push(left); }
                if right < 32 && (right / 4) == row - 1 { adj.push(right); }
            }
        } else {
            // Moving "down"
            if row < 7 {
                let left = idx + 4 - (1 - col_offset);
                let right = idx + 4 + col_offset;
                if left < 32 && (left / 4) == row + 1 { adj.push(left); }
                if right < 32 && (right / 4) == row + 1 { adj.push(right); }
            }
        }
        
        adj
    }

    /// Make a move. Format: "from-to" (e.g., "20-16").
    /// Returns true if move was valid and executed.
    pub fn make_move(&mut self, move_str: &str, is_player_one: bool) -> bool {
        let parts: Vec<&str> = move_str.split('-').collect();
        if parts.len() < 2 { return false; }
        
        let from: usize = match parts[0].parse() {
            Ok(n) if n < 32 => n,
            _ => return false,
        };
        let to: usize = match parts[1].parse() {
            Ok(n) if n < 32 => n,
            _ => return false,
        };
        
        // Verify piece belongs to player
        if !self.is_player_piece(from, is_player_one) {
            return false;
        }
        
        // Verify destination is empty
        if self.squares[to] != 0 {
            return false;
        }
        
        let piece = self.squares[from];
        let is_king = self.is_king(from);
        let from_row = from / 4;
        let to_row = to / 4;
        let row_diff = (to_row as i32 - from_row as i32).abs();
        
        // Normal move (1 row)
        if row_diff == 1 {
            // Validate direction for non-kings
            if !is_king {
                if is_player_one && to_row >= from_row { return false; } // Red moves up
                if !is_player_one && to_row <= from_row { return false; } // Black moves down
            }
            
            // Execute move
            self.squares[from] = 0;
            self.squares[to] = piece;
        }
        // Jump move (2 rows)
        else if row_diff == 2 {
            // Calculate jumped square
            let mid_row = (from_row + to_row) / 2;
            let from_col = from % 4;
            let to_col = to % 4;
            
            // Calculate middle square index
            let mid_col = if from_row % 2 == 0 {
                if to_col > from_col { from_col } else { from_col.saturating_sub(1) }
            } else {
                if to_col >= from_col { from_col + 1 } else { from_col }
            };
            
            // Adjust for the checkers board indexing
            let _mid_idx = if mid_row % 2 == 0 {
                mid_row * 4 + mid_col.min(3)
            } else {
                mid_row * 4 + mid_col.min(3)
            };
            
            // Simplified middle calculation
            let mid_idx = mid_row * 4 + ((from % 4 + to % 4 + if from_row % 2 == 0 { 1 } else { 0 }) / 2).min(3);
            
            if mid_idx >= 32 { return false; }
            
            // Must jump opponent piece
            if self.is_player_piece(mid_idx, is_player_one) || self.squares[mid_idx] == 0 {
                return false;
            }
            
            // Validate direction for non-kings
            if !is_king {
                if is_player_one && to_row >= from_row { return false; }
                if !is_player_one && to_row <= from_row { return false; }
            }
            
            // Execute jump
            self.squares[from] = 0;
            self.squares[mid_idx] = 0; // Remove captured piece
            self.squares[to] = piece;
        } else {
            return false;
        }
        
        // King promotion
        if is_player_one && to_row == 0 && self.squares[to] == 1 {
            self.squares[to] = 3;
        }
        if !is_player_one && to_row == 7 && self.squares[to] == 2 {
            self.squares[to] = 4;
        }
        
        // Record move
        self.moves.push(move_str.to_string());
        
        true
    }

    /// Count pieces for each player. Returns (player1_count, player2_count).
    pub fn count_pieces(&self) -> (u8, u8) {
        let mut p1 = 0u8;
        let mut p2 = 0u8;
        for &sq in &self.squares {
            if sq == 1 || sq == 3 { p1 += 1; }
            if sq == 2 || sq == 4 { p2 += 1; }
        }
        (p1, p2)
    }

    /// Check for winner. Returns Some(player) if a player has no pieces.
    pub fn check_winner(&self) -> Option<MultiplayerPlayer> {
        let (p1, p2) = self.count_pieces();
        if p1 == 0 { return Some(MultiplayerPlayer::Two); }
        if p2 == 0 { return Some(MultiplayerPlayer::One); }
        None
    }
}

/// Move data for different game types.
#[derive(Clone, Debug, Serialize, Deserialize, SimpleObject, InputObject)]
#[graphql(input_name = "MoveDataInput")]
pub struct MoveData {
    /// For TicTacToe: position 0-8.
    /// For ConnectFour: column 0-6.
    /// For QuickMath: the answer.
    pub primary: i32,
    /// For Chess/Checkers: target position or full move string.
    pub secondary: Option<String>,
}

/// Multiplayer room configuration.
#[derive(Clone, Debug, Serialize, Deserialize, SimpleObject, InputObject)]
#[graphql(input_name = "MultiplayerRoomConfigInput")]
pub struct MultiplayerRoomConfig {
    pub game_type: MultiplayerGameType,
    /// Move timeout in seconds.
    pub move_timeout_secs: u64,
    /// For QuickMath: number of rounds.
    pub rounds: Option<u8>,
}

/// State of a multiplayer game room (stored on HOST's chain).
/// Share your host_chain_id with opponents so they can join.
#[derive(Clone, Debug, Serialize, Deserialize, SimpleObject)]
pub struct MultiplayerGameRoom {
    /// The HOST's chain ID (share this with opponents to join).
    pub host_chain_id: String,
    /// The game type.
    pub game_type: MultiplayerGameType,
    /// Chain IDs of both players [host_chain, joiner_chain].
    pub player_chain_ids: [String; 2],
    /// The two players (wallet addresses).
    pub players: [AccountOwner; 2],
    /// Player usernames.
    pub usernames: [String; 2],
    /// Whose turn it is.
    pub current_turn: MultiplayerPlayer,
    /// Game status.
    pub status: MultiplayerGameStatus,
    /// The winner, if any.
    pub winner: Option<MultiplayerPlayer>,
    /// When the room was created (microseconds).
    pub created_at: u64,
    /// When the last move was made (microseconds).
    pub last_move_at: u64,
    /// Move timeout in seconds.
    pub move_timeout_secs: u64,
    /// TicTacToe board (if applicable).
    pub tic_tac_toe_board: Option<TicTacToeBoard>,
    /// ConnectFour board (if applicable).
    pub connect_four_board: Option<ConnectFourBoard>,
    /// QuickMath state (if applicable).
    pub quick_math_state: Option<QuickMathState>,
    /// Chess board (if applicable).
    pub chess_board: Option<ChessBoard>,
    /// Checkers board (if applicable).
    pub checkers_board: Option<CheckersBoard>,
}

impl MultiplayerGameRoom {
    /// Create a new room waiting for players (on HOST's chain).
    pub fn new_waiting(
        host_chain_id: String,
        game_type: MultiplayerGameType,
        host: AccountOwner,
        host_username: String,
        created_at: u64,
    ) -> Self {
        let move_timeout_secs = game_type.default_timeout_secs();

        Self {
            host_chain_id: host_chain_id.clone(),
            game_type,
            player_chain_ids: [host_chain_id, String::new()], // Second slot filled when opponent joins
            players: [host.clone(), host.clone()], // Second slot filled when opponent joins
            usernames: [host_username, String::new()],
            current_turn: MultiplayerPlayer::One,
            status: MultiplayerGameStatus::WaitingForPlayer,
            winner: None,
            created_at,
            last_move_at: created_at,
            move_timeout_secs,
            tic_tac_toe_board: None,
            connect_four_board: None,
            quick_math_state: None,
            chess_board: None,
            checkers_board: None,
        }
    }

    /// Initialize game boards when both players have joined.
    pub fn initialize_game(&mut self, timestamp: u64) {
        self.status = MultiplayerGameStatus::InProgress;
        self.last_move_at = timestamp;

        match self.game_type {
            MultiplayerGameType::TicTacToe => {
                self.tic_tac_toe_board = Some(TicTacToeBoard::default());
            }
            MultiplayerGameType::ConnectFour => {
                self.connect_four_board = Some(ConnectFourBoard::default());
            }
            MultiplayerGameType::Chess => {
                self.chess_board = Some(ChessBoard::new());
            }
            MultiplayerGameType::Checkers => {
                self.checkers_board = Some(CheckersBoard::new());
            }
            MultiplayerGameType::QuickMath => {
                // Use timestamp as seed for deterministic problem generation
                self.quick_math_state = Some(QuickMathState::new(10, timestamp));
            }
        }
    }

    /// Check if the current player has timed out.
    pub fn is_timed_out(&self, current_time: u64) -> bool {
        if self.status != MultiplayerGameStatus::InProgress {
            return false;
        }
        let timeout_micros = self.move_timeout_secs * 1_000_000;
        current_time > self.last_move_at + timeout_micros
    }
}

/// Calculate level from total XP.
/// Uses normalized XP for level calculation.
pub fn calculate_level(total_xp: u64) -> u32 {
    // Level formula: level = sqrt(xp / 100) + 1
    // Each level requires progressively more XP
    ((total_xp as f64 / 100.0).sqrt() as u32).saturating_add(1)
}

/// Calculate level from raw XP with normalization.
/// normalization_factor divides raw XP to control displayed values.
pub fn calculate_level_normalized(raw_xp: u64, normalization_factor: u64) -> u32 {
    let normalized_xp = raw_xp / normalization_factor.max(1);
    calculate_level(normalized_xp)
}

// =============================================================================
// ARCADE EVENTS - Event-Sourced Model for Cross-Chain Messaging
// =============================================================================

/// Events emitted by the Arcade Hub contract.
/// These are stored on-chain and power activity feeds, leaderboards, and auditing.
#[derive(Clone, Debug, Serialize, Deserialize, SimpleObject)]
pub struct ArcadeEvent {
    /// Unique event ID
    pub id: u64,
    /// Timestamp when the event occurred (microseconds)
    pub timestamp: u64,
    /// The type of event
    pub event_type: ArcadeEventType,
}

/// Types of events in the Arcade Hub
#[derive(Clone, Debug, Serialize, Deserialize, async_graphql::Enum, PartialEq, Eq, Copy)]
pub enum ArcadeEventType {
    /// A game was played and score submitted
    GamePlayed,
    /// Player registered
    PlayerRegistered,
    /// XP was synced from another chain
    XpSynced,
    /// Prediction was placed
    PredictionPlaced,
    /// Prediction was resolved
    PredictionResolved,
    /// Daily bonus claimed
    DailyBonusClaimed,
    /// Multiplayer result submitted
    MultiplayerResult,
}

/// Detailed event data for GamePlayed events
#[derive(Clone, Debug, Serialize, Deserialize, SimpleObject, InputObject)]
#[graphql(input_name = "GamePlayedEventInput")]
pub struct GamePlayedEvent {
    pub player: AccountOwner,
    pub username: String,
    pub game_type: GameType,
    pub score: u64,
    pub xp_earned: u64,
    pub timestamp: u64,
}

/// A registered player in the arcade.
#[derive(Clone, Debug, Serialize, Deserialize, SimpleObject, InputObject)]
#[graphql(input_name = "PlayerInput")]
pub struct Player {
    pub owner: AccountOwner,
    pub username: String,
    pub total_xp: u64,
    pub level: u32,
    pub games_played: u64,
    pub registered_at: u64,
    /// Arcade coins balance (Token Economy)
    pub coins: u64,
    /// Last daily bonus claim timestamp (microseconds)
    pub last_daily_claim: u64,
    /// Total predictions made
    pub predictions_made: u64,
    /// Predictions won
    pub predictions_won: u64,
}

impl Player {
    /// Create a new player with default values.
    pub fn new(owner: AccountOwner, username: String, timestamp: u64) -> Self {
        Self {
            owner,
            username,
            total_xp: 0,
            level: 1,
            games_played: 0,
            registered_at: timestamp,
            coins: 100, // Starting bonus of 100 coins
            last_daily_claim: 0,
            predictions_made: 0,
            predictions_won: 0,
        }
    }

    /// Add XP to the player and update level.
    pub fn add_xp(&mut self, xp: u64) {
        self.total_xp = self.total_xp.saturating_add(xp);
        self.level = calculate_level(self.total_xp);
    }

    /// Increment games played counter and award coins.
    pub fn increment_games(&mut self, xp_earned: u64) {
        self.games_played = self.games_played.saturating_add(1);
        // Award coins: 1 coin per 10 XP earned
        let coins_earned = xp_earned / 10;
        self.coins = self.coins.saturating_add(coins_earned);
    }

    /// Claim daily bonus (100 coins). Returns true if successful.
    pub fn claim_daily_bonus(&mut self, current_time: u64) -> bool {
        // 24 hours in microseconds
        const DAY_MICROS: u64 = 24 * 60 * 60 * 1_000_000;
        
        if current_time >= self.last_daily_claim + DAY_MICROS {
            self.coins = self.coins.saturating_add(100);
            self.last_daily_claim = current_time;
            true
        } else {
            false
        }
    }

    /// Spend coins for prediction. Returns true if sufficient balance.
    pub fn spend_coins(&mut self, amount: u64) -> bool {
        if self.coins >= amount {
            self.coins = self.coins.saturating_sub(amount);
            true
        } else {
            false
        }
    }

    /// Award coins for winning prediction.
    pub fn award_coins(&mut self, amount: u64) {
        self.coins = self.coins.saturating_add(amount);
    }

    /// Record prediction outcome.
    pub fn record_prediction(&mut self, won: bool) {
        self.predictions_made = self.predictions_made.saturating_add(1);
        if won {
            self.predictions_won = self.predictions_won.saturating_add(1);
        }
    }
}

/// A leaderboard entry for global rankings.
#[derive(Clone, Debug, Serialize, Deserialize, SimpleObject, InputObject)]
#[graphql(input_name = "LeaderboardEntryInput")]
pub struct LeaderboardEntry {
    pub wallet_address: AccountOwner,
    pub username: String,
    pub total_xp: u64,
    pub level: u32,
    pub rank: u32,
}

impl LeaderboardEntry {
    /// Create a new leaderboard entry from a player.
    pub fn from_player(player: &Player, rank: u32) -> Self {
        Self {
            wallet_address: player.owner.clone(),
            username: player.username.clone(),
            total_xp: player.total_xp,
            level: player.level,
            rank,
        }
    }
}

/// A recorded game score.
#[derive(Clone, Debug, Serialize, Deserialize, SimpleObject, InputObject)]
#[graphql(input_name = "GameScoreInput")]
pub struct GameScore {
    pub id: u64,
    pub game_type: GameType,
    pub player: AccountOwner,
    pub score: u64,
    pub xp_earned: u64,
    pub bonus_data: Option<u64>,
    pub timestamp: u64,
}

/// A high score entry for a specific game.
#[derive(Clone, Debug, Serialize, Deserialize, SimpleObject)]
pub struct GameHighScoreEntry {
    pub player: AccountOwner,
    pub username: String,
    pub score: u64,
    pub xp_earned: u64,
    pub timestamp: u64,
}

/// Arcade statistics.
#[derive(Clone, Debug, Default, Serialize, Deserialize, SimpleObject)]
pub struct ArcadeStats {
    pub total_players: u64,
    pub total_games_played: u64,
    pub total_xp_earned: u64,
    pub total_predictions: u64,
    pub total_coins_wagered: u64,
}

// ============================================================================
// PREDICTION MARKET TYPES
// ============================================================================

/// Crypto asset types for price predictions.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash, Serialize, Deserialize, async_graphql::Enum)]
pub enum CryptoAsset {
    BTC,
    ETH,
}

impl CryptoAsset {
    pub fn name(&self) -> &'static str {
        match self {
            CryptoAsset::BTC => "Bitcoin",
            CryptoAsset::ETH => "Ethereum",
        }
    }

    pub fn symbol(&self) -> &'static str {
        match self {
            CryptoAsset::BTC => "BTC",
            CryptoAsset::ETH => "ETH",
        }
    }
}

/// Direction for crypto price predictions.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash, Serialize, Deserialize, async_graphql::Enum)]
pub enum PredictionDirection {
    Up,
    Down,
}

/// Status of a prediction round or event.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash, Serialize, Deserialize, async_graphql::Enum)]
pub enum PredictionStatus {
    /// Round/Event is active and accepting bets
    Active,
    /// Round/Event is locked, waiting for resolution
    Locked,
    /// Round/Event has been resolved
    Resolved,
    /// Round/Event was cancelled (refunds issued)
    Cancelled,
}

/// A crypto price prediction round.
#[derive(Clone, Debug, Serialize, Deserialize, SimpleObject, InputObject)]
#[graphql(input_name = "CryptoRoundInput")]
pub struct CryptoRound {
    pub id: u64,
    pub asset: CryptoAsset,
    /// Start price in cents (e.g., 9500000 = $95,000.00)
    pub start_price: u64,
    /// End price (filled when resolved)
    pub end_price: Option<u64>,
    /// Round start time (microseconds)
    pub start_time: u64,
    /// Duration in seconds (e.g., 300 = 5 minutes)
    pub duration_secs: u64,
    /// Round status
    pub status: PredictionStatus,
    /// Total coins bet on UP
    pub total_up: u64,
    /// Total coins bet on DOWN
    pub total_down: u64,
    /// Winning direction (filled when resolved)
    pub winning_direction: Option<PredictionDirection>,
}

impl CryptoRound {
    pub fn new(id: u64, asset: CryptoAsset, start_price: u64, start_time: u64, duration_secs: u64) -> Self {
        Self {
            id,
            asset,
            start_price,
            end_price: None,
            start_time,
            duration_secs,
            status: PredictionStatus::Active,
            total_up: 0,
            total_down: 0,
            winning_direction: None,
        }
    }

    /// Check if round is still accepting bets (active and not past lock time)
    pub fn is_accepting_bets(&self, current_time: u64) -> bool {
        if self.status != PredictionStatus::Active {
            return false;
        }
        // Lock betting 30 seconds before end
        let lock_time = self.start_time + (self.duration_secs.saturating_sub(30)) * 1_000_000;
        current_time < lock_time
    }

    /// Calculate end time
    pub fn end_time(&self) -> u64 {
        self.start_time + self.duration_secs * 1_000_000
    }

    /// Calculate odds multiplier for a direction (in basis points, 10000 = 1.0x)
    pub fn calculate_odds(&self, direction: PredictionDirection) -> u64 {
        let total = self.total_up + self.total_down;
        if total == 0 {
            return 19000; // 1.9x default odds
        }

        let pool_for_direction = match direction {
            PredictionDirection::Up => self.total_up,
            PredictionDirection::Down => self.total_down,
        };

        if pool_for_direction == 0 {
            return 50000; // 5.0x max odds if nobody bet this direction
        }

        // Odds = (total pool * 0.95) / pool_for_direction (5% house edge)
        // Returns in basis points (multiply by 10000)
        let payout_pool = total * 9500 / 10000; // 95% of total
        (payout_pool * 10000) / pool_for_direction
    }
}

/// A world/crypto news event for prediction.
#[derive(Clone, Debug, Serialize, Deserialize, SimpleObject, InputObject)]
#[graphql(input_name = "WorldEventInput")]
pub struct WorldEvent {
    pub id: u64,
    /// Event title (e.g., "Will BTC reach $100K by Jan 15?")
    pub title: String,
    /// Detailed description
    pub description: String,
    /// Category for organization
    pub category: String,
    /// Event end time (when betting closes, microseconds)
    pub end_time: u64,
    /// When the event was created
    pub created_at: u64,
    /// Event status
    pub status: PredictionStatus,
    /// Outcome: None = pending, true = YES won, false = NO won
    pub outcome: Option<bool>,
    /// Total coins bet on YES
    pub total_yes: u64,
    /// Total coins bet on NO
    pub total_no: u64,
}

impl WorldEvent {
    pub fn new(id: u64, title: String, description: String, category: String, end_time: u64, created_at: u64) -> Self {
        Self {
            id,
            title,
            description,
            category,
            end_time,
            created_at,
            status: PredictionStatus::Active,
            outcome: None,
            total_yes: 0,
            total_no: 0,
        }
    }

    /// Check if event is accepting bets
    pub fn is_accepting_bets(&self, current_time: u64) -> bool {
        self.status == PredictionStatus::Active && current_time < self.end_time
    }

    /// Calculate odds for YES (in basis points)
    pub fn calculate_yes_odds(&self) -> u64 {
        let total = self.total_yes + self.total_no;
        if total == 0 || self.total_yes == 0 {
            return 19000; // 1.9x default
        }
        let payout_pool = total * 9500 / 10000;
        (payout_pool * 10000) / self.total_yes
    }

    /// Calculate odds for NO (in basis points)
    pub fn calculate_no_odds(&self) -> u64 {
        let total = self.total_yes + self.total_no;
        if total == 0 || self.total_no == 0 {
            return 19000;
        }
        let payout_pool = total * 9500 / 10000;
        (payout_pool * 10000) / self.total_no
    }
}

/// Type of prediction bet.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash, Serialize, Deserialize, async_graphql::Enum)]
pub enum PredictionType {
    /// Crypto price prediction
    Crypto,
    /// World event prediction
    Event,
}

/// A user's prediction bet.
#[derive(Clone, Debug, Serialize, Deserialize, SimpleObject, InputObject)]
#[graphql(input_name = "PredictionInput")]
pub struct Prediction {
    pub id: u64,
    pub user: AccountOwner,
    /// Type of prediction
    pub prediction_type: PredictionType,
    /// Reference ID (round_id for Crypto, event_id for Event)
    pub reference_id: u64,
    /// Direction for crypto (0=Down, 1=Up) or prediction for event (0=No, 1=Yes)
    pub direction_or_outcome: u64,
    /// Amount of coins wagered
    pub amount: u64,
    /// Odds at time of bet (basis points)
    pub odds_at_bet: u64,
    /// Status of this prediction
    pub status: PredictionStatus,
    /// Payout if won (0 if lost/pending)
    pub payout: u64,
    /// When the bet was placed
    pub created_at: u64,
}

impl Prediction {
    pub fn new_crypto(id: u64, user: AccountOwner, round_id: u64, direction: PredictionDirection, amount: u64, odds: u64, created_at: u64) -> Self {
        Self {
            id,
            user,
            prediction_type: PredictionType::Crypto,
            reference_id: round_id,
            direction_or_outcome: match direction {
                PredictionDirection::Up => 1,
                PredictionDirection::Down => 0,
            },
            amount,
            odds_at_bet: odds,
            status: PredictionStatus::Active,
            payout: 0,
            created_at,
        }
    }

    pub fn new_event(id: u64, user: AccountOwner, event_id: u64, prediction: bool, amount: u64, odds: u64, created_at: u64) -> Self {
        Self {
            id,
            user,
            prediction_type: PredictionType::Event,
            reference_id: event_id,
            direction_or_outcome: if prediction { 1 } else { 0 },
            amount,
            odds_at_bet: odds,
            status: PredictionStatus::Active,
            payout: 0,
            created_at,
        }
    }

    /// Get crypto direction if this is a crypto prediction
    pub fn get_crypto_direction(&self) -> Option<PredictionDirection> {
        if self.prediction_type == PredictionType::Crypto {
            Some(if self.direction_or_outcome == 1 {
                PredictionDirection::Up
            } else {
                PredictionDirection::Down
            })
        } else {
            None
        }
    }

    /// Get event prediction if this is an event prediction
    pub fn get_event_prediction(&self) -> Option<bool> {
        if self.prediction_type == PredictionType::Event {
            Some(self.direction_or_outcome == 1)
        } else {
            None
        }
    }

    /// Calculate potential payout based on odds at bet time
    pub fn calculate_payout(&self) -> u64 {
        (self.amount * self.odds_at_bet) / 10000
    }
}

/// Operations that can be executed on the arcade hub.
#[derive(Debug, Clone, Serialize, Deserialize, GraphQLMutationRoot)]
pub enum Operation {
    // ========== EXISTING OPERATIONS (DO NOT MODIFY) ==========
    /// Register a new player with a username.
    RegisterPlayer { username: String },
    /// Submit a game score.
    SubmitScore {
        game_type: GameType,
        score: u64,
        bonus_data: Option<u64>,
    },
    /// Update a player's username.
    UpdateUsername { new_username: String },

    // ========== TOKEN ECONOMY OPERATIONS ==========
    /// Claim daily bonus (100 coins).
    ClaimDailyBonus,

    // ========== CRYPTO PREDICTION OPERATIONS ==========
    /// Create a new crypto prediction round (admin only via backend).
    CreateCryptoRound {
        asset: CryptoAsset,
        start_price: u64,
        duration_secs: u64,
    },
    /// Place a crypto price prediction.
    PlaceCryptoPrediction {
        round_id: u64,
        direction: PredictionDirection,
        amount: u64,
    },
    /// Resolve a crypto round with end price (admin only via backend).
    ResolveCryptoRound {
        round_id: u64,
        end_price: u64,
    },

    // ========== WORLD EVENT PREDICTION OPERATIONS ==========
    /// Create a new world event market (admin only via backend).
    CreateWorldEvent {
        title: String,
        description: String,
        category: String,
        end_time: u64,
    },
    /// Place a world event prediction.
    PlaceEventPrediction {
        event_id: u64,
        prediction: bool, // true = YES, false = NO
        amount: u64,
    },
    /// Resolve a world event (admin only via backend).
    ResolveWorldEvent {
        event_id: u64,
        outcome: bool, // true = YES won, false = NO won
    },

    // ========== ON-CHAIN MULTIPLAYER OPERATIONS (Cross-Chain Pattern) ==========
    /// Create a new multiplayer game room on YOUR chain.
    /// Share your chain ID with opponents to let them join.
    CreateMultiplayerRoom {
        game_type: MultiplayerGameType,
    },

    /// Join an existing multiplayer room by HOST CHAIN ID.
    /// This sends a cross-chain message to the host's chain.
    JoinMultiplayerRoom {
        /// The chain ID of the room host as a string (will be parsed to ChainId).
        host_chain_id: String,
    },

    /// Make a move in a multiplayer game.
    MakeMove {
        /// Move data (position, column, answer, etc. depending on game type).
        move_data: MoveData,
    },

    /// Forfeit the current game.
    ForfeitGame,

    /// Claim victory if opponent has timed out.
    ClaimVictoryTimeout,

    /// Leave the current room (if waiting or game over).
    LeaveRoom,

    /// Force clear/reset room state (for stuck/abandoned rooms).
    ClearRoom,
}

// =============================================================================
// GRAPHQL RESPONSE TYPES - Each response is a separate struct for GraphQL compatibility
// =============================================================================

/// Response for player registration.
#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject)]
pub struct PlayerRegisteredResponse {
    pub success: bool,
    pub message: String,
}

/// Response for score submission - CRITICAL: Contains XP earned from contract.
/// Frontend MUST use this value, NEVER calculate XP locally.
#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject)]
pub struct ScoreSubmittedResponse {
    pub success: bool,
    pub xp_earned: u64,
    pub coins_earned: u64,
    pub total_xp: u64,
    pub level: u32,
}

/// Response for username update.
#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject)]
pub struct UsernameUpdatedResponse {
    pub success: bool,
}

/// Response for errors.
#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject)]
pub struct ErrorResponse {
    pub success: bool,
    pub error: String,
}

/// Response for daily bonus claim.
#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject)]
pub struct DailyBonusResponse {
    pub success: bool,
    pub coins: u64,
}

/// Response for crypto round creation.
#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject)]
pub struct CryptoRoundCreatedResponse {
    pub success: bool,
    pub round_id: u64,
}

/// Response for crypto prediction placement.
#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject)]
pub struct CryptoPredictionResponse {
    pub success: bool,
    pub prediction_id: u64,
    pub odds: u64,
}

/// Response for crypto round resolution.
#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject)]
pub struct CryptoRoundResolvedResponse {
    pub success: bool,
    pub winning_direction: PredictionDirection,
}

/// Response for world event creation.
#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject)]
pub struct WorldEventCreatedResponse {
    pub success: bool,
    pub event_id: u64,
}

/// Response for event prediction placement.
#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject)]
pub struct EventPredictionResponse {
    pub success: bool,
    pub prediction_id: u64,
    pub odds: u64,
}

/// Response for world event resolution.
#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject)]
pub struct WorldEventResolvedResponse {
    pub success: bool,
    pub outcome: bool,
}

/// Response for multiplayer room creation.
#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject)]
pub struct MultiplayerRoomCreatedResponse {
    pub success: bool,
    /// The HOST CHAIN ID to share with opponents.
    pub host_chain_id: String,
    pub game_type: MultiplayerGameType,
}

/// Response for joining a multiplayer room.
#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject)]
pub struct MultiplayerRoomJoinedResponse {
    pub success: bool,
    pub host_chain_id: String,
    pub game_type: MultiplayerGameType,
    pub opponent_username: String,
}

/// Response for making a move.
#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject)]
pub struct MoveMadeResponse {
    pub success: bool,
    /// Whether this move ended the game.
    pub game_ended: bool,
    /// The winner if game ended.
    pub winner: Option<MultiplayerPlayer>,
    /// XP earned if game ended.
    pub xp_earned: Option<u64>,
    /// Coins earned if game ended.
    pub coins_earned: Option<u64>,
}

/// Response for forfeit or timeout victory.
#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject)]
pub struct GameEndedResponse {
    pub success: bool,
    pub winner: Option<MultiplayerPlayer>,
    pub xp_earned: u64,
    pub coins_earned: u64,
}

/// Response from contract operations.
/// Uses Union to expose all variants as GraphQL types.
#[derive(Debug, Clone, Serialize, Deserialize, Union)]
pub enum ArcadeResponse {
    // ========== EXISTING RESPONSES ==========
    /// Player was registered successfully.
    PlayerRegistered(PlayerRegisteredResponse),
    /// Score was submitted successfully with XP earned.
    ScoreSubmitted(ScoreSubmittedResponse),
    /// Username was updated successfully.
    UsernameUpdated(UsernameUpdatedResponse),
    /// Operation failed with an error.
    Error(ErrorResponse),

    // ========== TOKEN ECONOMY RESPONSES ==========
    /// Daily bonus claimed successfully.
    DailyBonusClaimed(DailyBonusResponse),

    // ========== PREDICTION RESPONSES ==========
    /// Crypto round created successfully.
    CryptoRoundCreated(CryptoRoundCreatedResponse),
    /// Crypto prediction placed successfully.
    CryptoPredictionPlaced(CryptoPredictionResponse),
    /// Crypto round resolved.
    CryptoRoundResolved(CryptoRoundResolvedResponse),
    /// World event created successfully.
    WorldEventCreated(WorldEventCreatedResponse),
    /// Event prediction placed successfully.
    EventPredictionPlaced(EventPredictionResponse),
    /// World event resolved.
    WorldEventResolved(WorldEventResolvedResponse),

    // ========== MULTIPLAYER RESPONSES ==========
    /// Multiplayer room created successfully.
    MultiplayerRoomCreated(MultiplayerRoomCreatedResponse),
    /// Joined multiplayer room successfully.
    MultiplayerRoomJoined(MultiplayerRoomJoinedResponse),
    /// Move made successfully.
    MoveMade(MoveMadeResponse),
    /// Game ended (forfeit/timeout).
    GameEnded(GameEndedResponse),
}

/// Messages sent between chains for hub aggregation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Message {
    // ========== EXISTING MESSAGES ==========
    /// Sync a player's data to the hub.
    SyncPlayer(Player),
    /// Sync a game score to the hub.
    SyncScore(GameScore),
    /// Sync an XP update to the hub.
    SyncXpUpdate {
        wallet_address: AccountOwner,
        total_xp: u64,
        level: u32,
        games_played: u64,
        coins: u64,
    },

    // ========== PREDICTION MESSAGES ==========
    /// Sync a crypto round to all chains.
    SyncCryptoRound(CryptoRound),
    /// Sync a world event to all chains.
    SyncWorldEvent(WorldEvent),
    /// Sync a prediction placement.
    SyncPrediction(Prediction),
    /// Sync prediction resolution results.
    SyncPredictionResult {
        prediction_id: u64,
        won: bool,
        payout: u64,
    },

    // ========== MULTIPLAYER CROSS-CHAIN MESSAGES  ==========
    /// Request to join a multiplayer room on the host's chain.
    /// Sent from joiner's chain → host's chain.
    JoinRequest {
        player_chain_id: ChainId,
        player_wallet: AccountOwner,
        player_name: String,
    },
    
    /// Initial game state sync sent from host to joiner after accepting join.
    /// Sent from host's chain → joiner's chain.
    GameStateSync {
        room: MultiplayerGameRoom,
    },
    
    /// Player left the room.
    /// Sent from leaving player's chain → host's chain (or broadcast).
    PlayerLeft {
        player_chain_id: ChainId,
        player_wallet: AccountOwner,
    },
    
    /// Game move made - broadcast to sync state.
    /// Sent from active player's chain → opponent's chain.
    GameMoveSync {
        room: MultiplayerGameRoom,
    },
    
    /// Game ended notification.
    /// Sent to both players and HUB for leaderboard sync.
    GameEndedSync {
        host_chain_id: ChainId,
        game_type: MultiplayerGameType,
        winner: Option<AccountOwner>,
        loser: Option<AccountOwner>,
        winner_username: String,
        loser_username: String,
        is_draw: bool,
    },
    
    /// Reward sync message - sent from host chain to player's chain
    /// after multiplayer game ends to award XP and coins.
    RewardSync {
        player_wallet: AccountOwner,
        xp_earned: u64,
        coins_earned: u64,
        is_winner: bool,
        game_type: MultiplayerGameType,
    },
}

/// Instantiation argument for the arcade hub application.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstantiationArgument {
    /// The chain ID of the hub chain that aggregates all data.
    pub hub_chain_id: ChainId,
}

/// Errors that can occur in the arcade hub.
#[derive(Debug, Clone, thiserror::Error)]
pub enum ArcadeError {
    // ========== EXISTING ERRORS ==========
    #[error("Player is already registered")]
    PlayerAlreadyRegistered,
    #[error("Player is not registered")]
    PlayerNotRegistered,
    #[error("Username must be between 3 and 20 characters")]
    InvalidUsernameLength,
    #[error("Username contains invalid characters")]
    InvalidUsernameCharacters,
    #[error("Operation requires authentication")]
    NotAuthenticated,
    #[error("Internal error: {0}")]
    Internal(String),

    // ========== TOKEN ECONOMY ERRORS ==========
    #[error("Daily bonus already claimed today")]
    DailyBonusAlreadyClaimed,
    #[error("Insufficient coins balance")]
    InsufficientCoins,

    // ========== PREDICTION ERRORS ==========
    #[error("Crypto round not found")]
    CryptoRoundNotFound,
    #[error("Round is not accepting bets")]
    RoundNotAcceptingBets,
    #[error("Round is already resolved")]
    RoundAlreadyResolved,
    #[error("World event not found")]
    WorldEventNotFound,
    #[error("Event is not accepting bets")]
    EventNotAcceptingBets,
    #[error("Event is already resolved")]
    EventAlreadyResolved,
    #[error("Minimum bet amount is 10 coins")]
    BetTooSmall,
    #[error("Maximum bet amount is 10000 coins")]
    BetTooLarge,
    #[error("Prediction not found")]
    PredictionNotFound,

    // ========== MULTIPLAYER ERRORS ==========
    #[error("Multiplayer room not found")]
    RoomNotFound,
    #[error("Room is full")]
    RoomFull,
    #[error("Game already in progress")]
    GameAlreadyStarted,
    #[error("Not your turn")]
    NotYourTurn,
    #[error("Invalid move")]
    InvalidMove,
    #[error("Game is not in progress")]
    GameNotInProgress,
    #[error("Game already finished")]
    GameAlreadyFinished,
    #[error("Opponent has not timed out yet")]
    OpponentNotTimedOut,
    #[error("Cannot join your own room")]
    CannotJoinOwnRoom,
    #[error("Room is waiting for players")]
    RoomWaitingForPlayers,
}

impl ArcadeError {
    /// Convert to an ArcadeResponse::Error.
    pub fn into_response(self) -> ArcadeResponse {
        ArcadeResponse::Error(ErrorResponse {
            success: false,
            error: self.to_string(),
        })
    }
}

/// Validate a username.
pub fn validate_username(username: &str) -> Result<(), ArcadeError> {
    let len = username.len();
    if len < 3 || len > 20 {
        return Err(ArcadeError::InvalidUsernameLength);
    }
    if !username
        .chars()
        .all(|c| c.is_alphanumeric() || c == '_' || c == '-')
    {
        return Err(ArcadeError::InvalidUsernameCharacters);
    }
    Ok(())
}
