export type AuctionV2Status = 'ABERTO' | 'ENCERRADO' | 'CANCELADO' | 'AGENDADO';

export interface AuctionV2 {
  id: string;
  playerId: string;
  playerName: string;
  playerAge?: number;
  playerClub?: string; // Clube de origem FM2008 (preservado permanentemente)
  playerPosition?: string;
  playerRating?: number;
  playerPhoto?: string;
  initialPrice: number;
  minIncrement: number;
  startTime: string; // ISO
  endTime: string; // ISO
  status: AuctionV2Status;
  currentBid: number;
  currentLeaderClubId: string | null;
  currentLeaderClubName: string | null;
  currentLeaderManagerId: string | null;
  currentLeaderManagerName: string | null;
  totalBids: number;
  winnerManagerId?: string | null;
  winnerClubId?: string | null;
  winnerClubName?: string | null;
  winnerAmount?: number | null;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export interface AuctionV2Bid {
  id: string;
  auctionId: string;
  managerId: string;
  managerName: string;
  clubId: string;
  clubName: string;
  amount: number;
  bidTime: string;
  createdAt: string;
}

export type AuctionV2ReservationStatus = 'ACTIVE' | 'RELEASED' | 'CONSUMED';

export interface AuctionV2Reservation {
  auctionId: string;
  managerId: string;
  clubId: string;
  amount: number;
  status: AuctionV2ReservationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AuctionV2AuditLog {
  id: string;
  auctionId: string;
  action: 'CREATE' | 'BID' | 'OUTBID_RELEASE' | 'CLOSE' | 'CANCEL' | 'STATUS_CHANGE';
  managerId: string;
  clubId?: string;
  amount?: number;
  previousLeaderClubId?: string | null;
  newLeaderClubId?: string | null;
  details: string;
  timestamp: string;
  createdAt: string;
}

export interface AuctionV2BudgetSummary {
  totalBudget: number;
  reservedBudget: number;
  availableBudget: number;
}
