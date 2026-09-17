import { PlayerPosition, PositionCategory } from '../types';

export type AuctionStatus = 'RASCUNHO' | 'AGENDADO' | 'ABERTO' | 'ENCERRADO' | 'CANCELADO';

export interface Auction {
  id: string;
  playerId: string;
  playerName: string;
  playerAge: number;
  playerPosition: PlayerPosition | string;
  playerPositionCategory?: PositionCategory;
  playerNationality: string;
  playerNationalityCode?: string;
  playerOverall: number;
  playerPotential: number;
  playerMarketValue: number;
  // Clube de origem original FM2008 preservado (imutável)
  playerOriginalClubName: string;
  playerClubOriginal?: string;
  playerOriginalClubId?: string;
  playerUniqueId?: string;
  currentClubId?: string;
  currentClubName?: string;
  playerPhoto?: string;
  playerAvatar?: string;
  
  // Parâmetros financeiros do leilão
  initialPrice: number;
  minIncrement: number;
  currentBid: number;
  
  // Liderança atual
  currentLeaderManagerId: string | null;
  currentLeaderManagerName: string | null;
  currentLeaderClubId: string | null;
  currentLeaderClubName: string | null;
  
  // Ciclo de vida e agendamento
  status: AuctionStatus;
  scheduledOpenDate: string; // ISO string
  scheduledCloseDate: string; // ISO string
  openedAt?: string;
  closedAt?: string;
  cancelledAt?: string;
  
  // Resultado final
  winnerManagerId?: string | null;
  winnerClubId?: string | null;
  winningBid?: number | null;
  totalBids: number;
  
  // Metadados
  createdByAdminId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuctionBid {
  id: string;
  auctionId: string;
  playerId: string;
  managerId: string;
  managerName: string;
  clubId: string;
  clubName: string;
  amount: number;
  previousBidAmount: number;
  timestamp: string; // ISO string
  status: 'VALID' | 'OUTBID' | 'WON' | 'CANCELLED';
}

export interface AuctionReservation {
  id: string;
  auctionId: string;
  managerId: string;
  clubId: string;
  amount: number;
  status: 'ACTIVE' | 'RELEASED' | 'CONSUMED';
  createdAt: string;
  updatedAt: string;
}

export type AuctionAuditAction =
  | 'CREATED'
  | 'SCHEDULED'
  | 'OPENED'
  | 'BID_PLACED'
  | 'OUTBID_RELEASED'
  | 'MANUAL_CLOSE'
  | 'AUTO_CLOSE'
  | 'CANCELLED'
  | 'WINNER_DECLARED'
  | 'NO_SALE';

export interface AuctionAuditLog {
  id: string;
  auctionId: string;
  action: AuctionAuditAction;
  performedBy: string;
  performerRole: 'ADMIN' | 'MANAGER' | 'SYSTEM';
  details: Record<string, any>;
  timestamp: string;
}

export interface AuctionBudgetSummary {
  totalTransferBudget: number;
  reservedBudget: number;
  availableBudget: number;
}
