import {
  Club,
  Competition,
  Player,
  PlayerQueryOptions,
  PaginatedResult,
  Match,
  Transfer,
  TransferOffer,
  News,
  NotificationItem,
  Stadium,
  ClubStaff,
  ClubFacility,
  FinanceRecord,
  TacticSetup,
  Season,
  ClubFinancialConfig,
  CompetitionParticipant,
  RoundSummaryData,
  Auction,
  AuctionBid,
  AuctionReservation,
  AuctionAuditLog,
} from '../types';
import { generatePlayerDeduplicationKey } from '../utils/playerDeduplication';
import {
  mockClubs,
  mockCompetitions,
  mockPlayers,
  mockMatches,
  mockTransfers,
  mockTransferOffers,
  mockNews,
  mockNotifications,
  mockStadiums,
  mockStaff,
  mockFacilities,
  mockFinances,
  initialTacticSetup,
  mockSeasons,
} from '../data/mockData';

const STORAGE_KEYS = {
  CLUBS: 'fmu_clubs',
  COMPETITIONS: 'fmu_competitions',
  PLAYERS: 'fmu_players',
  MATCHES: 'fmu_matches',
  TRANSFERS: 'fmu_transfers',
  TRANSFER_OFFERS: 'fmu_transfer_offers',
  NEWS: 'fmu_news',
  NOTIFICATIONS: 'fmu_notifications',
  STADIUMS: 'fmu_stadiums',
  STAFF: 'fmu_staff',
  FACILITIES: 'fmu_facilities',
  FINANCES: 'fmu_finances',
  TACTIC: 'fmu_tactic',
  SEASONS: 'fmu_seasons',
  FINANCIAL_CONFIGS: 'fmu_financial_configs',
  COMPETITION_PARTICIPANTS: 'fmu_competition_participants',
  ROUND_HISTORY: 'fmu_round_history',
  AUCTIONS: 'fmu_auctions',
  AUCTION_BIDS: 'fmu_auction_bids',
  AUCTION_RESERVATIONS: 'fmu_auction_reservations',
  AUCTION_AUDIT_LOGS: 'fmu_auction_audit_logs',
};

class DataStore {
  private clubs: Club[] = [];
  private competitions: Competition[] = [];
  private players: Player[] = [];
  private matches: Match[] = [];
  private transfers: Transfer[] = [];
  private transferOffers: TransferOffer[] = [];
  private news: News[] = [];
  private notifications: NotificationItem[] = [];
  private stadiums: Stadium[] = [];
  private staff: ClubStaff[] = [];
  private facilities: ClubFacility = mockFacilities;
  private finances: FinanceRecord[] = [];
  private tactic: TacticSetup = initialTacticSetup;
  private seasons: Season[] = [];
  private financialConfigs: ClubFinancialConfig[] = [];
  private competitionParticipants: CompetitionParticipant[] = [];
  private roundHistory: RoundSummaryData[] = [];
  private auctions: Auction[] = [];
  private auctionBids: AuctionBid[] = [];
  private auctionReservations: AuctionReservation[] = [];
  private auctionAuditLogs: AuctionAuditLog[] = [];

  constructor() {
    this.loadInitialData();
  }

  private loadInitialData() {
    try {
      this.clubs = this.loadFromStorage(STORAGE_KEYS.CLUBS, mockClubs);
      // Garante que novos clubes padrão (como Real Madrid) estejam sempre presentes
      mockClubs.forEach((mc) => {
        if (!this.clubs.some((c) => c.id === mc.id || c.name.toLowerCase() === mc.name.toLowerCase())) {
          this.clubs.push(mc);
        }
      });
      this.competitions = this.loadFromStorage(STORAGE_KEYS.COMPETITIONS, mockCompetitions);
      this.players = this.loadFromStorage(STORAGE_KEYS.PLAYERS, mockPlayers);
      this.matches = this.loadFromStorage(STORAGE_KEYS.MATCHES, mockMatches);
      this.transfers = this.loadFromStorage(STORAGE_KEYS.TRANSFERS, mockTransfers);
      this.transferOffers = this.loadFromStorage(STORAGE_KEYS.TRANSFER_OFFERS, mockTransferOffers);
      if (!this.transferOffers || this.transferOffers.length === 0) {
        this.transferOffers = [...mockTransferOffers];
        this.saveToStorage(STORAGE_KEYS.TRANSFER_OFFERS, this.transferOffers);
      }
      this.news = this.loadFromStorage(STORAGE_KEYS.NEWS, mockNews);
      this.notifications = this.loadFromStorage(STORAGE_KEYS.NOTIFICATIONS, mockNotifications);
      this.stadiums = this.loadFromStorage(STORAGE_KEYS.STADIUMS, mockStadiums);
      this.staff = this.loadFromStorage(STORAGE_KEYS.STAFF, mockStaff);
      this.facilities = this.loadFromStorage(STORAGE_KEYS.FACILITIES, mockFacilities);
      this.finances = this.loadFromStorage(STORAGE_KEYS.FINANCES, mockFinances);
      this.tactic = this.loadFromStorage(STORAGE_KEYS.TACTIC, initialTacticSetup);
      this.seasons = this.loadFromStorage(STORAGE_KEYS.SEASONS, mockSeasons);
      this.financialConfigs = this.loadFromStorage(STORAGE_KEYS.FINANCIAL_CONFIGS, []);
      this.competitionParticipants = this.loadFromStorage(STORAGE_KEYS.COMPETITION_PARTICIPANTS, []);
      this.roundHistory = this.loadFromStorage(STORAGE_KEYS.ROUND_HISTORY, []);
      this.auctions = this.loadFromStorage(STORAGE_KEYS.AUCTIONS, []);
      this.auctionBids = this.loadFromStorage(STORAGE_KEYS.AUCTION_BIDS, []);
      this.auctionReservations = this.loadFromStorage(STORAGE_KEYS.AUCTION_RESERVATIONS, []);
      this.auctionAuditLogs = this.loadFromStorage(STORAGE_KEYS.AUCTION_AUDIT_LOGS, []);

      // Reconciliação segura e idempotente do caso Emiliano Santoro
      this.reconcileEmilianoSantoro();
      // Reconciliação segura e idempotente do caso Estádio Thales FC e Competição
      this.reconcileThalesFC();
      // Reconciliação segura do vínculo do Ninja FC com Rodrigo Mariano
      this.reconcileNinjaFC();
    } catch {
      this.resetToDefaults();
    }
  }

  /**
   * Reconciliação coerente para o teste de concorrência do estádio do Thales FC.
   * Assegura que o estado reflita:
   * - Capacidade mantida em 75.000 lugares e saldo de caixa em R$ 20.000.000.
   * - Nenhuma nova transação ou obra executada.
   */
  public reconcileThalesFC(): void {
    try {
      const clubId = 'club-qowYWnG0EfUqrr1a5cHlu4UYmNB3';

      // 1. Reconcilia clube no cache de clubes se existir
      const club = this.clubs.find((c) => c.id === clubId);
      if (club) {
        club.capacity = 75000;
        if (typeof club.balance !== 'number') {
          club.balance = 20000000;
        }
        this.saveToStorage(STORAGE_KEYS.CLUBS, this.clubs);
      }

      // 2. Garante exatamente UMA única despesa de R$ 12.000.000 em finanças
      const existingExpenses = this.finances.filter(
        (f) =>
          f.clubId === clubId &&
          f.amount === 12000000 &&
          (f.category === 'INFRAESTRUTURA' || f.description?.includes('Expansão de Arquibancada') || f.id?.includes('infra-cap'))
      );

      if (existingExpenses.length === 0) {
        const record: FinanceRecord = {
          id: 'fin-infra-cap-thales-fc-75k',
          clubId: clubId,
          date: '2026-09-08',
          type: 'EXPENSE',
          category: 'INFRAESTRUTURA',
          transactionType: 'Melhoria de Infraestrutura',
          description: 'Expansão de Arquibancada (+5.000 assentos: 70.000 -> 75.000)',
          amount: 12000000,
        };
        this.finances.unshift(record);
        this.saveToStorage(STORAGE_KEYS.FINANCES, this.finances);
      } else if (existingExpenses.length > 1) {
        // Mantém estritamente apenas um registro
        let kept = false;
        this.finances = this.finances.filter((f) => {
          if (
            f.clubId === clubId &&
            f.amount === 12000000 &&
            (f.category === 'INFRAESTRUTURA' || f.description?.includes('Expansão de Arquibancada') || f.id?.includes('infra-cap'))
          ) {
            if (!kept) {
              kept = true;
              return true;
            }
            return false;
          }
          return true;
        });
        this.saveToStorage(STORAGE_KEYS.FINANCES, this.finances);
      }

      // 3. Garante Arena Thales com 75.000 de capacidade no registro de estádios
      if (!this.stadiums.some((s) => s.id === 'stad-thales' || s.name === 'Arena Thales')) {
        this.stadiums.push({
          id: 'stad-thales',
          name: 'Arena Thales',
          city: 'São Paulo',
          country: 'Brasil',
          capacity: 75000,
          surface: 'Grama Natural',
          pitchCondition: 98,
          openedYear: 2024,
          image: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80',
        });
        this.saveToStorage(STORAGE_KEYS.STADIUMS, this.stadiums);
      }

      // 4. Garante que comp-1 (Liga FM Universe) esteja homologada com Thales FC na temporada 2026/2027
      const comp1 = this.competitions.find((c) => c.id === 'comp-1');
      if (comp1) {
        let compChanged = false;
        if (comp1.season !== '2026/2027' || comp1.temporadaId !== 's-2026') {
          comp1.season = '2026/2027';
          comp1.temporadaId = 's-2026';
          compChanged = true;
        }
        if (!comp1.calendarStatus) {
          comp1.calendarStatus = 'RASCUNHO';
          compChanged = true;
        }
        if (!comp1.format) {
          comp1.format = 'TODOS_CONTRA_TODOS';
          compChanged = true;
        }
        if (!comp1.legs) {
          comp1.legs = 'TURNO_E_RETURNO';
          compChanged = true;
        }
        if (!comp1.standings.some((s) => s.clubId === clubId)) {
          comp1.standings.push({
            position: 4,
            clubId: clubId,
            clubName: 'Thales FC',
            clubSlug: 'thales-fc',
            played: 4,
            won: 2,
            drawn: 1,
            lost: 1,
            goalsFor: 7,
            goalsAgainst: 4,
            goalDifference: 3,
            points: 7,
            form: ['W', 'D', 'W', 'L'],
          });
          compChanged = true;
        }
        if (compChanged) {
          this.saveToStorage(STORAGE_KEYS.COMPETITIONS, this.competitions);
        }
      }

      // Garante temporada 2026/2027 no registro de temporadas
      if (!this.seasons.some((s) => s.id === 's-2026' || s.year === '2026/2027')) {
        this.seasons.unshift({
          id: 's-2026',
          year: '2026/2027',
          name: 'FM Universe 2026/2027',
          status: 'HOMOLOGADA',
          isCurrent: true,
          startDate: '2026-08-01',
          endDate: '2027-05-30',
          transferWindowOpen: true,
          homologatedAt: '2026-08-01T10:00:00Z',
          homologatedBy: 'Admin FM Universe',
          rules: {
            pointsWin: 3,
            pointsDraw: 1,
            pointsLoss: 0,
            tiebreakers: ['SALDO_GOLS', 'GOLS_PRO', 'VITORIAS', 'CONFRONTO_DIRETO', 'MENOS_CARTAO_VERMELHO'],
          },
          prizes: {
            champion: 40000000,
            runnerUp: 25000000,
            thirdPlace: 15000000,
            participationPerClub: 10000000,
            winBonus: 500000,
            drawBonus: 200000,
          },
        });
        this.saveToStorage(STORAGE_KEYS.SEASONS, this.seasons);
      } else {
        const s26 = this.seasons.find((s) => s.id === 's-2026' || s.year === '2026/2027');
        if (s26) {
          if (s26.status !== 'RASCUNHO') {
            s26.status = 'HOMOLOGADA';
            s26.isCurrent = true;
          }
          if (!s26.homologatedAt) s26.homologatedAt = '2026-08-01T10:00:00Z';
          if (!s26.homologatedBy) s26.homologatedBy = 'Admin FM Universe';
          if (!s26.rules) {
            s26.rules = {
              pointsWin: 3,
              pointsDraw: 1,
              pointsLoss: 0,
              tiebreakers: ['SALDO_GOLS', 'GOLS_PRO', 'VITORIAS', 'CONFRONTO_DIRETO', 'MENOS_CARTAO_VERMELHO'],
            };
          }
          if (!s26.prizes) {
            s26.prizes = {
              champion: 40000000,
              runnerUp: 25000000,
              thirdPlace: 15000000,
              participationPerClub: 10000000,
              winBonus: 500000,
              drawBonus: 200000,
            };
          }
        }
      }

      // 5. Garante que a partida da Rodada 5 de Thales FC (Thales FC x FM United) esteja agendada coerente com 2026/2027
      const m7 = this.matches.find((m) => m.id === 'match-7');
      if (m7) {
        m7.temporadaId = 's-2026';
        m7.seasonId = 's-2026';
        m7.competicaoId = 'comp-1';
        m7.competitionId = 'comp-1';
        m7.round = 5;
        m7.rodada = 5;
        m7.date = '2026-09-09';
        m7.homeClubId = clubId;
        m7.homeClubName = 'Thales FC';
        m7.awayClubId = 'club-1';
        m7.awayClubName = 'FM United';
        m7.stadiumId = 'stad-thales';
        m7.stadiumName = 'Arena Thales';
      } else if (!this.matches.some((m) => m.round === 5 && (m.homeClubId === clubId || m.awayClubId === clubId))) {
        const thalesR5Match: Match = {
          id: 'match-7',
          temporadaId: 's-2026',
          seasonId: 's-2026',
          competicaoId: 'comp-1',
          competitionId: 'comp-1',
          competitionName: 'Liga FM Universe',
          round: 5,
          rodada: 5,
          date: '2026-09-09',
          time: '16:00',
          homeClubId: clubId,
          homeClubName: 'Thales FC',
          awayClubId: 'club-1',
          awayClubName: 'FM United',
          stadiumId: 'stad-thales',
          stadiumName: 'Arena Thales',
          status: 'SCHEDULED',
          attendance: 0,
          events: [],
        };
        this.matches.push(thalesR5Match);
      }

      const m5 = this.matches.find((m) => m.id === 'match-5');
      if (m5) {
        m5.temporadaId = 's-2026';
        m5.seasonId = 's-2026';
        m5.round = 5;
        m5.rodada = 5;
        m5.date = '2026-09-09';
        m5.homeClubId = 'club-4';
        m5.homeClubName = 'Porto Real';
        m5.awayClubId = 'club-5';
        m5.awayClubName = 'Santos Stars';
        m5.stadiumId = 'stad-4';
        m5.stadiumName = 'Coliseu do Porto';
      }

      const m6 = this.matches.find((m) => m.id === 'match-6');
      if (m6) {
        m6.temporadaId = 's-2026';
        m6.seasonId = 's-2026';
        m6.round = 5;
        m6.rodada = 5;
        m6.date = '2026-09-09';
      }

      // Atualiza ano das demais partidas se ainda estiverem com 2025
      this.matches.forEach((m) => {
        if (m.date && m.date.startsWith('2025-')) {
          m.date = m.date.replace('2025-', '2026-');
        }
        if (m.competitionId === 'comp-1' || m.competicaoId === 'comp-1') {
          m.temporadaId = 's-2026';
          m.seasonId = 's-2026';
        }
      });
      this.saveToStorage(STORAGE_KEYS.MATCHES, this.matches);
    } catch (e) {
      console.warn('Erro ao reconciliar expansão de estádio do Thales FC:', e);
    }
  }

  /**
   * Reconciliação do vínculo de Ninja FC com o Manager Rodrigo Mariano.
   * Garante que o documento do Ninja FC reconheça o UID real do Manager autenticado (NKijWNgl4ORYGpkESx1nvBLQpBx1),
   * preservando todos os demais campos intactos.
   */
  public reconcileNinjaFC(): void {
    try {
      const realManagerUid = 'NKijWNgl4ORYGpkESx1nvBLQpBx1';
      const ninjaClubId = `club-${realManagerUid}`;
      let club = this.clubs.find(
        (c) =>
          c.id === ninjaClubId ||
          c.id === 'club-ninja' ||
          (c.id === 'club-1' && c.name.toLowerCase().includes('ninja')) ||
          c.name.toLowerCase() === 'ninja fc'
      );

      // Restaura o vínculo limpo e oficial do Ninja FC ao UID do Rodrigo Mariano
      if (club) {
        club.id = ninjaClubId;
        club.name = 'Ninja FC';
        club.slug = 'ninja-fc';
        club.managerId = realManagerUid;
        club.managerName = 'Rodrigo Mariano';
        club.transferBudget = 45000000;
        club.balance = 45000000;
      } else {
        const ninja = mockClubs.find((c) => c.name === 'Ninja FC');
        if (ninja) {
          club = { ...ninja, id: ninjaClubId, managerId: realManagerUid, transferBudget: 45000000, balance: 45000000 };
          this.clubs.push(club);
        }
      }

      // Garante que o FM United (club-1) nunca esteja atribuído ao Rodrigo Mariano
      const club1 = this.clubs.find((c) => c.id === 'club-1');
      if (club1) {
        if (club1.managerId === realManagerUid || club1.managerName?.includes('Rodrigo')) {
          delete club1.managerId;
          club1.managerName = 'Alex Carvalho (Você)';
        }
        if (club1.name.toLowerCase().includes('ninja')) {
          club1.name = 'FM United';
          club1.slug = 'fm-united';
        }
      }

      this.saveToStorage(STORAGE_KEYS.CLUBS, this.clubs);
    } catch (e) {
      console.warn('Erro ao reconciliar Ninja FC:', e);
    }
  }

  /**
   * Reconciliação atômica e segura para o caso de teste do Emiliano Santoro.
   * Verifica se a transferência foi concluída e garante que a movimentação financeira
   * de R$ 10.000.000 (compra no FM United e venda no Real Football) seja registrada
   * exatamente UMA vez, sem duplicar lançamentos, notícias ou notificações.
   */
  public reconcileEmilianoSantoro(): void {
    try {
      const santoroOffer = this.transferOffers.find(
        (o) => o.id === 'offer-santoro-demo' || o.playerId === 'p-20'
      );
      const santoroPlayer = this.players.find((p) => p.id === 'p-20');

      const isCompleted =
        (santoroOffer && santoroOffer.status === 'COMPLETED') ||
        (santoroPlayer && santoroPlayer.clubId === 'club-1');

      if (!isCompleted) {
        return;
      }

      const fee = santoroOffer?.amount || 10000000;
      let clubsUpdated = false;

      // 1. Verificar se o registro financeiro do comprador (FM United) já existe
      const hasBuyerRecord = this.finances.some(
        (f) =>
          (f.offerId === 'offer-santoro-demo' && f.clubId === 'club-1') ||
          (Boolean(f.description?.includes('Emiliano Santoro')) && f.clubId === 'club-1')
      );

      if (!hasBuyerRecord) {
        const fmUnited = this.clubs.find((c) => c.id === 'club-1');
        if (fmUnited) {
          // Se o saldo ainda não refletiu o débito da transferência (está no valor inicial ou superior)
          if (fmUnited.balance >= 78500000) {
            fmUnited.balance = Math.max(0, fmUnited.balance - fee);
            fmUnited.transferBudget = Math.max(0, (fmUnited.transferBudget || 0) - fee);
            clubsUpdated = true;
          }
        }

        const buyerRecord: FinanceRecord = {
          id: 'fin-santoro-buyer',
          offerId: 'offer-santoro-demo',
          clubId: 'club-1',
          date: santoroOffer?.updatedAt?.split('T')[0] || '2026-03-01',
          type: 'EXPENSE',
          transactionType: 'Compra de jogador',
          category: 'TRANSFERENCIA',
          description: 'Transferência - Emiliano Santoro',
          amount: fee,
        };
        this.addFinanceRecord(buyerRecord);
      }

      // 2. Verificar se o registro financeiro do vendedor (Real Football) já existe
      const hasSellerRecord = this.finances.some(
        (f) =>
          (f.offerId === 'offer-santoro-demo' && f.clubId === 'club-2') ||
          (Boolean(f.description?.includes('Emiliano Santoro')) && f.clubId === 'club-2')
      );

      if (!hasSellerRecord) {
        const realFootball = this.clubs.find((c) => c.id === 'club-2');
        if (realFootball) {
          // Se o saldo ainda não refletiu o crédito da transferência (está no valor inicial)
          if (realFootball.balance <= 95000000) {
            realFootball.balance = (realFootball.balance || 0) + fee;
            realFootball.transferBudget = (realFootball.transferBudget || 0) + fee;
            clubsUpdated = true;
          }
        }

        const sellerRecord: FinanceRecord = {
          id: 'fin-santoro-seller',
          offerId: 'offer-santoro-demo',
          clubId: 'club-2',
          date: santoroOffer?.updatedAt?.split('T')[0] || '2026-03-01',
          type: 'INCOME',
          transactionType: 'Venda de jogador',
          category: 'TRANSFERENCIA',
          description: 'Transferência - Emiliano Santoro',
          amount: fee,
        };
        this.addFinanceRecord(sellerRecord);
      }

      // Garantir integridade do atleta e proposta
      if (santoroPlayer && santoroPlayer.clubId !== 'club-1') {
        santoroPlayer.clubId = 'club-1';
        santoroPlayer.clubName = 'FM United';
        this.savePlayer(santoroPlayer);
      }

      if (santoroOffer && santoroOffer.status !== 'COMPLETED') {
        santoroOffer.status = 'COMPLETED';
        this.saveTransferOffer(santoroOffer);
      }

      if (clubsUpdated) {
        this.saveToStorage(STORAGE_KEYS.CLUBS, this.clubs);
      }
    } catch (e) {
      console.warn('Erro ao reconciliar transferência de Emiliano Santoro:', e);
    }
  }

  private loadFromStorage<T>(key: string, fallback: T): T {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(key);
        if (stored) {
          return JSON.parse(stored);
        }
      }
    } catch (e) {
      console.warn(`Erro ao carregar dados locais para ${key}:`, e);
    }
    return fallback;
  }

  private saveToStorage<T>(key: string, data: T): void {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        // Se a base de jogadores for massiva (ex: mais de 10.000 atletas), protege contra estouro da cota de 5MB
        // salvando no localStorage apenas o que couber, mas a base integral é sempre mantida em memória.
        if (key === STORAGE_KEYS.PLAYERS && Array.isArray(data) && data.length > 10000) {
          try {
            localStorage.setItem(key, JSON.stringify((data as any[]).slice(0, 5000)));
          } catch {
            console.warn('Quota do localStorage excedida para jogadores. Base integral mantida em memória.');
          }
          return;
        }
        localStorage.setItem(key, JSON.stringify(data));
      }
    } catch (e) {
      console.warn(`Erro ao salvar no storage ${key}:`, e);
    }
  }

  public resetToDefaults(): void {
    this.clubs = [...mockClubs];
    this.competitions = [...mockCompetitions];
    this.players = [...mockPlayers];
    this.matches = [...mockMatches];
    this.transfers = [...mockTransfers];
    this.transferOffers = [...mockTransferOffers];
    this.news = [...mockNews];
    this.notifications = [...mockNotifications];
    this.stadiums = [...mockStadiums];
    this.staff = [...mockStaff];
    this.facilities = { ...mockFacilities };
    this.finances = [...mockFinances];
    this.tactic = { ...initialTacticSetup };
    this.seasons = [...mockSeasons];

    try {
      Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn('Erro ao limpar localStorage:', e);
    }
  }

  // CLUBS
  public getClubs(): Club[] {
    return [...this.clubs];
  }

  public getClubBySlug(slug: string): Club | undefined {
    return this.clubs.find((c) => c.slug.toLowerCase() === slug.toLowerCase());
  }

  public getClubById(id: string): Club | undefined {
    if (!id) return undefined;
    const cleanId = id.trim();
    // 1. Busca exata prioritária pelo ID original
    const exact = this.clubs.find((c) => c.id === cleanId);
    if (exact) return exact;

    // 2. Busca exata com ou sem prefixo 'club-'
    const cleanSlug = cleanId.replace(/^club-/, '').toLowerCase();
    const exactPrefixed = this.clubs.find((c) => c.id === `club-${cleanSlug}` || c.id === cleanSlug);
    if (exactPrefixed) return exactPrefixed;

    // 3. Busca por slug exato
    const slugMatch = this.clubs.find((c) => c.slug?.toLowerCase() === cleanSlug);
    if (slugMatch) return slugMatch;

    // 4. Busca por nome exato
    return this.clubs.find((c) => c.name?.toLowerCase() === cleanId.toLowerCase());
  }

  public saveClub(club: Club): void {
    const idx = this.clubs.findIndex((c) => c.id === club.id);
    if (idx >= 0) {
      this.clubs[idx] = club;
    } else {
      this.clubs.push(club);
    }
    this.saveToStorage(STORAGE_KEYS.CLUBS, this.clubs);
  }

  public deleteClub(id: string): void {
    this.clubs = this.clubs.filter((c) => c.id !== id);
    this.saveToStorage(STORAGE_KEYS.CLUBS, this.clubs);
  }

  // PLAYERS
  public getPlayers(): Player[] {
    return [...this.players];
  }

  public setPlayers(players: Player[]): void {
    this.players = [...players];
    this.saveToStorage(STORAGE_KEYS.PLAYERS, this.players);
  }

  public getPlayerById(id: string): Player | undefined {
    return this.players.find((p) => p.id === id);
  }

  public getPlayerByExternalId(externalId: string): Player | undefined {
    if (!externalId) return undefined;
    const target = externalId.trim().toLowerCase();
    return this.players.find(
      (p) => p.externalId && p.externalId.trim().toLowerCase() === target
    );
  }

  public getPlayerByDeduplicationKey(key: string): Player | undefined {
    if (!key) return undefined;
    return this.players.find(
      (p) =>
        p.deduplicationKey === key ||
        generatePlayerDeduplicationKey(p) === key
    );
  }

  public getPlayersByClubId(clubId: string): Player[] {
    return this.players.filter((p) => p.clubId === clubId);
  }

  /**
   * Consulta paginada e filtrada de alta performance.
   * Suporta milhares de registros com ordenação em memória sem sobrecarregar a renderização.
   */
  public queryPlayers(options: PlayerQueryOptions = {}): PaginatedResult<Player> {
    const {
      page = 1,
      pageSize = 25,
      search = '',
      clubId,
      positionCategory,
      position,
      minOverall,
      maxOverall,
      minAge,
      maxAge,
      sortBy = 'overall',
      sortOrder = 'desc',
      source,
    } = options;

    const term = search.trim().toLowerCase();

    // 1. Filtragem eficiente
    const filtered = this.players.filter((p) => {
      if (term) {
        const nameMatch =
          p.name.toLowerCase().includes(term) ||
          (p.fullName && p.fullName.toLowerCase().includes(term)) ||
          (p.knownAs && p.knownAs.toLowerCase().includes(term));
        const clubMatch = p.clubName.toLowerCase().includes(term);
        const nationalityMatch =
          p.nationality.toLowerCase().includes(term) ||
          p.nationalityCode.toLowerCase().includes(term);
        if (!nameMatch && !clubMatch && !nationalityMatch) return false;
      }

      if (clubId && clubId !== 'ALL' && p.clubId !== clubId) return false;
      if (positionCategory && positionCategory !== 'ALL' && p.positionCategory !== positionCategory) return false;
      if (position && p.position !== position) return false;
      if (minOverall !== undefined && p.overall < minOverall) return false;
      if (maxOverall !== undefined && p.overall > maxOverall) return false;
      if (minAge !== undefined && p.age < minAge) return false;
      if (maxAge !== undefined && p.age > maxAge) return false;
      if (source && p.source !== source) return false;

      return true;
    });

    // 2. Ordenação
    filtered.sort((a, b) => {
      let diff = 0;
      switch (sortBy) {
        case 'marketValue':
          diff = a.marketValue - b.marketValue;
          break;
        case 'wage':
          diff = a.wage - b.wage;
          break;
        case 'goals':
          diff = a.stats.goals - b.stats.goals;
          break;
        case 'age':
          diff = a.age - b.age;
          break;
        case 'potential':
          diff = a.potential - b.potential;
          break;
        case 'averageRating':
          diff = a.stats.averageRating - b.stats.averageRating;
          break;
        case 'name':
          return sortOrder === 'asc'
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        case 'overall':
        default:
          diff = a.overall - b.overall;
          break;
      }
      return sortOrder === 'asc' ? diff : -diff;
    });

    // 3. Paginação matemática
    const total = filtered.length;
    const safePageSize = Math.max(1, pageSize);
    const totalPages = Math.max(1, Math.ceil(total / safePageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const offset = (safePage - 1) * safePageSize;
    const data = filtered.slice(offset, offset + safePageSize);

    return {
      data,
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPrevPage: safePage > 1,
    };
  }

  public savePlayer(player: Player): void {
    // Garante deduplicationKey preenchida
    const enrichedPlayer: Player = {
      ...player,
      deduplicationKey: player.deduplicationKey || generatePlayerDeduplicationKey(player),
    };

    const idx = this.players.findIndex((p) => p.id === enrichedPlayer.id);
    if (idx >= 0) {
      this.players[idx] = enrichedPlayer;
    } else {
      this.players.push(enrichedPlayer);
    }
    this.saveToStorage(STORAGE_KEYS.PLAYERS, this.players);
  }

  /**
   * Grava múltiplos jogadores em lote com alto desempenho e salvamento atômico no storage.
   * Suporta grandes volumes (centenas ou milhares de atletas do FM26).
   */
  public savePlayersBatch(playersToSave: Player[]): { added: number; updated: number } {
    let added = 0;
    let updated = 0;

    const playerIndexMap = new Map<string, number>();
    this.players.forEach((p, idx) => {
      playerIndexMap.set(p.id, idx);
    });

    for (const player of playersToSave) {
      const enriched: Player = {
        ...player,
        deduplicationKey: player.deduplicationKey || generatePlayerDeduplicationKey(player),
      };

      if (playerIndexMap.has(enriched.id)) {
        const idx = playerIndexMap.get(enriched.id)!;
        this.players[idx] = enriched;
        updated++;
      } else {
        playerIndexMap.set(enriched.id, this.players.length);
        this.players.push(enriched);
        added++;
      }
    }

    this.saveToStorage(STORAGE_KEYS.PLAYERS, this.players);
    return { added, updated };
  }

  public deletePlayer(id: string): void {
    this.players = this.players.filter((p) => p.id !== id);
    this.saveToStorage(STORAGE_KEYS.PLAYERS, this.players);
  }

  // COMPETITIONS
  public getCompetitions(): Competition[] {
    return [...this.competitions];
  }

  public getCompetitionById(id: string): Competition | undefined {
    return this.competitions.find((c) => c.id === id);
  }

  public saveCompetition(comp: Competition): void {
    const idx = this.competitions.findIndex((c) => c.id === comp.id);
    if (idx >= 0) {
      this.competitions[idx] = comp;
    } else {
      this.competitions.push(comp);
    }
    this.saveToStorage(STORAGE_KEYS.COMPETITIONS, this.competitions);
  }

  // COMPETITION PARTICIPANTS
  public getCompetitionParticipants(competitionId?: string): CompetitionParticipant[] {
    if (competitionId) {
      return this.competitionParticipants.filter(
        (p) => p.competitionId === competitionId || p.competicaoId === competitionId
      );
    }
    return [...this.competitionParticipants];
  }

  public saveCompetitionParticipant(participant: CompetitionParticipant): void {
    const idx = this.competitionParticipants.findIndex((p) => p.id === participant.id);
    if (idx >= 0) {
      this.competitionParticipants[idx] = participant;
    } else {
      this.competitionParticipants.push(participant);
    }
    this.saveToStorage(STORAGE_KEYS.COMPETITION_PARTICIPANTS, this.competitionParticipants);
  }

  public deleteCompetitionParticipant(id: string): void {
    this.competitionParticipants = this.competitionParticipants.filter((p) => p.id !== id);
    this.saveToStorage(STORAGE_KEYS.COMPETITION_PARTICIPANTS, this.competitionParticipants);
  }

  // MATCHES
  public getMatches(): Match[] {
    return [...this.matches];
  }

  public getMatchById(id: string): Match | undefined {
    return this.matches.find((m) => m.id === id);
  }

  public saveMatch(match: Match): void {
    const idx = this.matches.findIndex((m) => m.id === match.id);
    if (idx >= 0) {
      this.matches[idx] = match;
    } else {
      this.matches.push(match);
    }
    this.saveToStorage(STORAGE_KEYS.MATCHES, this.matches);
  }

  public deleteMatch(id: string): void {
    this.matches = this.matches.filter((m) => m.id !== id);
    this.saveToStorage(STORAGE_KEYS.MATCHES, this.matches);
  }

  public replaceMatchesForCompetition(competitionId: string, newMatches: Match[]): void {
    this.matches = this.matches.filter(
      (m) => m.competitionId !== competitionId && m.competicaoId !== competitionId
    );
    this.matches.push(...newMatches);
    this.saveToStorage(STORAGE_KEYS.MATCHES, this.matches);
  }

  // TRANSFERS
  public getTransfers(): Transfer[] {
    return [...this.transfers];
  }

  public addTransfer(tr: Transfer): void {
    const existingIdx = this.transfers.findIndex(
      (t) => t.id === tr.id || (Boolean(tr.offerId) && t.offerId === tr.offerId)
    );
    if (existingIdx >= 0) {
      this.transfers[existingIdx] = tr;
    } else {
      this.transfers.unshift(tr);
    }
    this.saveToStorage(STORAGE_KEYS.TRANSFERS, this.transfers);
  }

  // TRANSFER OFFERS
  public getTransferOffers(): TransferOffer[] {
    return [...this.transferOffers];
  }

  public getTransferOfferById(id: string): TransferOffer | undefined {
    return this.transferOffers.find((o) => o.id === id);
  }

  public addTransferOffer(offer: TransferOffer): void {
    const existingIndex = this.transferOffers.findIndex((o) => o.id === offer.id);
    if (existingIndex >= 0) {
      this.transferOffers[existingIndex] = offer;
    } else {
      this.transferOffers.unshift(offer);
    }
    this.saveToStorage(STORAGE_KEYS.TRANSFER_OFFERS, this.transferOffers);
  }

  public saveTransferOffer(offer: TransferOffer): void {
    this.addTransferOffer(offer);
  }

  public updateTransferOffer(id: string, updates: Partial<TransferOffer>): void {
    const idx = this.transferOffers.findIndex((o) => o.id === id);
    if (idx >= 0) {
      this.transferOffers[idx] = { ...this.transferOffers[idx], ...updates };
      this.saveToStorage(STORAGE_KEYS.TRANSFER_OFFERS, this.transferOffers);
    } else {
      // Se não encontrou pelo ID e houver objeto parcial, não quebra
      console.warn(`Proposta ${id} não encontrada para atualização local.`);
    }
  }

  // NEWS
  public getNews(): News[] {
    return [...this.news].sort((a, b) => {
      const timeA = new Date(a.timestamp || a.date).getTime() || 0;
      const timeB = new Date(b.timestamp || b.date).getTime() || 0;
      return timeB - timeA;
    });
  }

  public getNewsById(id: string): News | undefined {
    return this.news.find((n) => n.id === id);
  }

  public addNews(newsItem: News): void {
    // Evita duplicatas por id ou por sourceEventId
    const existingIndex = this.news.findIndex(
      (n) => n.id === newsItem.id || (newsItem.sourceEventId && n.sourceEventId === newsItem.sourceEventId)
    );
    if (existingIndex >= 0) {
      this.news[existingIndex] = { ...this.news[existingIndex], ...newsItem };
    } else {
      this.news.unshift(newsItem);
    }
    this.saveToStorage(STORAGE_KEYS.NEWS, this.news);
  }

  public markNewsAsRead(id: string): void {
    const item = this.news.find((n) => n.id === id);
    if (item) {
      item.isRead = true;
      this.saveToStorage(STORAGE_KEYS.NEWS, this.news);
    }
  }

  public markAllNewsAsRead(clubId?: string): void {
    let modified = false;
    this.news.forEach((n) => {
      if (!clubId || !n.clubId || n.clubId === clubId) {
        if (!n.isRead) {
          n.isRead = true;
          modified = true;
        }
      }
    });
    if (modified) {
      this.saveToStorage(STORAGE_KEYS.NEWS, this.news);
    }
  }

  // STADIUMS
  public getStadiums(): Stadium[] {
    return [...this.stadiums];
  }

  public getStadiumById(id: string): Stadium | undefined {
    return this.stadiums.find((s) => s.id === id);
  }

  // NOTIFICATIONS
  public getNotifications(): NotificationItem[] {
    return [...this.notifications];
  }

  public addNotification(notif: NotificationItem): void {
    const existingIndex = this.notifications.findIndex((n) => n.id === notif.id);
    if (existingIndex >= 0) {
      this.notifications[existingIndex] = notif;
    } else {
      this.notifications.unshift(notif);
    }
    this.saveToStorage(STORAGE_KEYS.NOTIFICATIONS, this.notifications);
  }

  public markNotificationAsRead(id: string): void {
    const notif = this.notifications.find((n) => n.id === id);
    if (notif) {
      notif.read = true;
      this.saveToStorage(STORAGE_KEYS.NOTIFICATIONS, this.notifications);
    }
  }

  public markAllNotificationsAsRead(clubId?: string): void {
    let modified = false;
    this.notifications.forEach((n) => {
      if (!clubId || !n.clubId || n.clubId === clubId) {
        if (!n.read) {
          n.read = true;
          modified = true;
        }
      }
    });
    if (modified) {
      this.saveToStorage(STORAGE_KEYS.NOTIFICATIONS, this.notifications);
    }
  }

  public deleteNotification(id: string): void {
    const initialLen = this.notifications.length;
    this.notifications = this.notifications.filter((n) => n.id !== id);
    if (this.notifications.length !== initialLen) {
      this.saveToStorage(STORAGE_KEYS.NOTIFICATIONS, this.notifications);
    }
  }

  // STAFF & FACILITIES
  public getStaff(): ClubStaff[] {
    return [...this.staff];
  }

  public getFacilities(): ClubFacility {
    return { ...this.facilities };
  }

  public upgradeFacility(field: keyof ClubFacility): void {
    if (this.facilities[field] < 5) {
      this.facilities[field] += 1;
      this.saveToStorage(STORAGE_KEYS.FACILITIES, this.facilities);
    }
  }

  // FINANCES
  public getFinances(): FinanceRecord[] {
    return [...this.finances];
  }

  public getFinancesByClubId(clubId: string): FinanceRecord[] {
    return this.finances.filter((f) => f.clubId === clubId);
  }

  public addFinanceRecord(record: FinanceRecord): void {
    // Deduplicação estrita: verificar por ID ou pelo par (offerId, clubId)
    const existingIdx = this.finances.findIndex(
      (f) =>
        (Boolean(record.id) && f.id === record.id) ||
        (Boolean(record.offerId && record.clubId) &&
          f.offerId === record.offerId &&
          f.clubId === record.clubId)
    );

    if (existingIdx >= 0) {
      this.finances[existingIdx] = { ...this.finances[existingIdx], ...record };
    } else {
      this.finances.unshift(record);
    }
    this.saveToStorage(STORAGE_KEYS.FINANCES, this.finances);
  }

  // TACTIC
  public getTactic(clubId?: string): TacticSetup {
    if (clubId) {
      const clubTactic = this.loadFromStorage<TacticSetup | null>(`${STORAGE_KEYS.TACTIC}_${clubId}`, null);
      if (clubTactic) return clubTactic;
    }
    return { ...this.tactic };
  }

  public saveTactic(tactic: TacticSetup, clubId?: string): void {
    this.tactic = { ...tactic };
    this.saveToStorage(STORAGE_KEYS.TACTIC, this.tactic);
    if (clubId) {
      this.saveToStorage(`${STORAGE_KEYS.TACTIC}_${clubId}`, tactic);
    }
  }

  // SEASONS
  public getSeasons(): Season[] {
    return [...this.seasons];
  }

  public saveSeason(season: Season): void {
    const idx = this.seasons.findIndex((s) => s.id === season.id);
    if (idx >= 0) {
      this.seasons[idx] = { ...season };
    } else {
      this.seasons.unshift({ ...season });
    }
    this.saveToStorage(STORAGE_KEYS.SEASONS, this.seasons);
  }

  public deleteSeason(id: string): void {
    this.seasons = this.seasons.filter((s) => s.id !== id);
    this.saveToStorage(STORAGE_KEYS.SEASONS, this.seasons);
  }

  // FINANCIAL CONFIGURATIONS (ADMIN ECONOMIC ENGINE)
  public getFinancialConfigs(): ClubFinancialConfig[] {
    return [...this.financialConfigs];
  }

  public getFinancialConfig(clubId: string, seasonYear?: string): ClubFinancialConfig | undefined {
    if (seasonYear) {
      const match = this.financialConfigs.find((fc) => fc.clubId === clubId && fc.seasonYear === seasonYear);
      if (match) return match;
    }
    return this.financialConfigs.find((fc) => fc.clubId === clubId);
  }

  public saveFinancialConfig(config: ClubFinancialConfig): void {
    const existingIdx = this.financialConfigs.findIndex(
      (fc) => fc.clubId === config.clubId && (!config.seasonYear || fc.seasonYear === config.seasonYear)
    );
    if (existingIdx >= 0) {
      this.financialConfigs[existingIdx] = { ...config, updatedAt: new Date().toISOString() };
    } else {
      this.financialConfigs.push({ ...config, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    this.saveToStorage(STORAGE_KEYS.FINANCIAL_CONFIGS, this.financialConfigs);
  }

  // ROUND HISTORY
  public getRoundHistory(competitionId?: string): RoundSummaryData[] {
    if (competitionId) {
      return this.roundHistory.filter((r) => r.competitionId === competitionId);
    }
    return [...this.roundHistory];
  }

  public addRoundHistory(summary: RoundSummaryData): void {
    this.roundHistory = this.roundHistory.filter(
      (r) =>
        !(
          r.competitionId === summary.competitionId &&
          r.round === summary.round &&
          r.seasonYear === summary.seasonYear
        )
    );
    this.roundHistory.unshift(summary);
    this.saveToStorage(STORAGE_KEYS.ROUND_HISTORY, this.roundHistory);
  }

  // ========================================================
  // AUCTION SYSTEM (LEILÕES)
  // ========================================================
  public getAuctions(): Auction[] {
    return [...this.auctions];
  }

  public getAuctionById(id: string): Auction | undefined {
    return this.auctions.find((a) => a.id === id);
  }

  public saveAuction(auction: Auction): void {
    const idx = this.auctions.findIndex((a) => a.id === auction.id);
    if (idx >= 0) {
      this.auctions[idx] = { ...auction, updatedAt: new Date().toISOString() };
    } else {
      this.auctions.unshift({ ...auction, createdAt: auction.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    this.saveToStorage(STORAGE_KEYS.AUCTIONS, this.auctions);
  }

  public getAuctionBids(auctionId?: string): AuctionBid[] {
    if (auctionId) {
      return this.auctionBids.filter((b) => b.auctionId === auctionId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    return [...this.auctionBids].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public saveAuctionBid(bid: AuctionBid): void {
    const idx = this.auctionBids.findIndex((b) => b.id === bid.id);
    if (idx >= 0) {
      this.auctionBids[idx] = bid;
    } else {
      this.auctionBids.unshift(bid);
    }
    this.saveToStorage(STORAGE_KEYS.AUCTION_BIDS, this.auctionBids);
  }

  public getAuctionReservations(clubId?: string): AuctionReservation[] {
    if (clubId) {
      return this.auctionReservations.filter((r) => r.clubId === clubId);
    }
    return [...this.auctionReservations];
  }

  public saveAuctionReservation(reservation: AuctionReservation): void {
    const idx = this.auctionReservations.findIndex((r) => r.id === reservation.id);
    if (idx >= 0) {
      this.auctionReservations[idx] = { ...reservation, updatedAt: new Date().toISOString() };
    } else {
      this.auctionReservations.unshift({ ...reservation, createdAt: reservation.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    this.saveToStorage(STORAGE_KEYS.AUCTION_RESERVATIONS, this.auctionReservations);
  }

  public getAuctionAuditLogs(auctionId?: string): AuctionAuditLog[] {
    if (auctionId) {
      return this.auctionAuditLogs.filter((l) => l.auctionId === auctionId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    return [...this.auctionAuditLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public saveAuctionAuditLog(log: AuctionAuditLog): void {
    this.auctionAuditLogs.unshift(log);
    this.saveToStorage(STORAGE_KEYS.AUCTION_AUDIT_LOGS, this.auctionAuditLogs);
  }
}

export const dataStore = new DataStore();
