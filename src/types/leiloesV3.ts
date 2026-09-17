export type LeilaoStatus = 'AGENDADO' | 'ABERTO' | 'ENCERRADO' | 'CANCELADO';

export interface Leilao {
  id: string;
  playerId: string;
  playerName: string;
  initialBid: number;
  minIncrement: number;
  startTime: string;
  endTime: string;
  status: LeilaoStatus;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  
  // Metadados visuais do jogador para exibição direta
  playerAge?: number;
  playerClub?: string;
  playerPosition?: string;
  playerRating?: number;
  playerPhoto?: string | null;

  highestBid?: number;
  highestBidder?: string;
  highestBidderClub?: string;
}

export interface Lance {
  id: string;
  leilaoId?: string;
  managerId: string;
  managerName: string;
  clubId: string;
  value: number;
  createdAt: string;
}

export interface CriarLeilaoParams {
  playerId: string;
  playerName: string;
  initialBid: number;
  minIncrement: number;
  startTime: string;
  endTime: string;
  status?: LeilaoStatus;
  createdBy: string;
  playerAge?: number;
  playerClub?: string;
  playerPosition?: string;
  playerRating?: number;
  playerPhoto?: string | null;
}

export interface DarLanceParams {
  leilaoId: string;
  managerId: string;
  managerName: string;
  clubId: string;
  value: number;
  initialBid?: number;
  minIncrement?: number;
  highestBid?: number;
  prevLeaderClubId?: string | null;
  clubTransferBudget?: number;
  clubReservedBudget?: number;
}
