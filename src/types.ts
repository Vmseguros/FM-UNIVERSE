export type UserRole = 'USER' | 'MANAGER' | 'ADMIN';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  managedClubId: string;
  avatar?: string;
}

export interface ManagerProfile {
  uid: string;
  name: string;
  email: string;
  role: 'MANAGER';
  clubId: string | null;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PlayerPosition =
  | 'GK'
  | 'CB'
  | 'LB'
  | 'RB'
  | 'LWB'
  | 'RWB'
  | 'CDM'
  | 'CM'
  | 'CAM'
  | 'LM'
  | 'RM'
  | 'LW'
  | 'RW'
  | 'ST'
  | 'CF'
  | 'GOL'
  | 'ZAG'
  | 'LE'
  | 'LD'
  | 'VOL'
  | 'MC'
  | 'MEI'
  | 'ME'
  | 'MD'
  | 'ATA';

export type PositionCategory = 'GOLEIRO' | 'DEFENSOR' | 'MEIO-CAMPISTA' | 'ATACANTE';

export type PlayerStatus =
  | 'FIT'
  | 'TIRED'
  | 'INJURED'
  | 'SUSPENDED'
  | 'TRANSFER_LISTED';

export type PlayerMorale = 'Muito Baixa' | 'Baixa' | 'Normal' | 'Boa' | 'Excelente';

export interface PlayerStats {
  matches: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  averageRating: number;
  cleanSheets: number;
  minutesPlayed: number;
}

export interface PlayerAttributes {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
}

export interface PlayerTechnicalAttributes {
  corners?: number; // Cantos / Escanteios (1-20 ou 1-99)
  crossing?: number; // Cruzamentos
  dribbling?: number; // Drible
  finishing?: number; // Finalização
  firstTouch?: number; // Primeiro Toque
  freeKicks?: number; // Faltas
  heading?: number; // Cabeceamento
  longShots?: number; // Remates / Chutes de Longe
  longThrows?: number; // Lançamentos Longos
  marking?: number; // Marcação
  passing?: number; // Passe
  penaltyTaking?: number; // Pênaltis
  tackling?: number; // Desarme
  technique?: number; // Técnica
}

export interface PlayerMentalAttributes {
  aggression?: number; // Agressividade
  anticipation?: number; // Antecipação
  bravery?: number; // Bravura / Coragem
  composure?: number; // Compostura
  concentration?: number; // Concentração
  decisions?: number; // Decisões
  determination?: number; // Determinação
  flair?: number; // Talento / Imprevisibilidade
  leadership?: number; // Liderança
  offTheBall?: number; // Desmarcação / Sem Bola
  positioning?: number; // Posicionamento
  teamwork?: number; // Trabalho em Equipe
  vision?: number; // Visão de Jogo
  workRate?: number; // Índice de Trabalho
}

export interface PlayerPhysicalAttributes {
  acceleration?: number; // Aceleração
  agility?: number; // Agilidade
  balance?: number; // Equilíbrio
  jumpingReach?: number; // Impulsão
  naturalFitness?: number; // Aptidão Física
  pace?: number; // Velocidade
  stamina?: number; // Resistência
  strength?: number; // Força
}

export interface PlayerGoalkeeperAttributes {
  aerialReach?: number; // Alcance Aéreo
  commandOfArea?: number; // Comando de Área
  communication?: number; // Comunicação
  eccentricity?: number; // Excentricidade
  handling?: number; // Jogo de Mãos / Firmeza
  kicking?: number; // Pontapés
  oneOnOnes?: number; // Um contra Um
  reflexes?: number; // Reflexos
  rushingOut?: number; // Saída do Gol
  punching?: number; // Desvio de Punhos
  throwing?: number; // Reposição Manual
}

export type PositionProficiency =
  | 'Natural'
  | 'Confortável'
  | 'Hábil'
  | 'Desajeitado'
  | 'Inapto';

export type PlayerDetailedPositions = Partial<Record<PlayerPosition, PositionProficiency>>;

export interface PlayerSeasonStats {
  season: string;
  competitionName: string;
  competitionId?: string;
  matches: number;
  starts: number;
  substituteAppearances: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  averageRating: number;
  cleanSheets: number;
  minutesPlayed: number;
}

export interface PlayerCareerEntry {
  season: string;
  clubName: string;
  clubId?: string;
  matches: number;
  goals: number;
  assists?: number;
  averageRating?: number;
}

export interface PlayerInjuryDetails {
  type: string;
  returnDate?: string;
  daysRemaining?: number;
  severity?: 'Leve' | 'Moderada' | 'Grave';
}

export interface PlayerSuspensionDetails {
  competitionId?: string;
  competitionName?: string;
  matchesRemaining: number;
  reason?: string;
}

export type PlayerDataSource = 'FM26_EXPORT' | 'FM26' | 'FM2008' | 'FM2008_EXPORT' | 'MOCK' | 'MANUAL' | 'SYSTEM';
export type PlayerDataQuality = 'COMPLETE' | 'PARTIAL' | 'BASIC';

export interface Player {
  // === IDENTIFICAÇÃO CANÔNICA ===
  id: string; // ID interno do FM Universe
  name: string; // Nome padrão de exibição (compatível)
  fullName?: string; // Nome completo civil (exportado do FM26)
  shortName?: string; // Nome curto alternativo
  knownAs?: string; // Apelido ou nome esportivo popular
  birthDate?: string; // Data de nascimento (ISO YYYY-MM-DD)
  age: number;
  nationality: string;
  nationalityCode: string;
  secondNationality?: string;
  secondNationalityCode?: string;
  avatar?: string;
  photo?: string;
  preferredFoot: 'Destro' | 'Canhoto' | 'Ambidestro';
  weakFoot?: number; // 1-20 ou 1-5
  jerseyNumber: number;
  height?: number; // Altura em cm
  weight?: number; // Peso em kg
  personality?: string; // Personalidade FM26

  // === CLUBE E VÍNCULO ===
  clubId: string;
  clubName: string;
  club?: string;
  previousClub?: string;
  previousClubId?: string;
  // Clube atual e vínculos no ecossistema FM Universe
  currentClubId?: string;
  currentClubName?: string;
  isAuctionActive?: boolean;
  activeAuctionId?: string;
  auctionStatus?: 'AVAILABLE' | 'IN_AUCTION' | 'SOLD';
  squadStatus?:
    | 'Chave'
    | 'Titular'
    | 'Rotativo'
    | 'Reserva'
    | 'Jovem'
    | 'Dispensável'
    | 'Emprestado'
    | string;

  // === POSIÇÕES ===
  position: PlayerPosition;
  positionCategory: PositionCategory;
  secondaryPositions?: PlayerPosition[];
  detailedPositions?: PlayerDetailedPositions;

  // === ATRIBUTOS (Gerais e Especializados FM26) ===
  overall: number;
  potential: number;
  attributes: PlayerAttributes; // Mantido 100% retrocompatível
  technicalAttributes?: PlayerTechnicalAttributes;
  mentalAttributes?: PlayerMentalAttributes;
  physicalAttributes?: PlayerPhysicalAttributes;
  goalkeeperAttributes?: PlayerGoalkeeperAttributes;

  // === CONTRATO E VALORES (Em BRL / R$) ===
  wage: number; // Mensal em R$ (BRL)
  wageWeekly?: number; // Semanal em R$ (BRL)
  marketValue: number; // Valor de mercado em R$ (BRL)
  contractUntil: string;
  contractStartDate?: string;
  releaseClause?: number; // Cláusula rescisória em R$ (BRL)

  // === DESEMPENHO E ESTATÍSTICAS ===
  stats: PlayerStats;
  starts?: number;
  substituteAppearances?: number;
  seasonStats?: PlayerSeasonStats[];

  // === ESTADO DO JOGADOR ===
  status: PlayerStatus;
  condition: number; // 0 a 100
  morale: PlayerMorale;
  fatigue?: number; // 0 a 100
  isInjured?: boolean;
  injuryDetails?: PlayerInjuryDetails;
  isSuspended?: boolean;
  suspensionDetails?: PlayerSuspensionDetails;
  recentForm?: number[];

  // === HISTÓRICO ===
  careerHistory?: PlayerCareerEntry[];
  previousClubs?: string[];
  valueHistory?: { date: string; value: number }[];

  // === ORIGEM DOS DADOS (PROVENANCE & AUDIT) ===
  source?: PlayerDataSource;
  sourceVersion?: string; // Ex: "FM26_v26.2"
  database?: string; // Ex: "FM26" ou "FM2008"
  databaseSource?: 'FM2008' | 'FM26' | string; // Origem explícita canônica
  importedAt?: string; // ISO timestamp de importação
  importBatchId?: string; // ID do lote de importação (fm26_import_batches/{importBatchId})
  externalId?: string; // Unique ID (UID) originário do Football Manager
  uniqueId?: string; // Unique ID (UID) numérico original do banco FM2008 / FM26
  sourceUniqueId?: string; // Identificador unívoco persistido da fonte original
  ca?: number; // Current Ability (1 - 200) do Football Manager
  pa?: number; // Potential Ability (1 - 200) do Football Manager
  aDiff?: number; // Diferença PA - CA
  saleValue?: number; // Sale Value (FM Genie Scout) em R$ BRL
  rawFMData?: Record<string, string>; // Preserva com segurança todos os 74 campos do CSV
  dataQuality?: PlayerDataQuality;
  deduplicationKey?: string; // Chave determinística de deduplicação
}

// === PAGINAÇÃO E CONSULTAS DE ALTA ESCALA ===
export interface PlayerQueryOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  clubId?: string;
  positionCategory?: string;
  position?: PlayerPosition;
  minOverall?: number;
  maxOverall?: number;
  minAge?: number;
  maxAge?: number;
  sortBy?:
    | 'overall'
    | 'marketValue'
    | 'wage'
    | 'goals'
    | 'age'
    | 'name'
    | 'potential'
    | 'averageRating';
  sortOrder?: 'asc' | 'desc';
  source?: PlayerDataSource;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface Stadium {
  id: string;
  name: string;
  city: string;
  country: string;
  capacity: number;
  surface: 'Grama Natural' | 'Grama Híbrida' | 'Grama Sintética';
  pitchCondition: number; // 0-100
  openedYear: number;
  image?: string;
}

export interface Club {
  id: string;
  name: string;
  slug: string;
  shortName: string;
  code: string;
  badge: string;
  stadiumId: string;
  stadiumName: string;
  capacity: number;
  reputation: number; // 1-5 estrelas ou 0-100
  transferBudget: number;
  reservedTransferBudget?: number; // Valor temporariamente retido por lances ativos em leilões
  wageBudget: number;
  balance: number;
  managerName: string;
  squadCount: number;
  fansCount: number;
  primaryColor: string;
  secondaryColor: string;
  boardExpectation: string;
  seasonTarget: string;
  leaguePosition?: number;
  trophiesCount: number;
  foundedYear: number;
  // Integração com o sistema de Managers
  managerId?: string;
  logoUrl?: string;
  homeKitUrl?: string;
  awayKitUrl?: string;
  stadiumImageUrl?: string;
  youthLevel?: number;
  trainingLevel?: number;
  facilities?: Partial<ClubFacility>;
  financialConfig?: ClubFinancialConfig;
  lastAudit?: {
    type: string;
    cost: number;
    previousBalance: number;
    newBalance: number;
    timestamp: string;
    description?: string;
    idempotencyKey?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface ClubStanding {
  position: number;
  clubId: string;
  clubName: string;
  clubSlug: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: ('W' | 'D' | 'L')[];
}

export type MatchEventType =
  | 'GOAL'
  | 'YELLOW_CARD'
  | 'RED_CARD'
  | 'SUBSTITUTION'
  | 'INJURY'
  | 'PENALTY';

export interface MatchEvent {
  id: string;
  minute: number;
  type: MatchEventType;
  teamId: string;
  playerId: string;
  playerName: string;
  detail?: string;
}

export interface MatchLineupPlayer {
  playerId: string;
  position: PlayerPosition;
  name: string;
  number: number;
}

export interface MatchLineup {
  teamId: string;
  formation: string;
  startingXI: MatchLineupPlayer[];
  substitutes: MatchLineupPlayer[];
}

export interface MatchStats {
  possession: [number, number]; // home, away (em %)
  shots: [number, number];
  shotsOnTarget: [number, number];
  fouls: [number, number];
  corners: [number, number];
  offsides: [number, number];
  passesAccuracy: [number, number];
}

export type CalendarStatus = 'RASCUNHO' | 'HOMOLOGADO' | 'ENCERRADO';

export interface CompetitionParticipant {
  id: string; // Ex: `${competitionId}_${clubId}`
  clubId: string;
  clubeId?: string;
  clubName: string;
  competitionId: string;
  competicaoId?: string;
  seasonId: string;
  temporadaId?: string;
  status: 'CONFIRMADO' | 'PENDENTE' | 'HOMOLOGADO';
  joinedAt: string;
}

export interface Match {
  id: string;
  temporadaId?: string;
  seasonId?: string;
  competicaoId?: string;
  competitionId: string;
  competitionName: string;
  season?: string;
  round: number;
  rodada?: number;
  date: string;
  time: string;
  homeClubId: string;
  homeClubName: string;
  awayClubId: string;
  awayClubName: string;
  stadiumId: string;
  stadiumName: string;
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'AGENDADA' | 'EM_ANDAMENTO' | 'CONCLUIDA';
  homeScore?: number;
  awayScore?: number;
  events: MatchEvent[];
  lineups?: {
    home: MatchLineup;
    away: MatchLineup;
  };
  stats?: MatchStats;
  attendance?: number;
  ticketRevenue?: number;
}

export interface CompetitionRules {
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  tiebreakers: ('SALDO_GOLS' | 'GOLS_PRO' | 'VITORIAS' | 'CONFRONTO_DIRETO' | 'MENOS_CARTAO_VERMELHO')[];
}

export interface CompetitionPrizeDistribution {
  champion: number;
  runnerUp: number;
  thirdPlace?: number;
  participationPerClub: number;
  winBonus: number;
  drawBonus: number;
}

export interface Competition {
  id: string;
  name: string;
  type: 'LIGA' | 'COPA';
  season: string;
  temporadaId?: string;
  logo: string;
  teamsCount: number;
  roundsCount: number;
  currentRound: number;
  status: 'EM_ANDAMENTO' | 'FINALIZADA' | 'PREVIA';
  calendarStatus?: CalendarStatus;
  calendarHomologatedAt?: string;
  calendarHomologatedBy?: string;
  format?: 'TODOS_CONTRA_TODOS' | 'MATA_MATA' | 'GRUPOS_E_MATA_MATA';
  legs?: 'TURNO_UNICO' | 'TURNO_E_RETURNO';
  standings: ClubStanding[];
  description: string;
  topScorerPlayerId?: string;
  participantIds?: string[];
  rules?: CompetitionRules;
  prizes?: CompetitionPrizeDistribution;
}

export interface Transfer {
  id: string;
  playerId: string;
  playerName: string;
  playerAge: number;
  playerPosition: PlayerPosition;
  fromClubId: string;
  fromClubName: string;
  toClubId: string;
  toClubName: string;
  fee: number; // 0 se livre
  amount?: number;
  offerId?: string;
  wage?: number;
  season?: string;
  date: string;
  type: 'TRANSFER' | 'LOAN' | 'FREE';
  status: 'COMPLETED' | 'RUMOR' | 'NEGOTIATING';
  createdAt?: string;
}

export type TransferOfferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED' | 'NEGOCIAÇÃO' | 'NEGOTIATION';

export interface TransferOffer {
  id: string;
  playerId: string;
  playerName: string;
  playerSnapshot?: Partial<Player>;
  
  buyerClubId: string;
  buyerClubName: string;
  sellerClubId: string;
  sellerClubName: string;
  
  // Aliases for compatibility
  toClubId?: string;
  toClubName?: string;
  fromClubId?: string;
  fromClubName?: string;

  amount: number;
  proposedFee?: number;
  counterOfferAmount?: number;
  lastOfferBy?: 'BUYER' | 'SELLER';

  status: TransferOfferStatus;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  createdBy?: string;
  responseNote?: string;
}

export type NewsCategory =
  | 'COMPETICAO'
  | 'TRANSFERENCIAS'
  | 'BASTIDORES'
  | 'DECLARACOES'
  | 'FINANCAS'
  | 'ESTADIO'
  | 'DM_DISCIPLINA';

export type NewsPriority = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';

export type NewsEventType =
  | 'TRANSFER_PROPOSAL'
  | 'TRANSFER_COUNTER'
  | 'TRANSFER_COMPLETED'
  | 'INJURY'
  | 'SUSPENSION'
  | 'MATCH_RESULT'
  | 'STANDINGS_CHANGE'
  | 'FINANCE_RECORD'
  | 'STADIUM_UPGRADE'
  | 'MANAGER_MESSAGE'
  | 'TOURNAMENT_EVENT'
  | 'OTHER_CLUB_EVENT';

export interface News {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: NewsCategory;
  type?: NewsEventType;
  priority?: NewsPriority;
  clubId?: string;
  clubName?: string;
  clubBadge?: string;
  stadiumImage?: string;
  date: string;
  timestamp?: string;
  author: string;
  imageUrl?: string;
  readTimeMinutes: number;
  isRead?: boolean;
  sourceEventId?: string;
  metadata?: Record<string, any>;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ALERT' | 'TRANSFER_OFFER_RECEIVED' | 'TRANSFER_OFFER_ACCEPTED' | 'TRANSFER_OFFER_REJECTED';
  date: string;
  read: boolean;
  link?: string;
  offerId?: string;
  clubId?: string;
  userId?: string;
  createdAt?: string;
}

export interface ClubStaff {
  id: string;
  name: string;
  role: 'Treinador Adjunto' | 'Preparador Físico' | 'Olheiro-Chefe' | 'Diretor de Futebol' | 'Médico-Chefe';
  age: number;
  nationality: string;
  rating: number; // 1-100
  wage: number;
}

export interface ClubFacility {
  stadiumLevel: number;
  youthAcademyLevel: number;
  trainingCenterLevel: number;
  medicalCenterLevel: number;
  scoutNetworkLevel: number;
}

export interface FinanceRecord {
  id?: string;
  month?: string;
  date?: string;
  type?: 'INCOME' | 'EXPENSE';
  transactionType?: 'Compra de jogador' | 'Venda de jogador' | string;
  offerId?: string;
  transferId?: string;
  category?: string;
  description?: string;
  amount?: number;
  clubId?: string;
  // Campos de Livro Caixa e Motor de Temporada
  round?: number;
  season?: string;
  origin?: string;
  inOut?: 'IN' | 'OUT' | 'CREDIT' | 'DEBIT';
  balanceAfter?: number;
  // Campos agregados legado
  ticketSales?: number;
  tvRights?: number;
  sponsorships?: number;
  playerSales?: number;
  playerWages?: number;
  staffWages?: number;
  maintenance?: number;
  scouting?: number;
}

export type RoundStatus = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA';

export interface RoundFinancialBreakdown {
  clubId: string;
  clubName: string;
  roundNumber: number;
  seasonYear: string;
  matchId: string;
  isHomeMatch: boolean;
  matchResult: 'WIN' | 'DRAW' | 'LOSS';
  scoreFormatted: string;
  opponentId: string;
  opponentName: string;
  attendance: number;
  stadiumCapacity: number;
  occupancyRate: number;
  incomes: {
    ticketSales: number;
    tvRights: number;
    sponsorships: number;
    bonuses: number;
    prizeMoney: number;
    merchandising: number;
    totalIncome: number;
  };
  expenses: {
    payrollWageShare: number;
    staffWageShare: number;
    stadiumMaintenance: number;
    travelAndLogistics: number;
    otherOperational: number;
    totalExpense: number;
  };
  netAmount: number;
  previousBalance: number;
  newBalance: number;
  ledgerEntries: FinanceRecord[];
}

export interface RoundSummaryData {
  round: number;
  seasonYear: string;
  competitionId: string;
  competitionName: string;
  userMatch: Match;
  allMatches: Match[];
  financialBreakdown: RoundFinancialBreakdown;
  updatedStandings: ClubStanding[];
  previousPosition: number;
  newPosition: number;
  eventsHighlights: string[];
}

export interface TacticPositionSlot {
  id: string;
  label: string; // Ex: "Goleiro", "Zagueiro Esq", "Ponta Dir"
  defaultRole: PlayerPosition;
  x: number; // % na prancheta (0 a 100)
  y: number; // % na prancheta (0 a 100)
  assignedPlayerId?: string;
}

export interface TacticSetup {
  clubId?: string;
  formation: string; // "4-3-3", "4-2-3-1", "3-5-2", "4-4-2"
  mentality: 'Defensiva' | 'Cautelosa' | 'Equilibrada' | 'Ofensiva' | 'Muito Ofensiva' | 'Contra-Ataque' | string;
  tempo: 'Lento' | 'Padrão' | 'Rápido' | string;
  passingStyle: 'Curto' | 'Misto' | 'Direto' | string;
  pressingIntensity: 'Baixa' | 'Média' | 'Alta' | 'Intensa' | string;
  slots: TacticPositionSlot[];
  substitutes: string[]; // player ids
  updatedAt?: string;
}

export type SeasonStatus = 'ACTIVE' | 'UPCOMING' | 'COMPLETED' | 'RASCUNHO' | 'HOMOLOGADA';

export interface Season {
  id: string;
  year: string;
  name: string;
  status: SeasonStatus;
  startDate: string;
  endDate: string;
  transferWindowOpen?: boolean;
  isCurrent?: boolean;
  competitionsCount?: number;
  homologatedAt?: string;
  homologatedBy?: string;
  rules?: CompetitionRules;
  prizes?: CompetitionPrizeDistribution;
}

export type StaffMember = ClubStaff;

export interface TacticalSlot {
  id: string;
  positionName: string;
  label: string;
  x: number;
  y: number;
  player?: Player | null;
  assignedPlayerId?: string;
  defaultRole?: PlayerPosition;
}

export interface FinancialReport {
  balance: number;
  transferBudget: number;
  wageBudget: number;
  wageSpend: number;
  incomes: {
    ticketSales: number;
    sponsorships: number;
    tvRights: number;
    merchandising: number;
    prizeMoney: number;
  };
  expenses: {
    playerWages: number;
    staffWages: number;
    stadiumMaintenance: number;
    youthAcademy: number;
  };
}

// ==========================================
// SISTEMA ECONÔMICO ADMINISTRÁVEL (FM UNIVERSE)
// ==========================================

export type SponsorPaymentMethod = 'A_VISTA' | 'MENSAL' | 'POR_RODADA' | 'POR_TEMPORADA';
export type SponsorStatus = 'ATIVO' | 'PENDENTE' | 'ENCERRADO';
export type SponsorCategory = 'MASTER' | 'MANGA' | 'COSTAS' | 'ESTADIO' | 'MATERIAL_ESPORTIVO' | 'OUTRO';

export interface SponsorContract {
  id: string;
  name: string;
  category: SponsorCategory;
  contractValue: number;
  paymentMethod: SponsorPaymentMethod;
  amountPerRound: number;
  monthlyAmount: number;
  bonusWin: number;
  bonusDraw?: number; // Bônus por empate
  bonusQualification: number;
  bonusTitle: number;
  startDate: string;
  endDate: string;
  status: SponsorStatus;
}

export interface MatchdayRevenueConfig {
  ticketMinPrice?: number; // Preço mínimo do ingresso
  ticketAveragePrice: number; // Preço médio
  ticketMaxPrice?: number; // Preço máximo
  expectedAttendance: number; // Público esperado
  expectedOccupancyRate: number; // Percentual médio de ocupação (Ex: 85%)
  estimatedMatchRevenue: number; // Receita estimada por partida
  concessionsRevenuePerMatch: number; // Alimentos, bebidas e hospitalidade
  parkingAndCommercialRevenue: number; // Estacionamento e ativações comerciais
  memberSubscriptionRevenueMonthly: number; // Sócio-torcedor mensal
  merchandisingMonthly?: number; // Merchandising e venda de produtos
  otherRevenuesMonthly?: number; // Outras receitas operacionais
  otherMatchdayRevenue?: number;
}

export interface TvRightsConfig {
  amountPerRound: number; // Cota por rodada
  monthlyQuota?: number; // Cota mensal
  amountPerCompetition: number; // Cota por competição
  bonusQualification: number; // Bônus por classificação
  bonusAudienceShare: number; // Audiência / PPV
  internationalBroadcasting?: number;
  otherBroadcastingRevenue?: number;
}

export interface MerchandisingConfig {
  revenuePerRound: number; // Receita média por rodada
  monthlyRevenue: number; // Receita mensal
  specialEventsRevenue: number; // Bônus/eventos especiais
}

export interface CompetitionPrize {
  competitionId: string;
  competitionName: string;
  championPrize: number;
  runnerUpPrize: number;
  participationPrize: number;
}

export interface PrizeConfig {
  winPrize: number;
  drawPrize: number;
  qualificationPrize: number;
  titlePrize: number;
  specificCompetitionPrizes: CompetitionPrize[];
}

export interface ExpensesConfig {
  payrollWageMonthly: number;
  coachingStaffWageMonthly: number;
  operationalStaffWageMonthly: number;
  stadiumMaintenanceMonthly: number;
  youthAcademyMonthly: number;
  travelAndLogisticsPerMatch: number;
  otherOperationalExpensesMonthly: number;
}

export interface FinancialAuditFieldChange {
  fieldName: string;
  fieldLabel: string;
  previousValue: string | number;
  newValue: string | number;
}

export interface FinancialAuditEntry {
  id: string;
  clubId: string;
  clubName: string;
  seasonYear: string;
  action: 'SAVE_DRAFT' | 'UPDATE_CONFIG' | 'HOMOLOGATE_SEASON' | 'ADD_SPONSOR' | 'EDIT_SPONSOR' | 'REMOVE_SPONSOR' | 'RESET_DEFAULTS';
  description: string;
  reason?: string; // Motivo da alteração, se informado
  fieldChanges?: FinancialAuditFieldChange[];
  adminEmail: string;
  adminUid: string;
  timestamp: string;
}

export interface ClubFinancialConfig {
  id: string; // Ex: `${clubId}_fin_config`
  clubId: string;
  clubName?: string;
  seasonId: string;
  seasonYear: string;

  // Status de Homologação Oficial
  isHomologated: boolean;
  isOfficial?: boolean; // Marcação oficial da Liga
  status: 'RASCUNHO' | 'HOMOLOGADA' | 'OFICIAL';
  homologatedAt?: string;
  homologatedBy?: string;

  // 1. Orçamento Inicial da Temporada
  initialCash?: number; // Caixa inicial
  initialSeasonBudget: number;
  transferBudget: number;
  squadBudget: number;
  coachingStaffBudget?: number; // Verba para comissão técnica
  staffBudget: number; // Verba para staff operacional
  wageBudget: number;

  // 2. Patrocínios
  sponsors: SponsorContract[];

  // 3. Bilheteria e Receitas de Jogos
  matchday: MatchdayRevenueConfig;

  // 4. Receitas de TV
  tvRights: TvRightsConfig;

  // 5. Premiações
  prizes: PrizeConfig;

  // 6. Merchandising
  merchandising?: MerchandisingConfig;

  // 7. Despesas Fixas & Operacionais
  expenses: ExpensesConfig;

  // 8. Histórico de Auditoria
  auditHistory?: FinancialAuditEntry[];

  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export * from './types/auction';
export * from './types/auctionV2';

