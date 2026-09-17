import {
  Match,
  Club,
  Competition,
  ClubStanding,
  TacticSetup,
  FinanceRecord,
  RoundFinancialBreakdown,
  RoundSummaryData,
  Season,
} from '../types';
import { dataStore } from './dataStore';
import { clubesService } from './clubesService';
import { competicoesService } from './competicoesService';
import { jogosService } from './jogosService';
import { temporadasService } from './temporadasService';
import { adminFinancasService } from './adminFinancasService';
import { matchSimulationService } from './matchSimulationService';
import { notificacoesService } from './notificacoesService';

export interface PendingRoundInfo {
  competition: Competition;
  season: Season;
  roundNumber: number;
  userMatch: Match | null;
  allRoundMatches: Match[];
  isLastRound: boolean;
  hasValidMatchForClub: boolean;
  diagnosticReason: string | null;
  isPendingRound?: boolean;
  isOverdue?: boolean;
  referenceDate?: string;
  minPendingRound?: number;
  blockedBeyondPending?: boolean;
}

export class SeasonMotorService {
  private processingLock: boolean = false;
  private processedRoundsSet: Set<string> = new Set();

  /**
   * Chave de idempotência para proteger contra processamento duplo acidental de uma mesma rodada.
   * Regra Fundamental: baseada estritamente em: temporadaId + competicaoId + rodada.
   */
  public getIdempotencyKey(
    param1: string,
    param2: string | number,
    param3: string | number
  ): string {
    let temporadaId: string;
    let competicaoId: string;
    let roundNumber: number;

    if (typeof param2 === 'number') {
      competicaoId = param1;
      roundNumber = param2;
      temporadaId = String(param3);
    } else {
      temporadaId = param1;
      competicaoId = param2;
      roundNumber = Number(param3);
    }

    const cleanSeason = (temporadaId || 's-2026').replace(/[\/\s]/g, '_');
    return `fmu_idempotency_${cleanSeason}_${competicaoId}_r${roundNumber}`;
  }

  /**
   * Verifica se uma rodada específica já foi homologada e processada.
   */
  public isRoundProcessed(
    param1: string,
    param2: string | number,
    param3: string | number
  ): boolean {
    const key = this.getIdempotencyKey(param1, param2, param3);
    if (this.processedRoundsSet.has(key)) return true;

    try {
      if (typeof localStorage !== 'undefined') {
        if (localStorage.getItem(key)) return true;
        const competicaoId = typeof param2 === 'number' ? param1 : String(param2);
        const roundNumber = typeof param2 === 'number' ? param2 : Number(param3);
        const seasonYear = typeof param2 === 'number' ? String(param3) : param1;
        const legacyKey = `fmu_season_motor_${competicaoId}_s${seasonYear.replace('/', '_')}_r${roundNumber}`;
        if (localStorage.getItem(legacyKey)) return true;
      }
    } catch {
      // ignore
    }
    return false;
  }

  /**
   * Registra a rodada como processada para assegurar idempotência estrita.
   */
  public markRoundProcessed(
    param1: string,
    param2: string | number,
    param3: string | number
  ): void {
    const key = this.getIdempotencyKey(param1, param2, param3);
    const temporadaId = typeof param2 === 'number' ? String(param3) : param1;
    const competicaoId = typeof param2 === 'number' ? param1 : String(param2);
    const roundNumber = typeof param2 === 'number' ? param2 : Number(param3);

    this.processedRoundsSet.add(key);

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(
          key,
          JSON.stringify({
            processedAt: new Date().toISOString(),
            temporadaId,
            competicaoId,
            roundNumber,
          })
        );
      }
    } catch {
      // ignore
    }
  }

  /**
   * Obtém a temporada ativa atual.
   */
  public async getActiveSeason(): Promise<Season> {
    const seasons = await temporadasService.getAll();
    const active = seasons.find((s) => s.isCurrent || s.status === 'HOMOLOGADA' || s.status === 'ACTIVE') || seasons[0];
    if (active) return active;

    return {
      id: 's-2026',
      year: '2026/2027',
      name: 'FM Universe 2026/2027',
      status: 'HOMOLOGADA',
      isCurrent: true,
      startDate: '2026-08-01',
      endDate: '2027-05-30',
      homologatedAt: '2026-08-01T10:00:00Z',
      homologatedBy: 'Admin FM Universe',
    };
  }

  /**
   * Identifica a competição principal ativa e a próxima rodada pendente para avanço.
   * Não cria partidas artificiais: avalia se há partidas reais cadastradas no calendário.
   */
  public async getNextPendingRound(preferredClubId?: string): Promise<PendingRoundInfo> {
    const season = await this.getActiveSeason();
    const competitions = await competicoesService.getAll();
    const competition =
      competitions.find((c) => c.temporadaId === season.id || c.season === season.year) ||
      competitions[0] || {
      id: 'comp-1',
      name: 'Liga FM Universe',
      type: 'LIGA',
      season: season.year,
      logo: '🏆',
      teamsCount: 6,
      roundsCount: 10,
      currentRound: 5,
      status: 'EM_ANDAMENTO',
      standings: [],
      description: 'Principal divisão de futebol do universo FM.',
    };

    const allMatches = await jogosService.getAll();
    const compMatches = allMatches.filter((m) => m.competitionId === competition.id || !m.competitionId);

    // Encontra a menor rodada com partidas agendadas (SCHEDULED ou não finalizadas)
    let nextRoundNumber = competition.currentRound || 5;

    // Checa se há rodadas menores ainda pendentes
    const scheduledMatches = compMatches.filter((m) => m.status === 'SCHEDULED');
    if (scheduledMatches.length > 0) {
      const minRound = Math.min(...scheduledMatches.map((m) => m.round));
      if (minRound && minRound > 0) {
        nextRoundNumber = minRound;
      }
    } else {
      // Se não houver jogos SCHEDULED em compMatches, procura a maior rodada jogada + 1
      const finished = compMatches.filter((m) => m.status === 'FINISHED');
      if (finished.length > 0) {
        const maxFinished = Math.max(...finished.map((m) => m.round));
        nextRoundNumber = maxFinished + 1;
      }
    }

    // Busca as partidas REAIS desta rodada no calendário oficial (sem fabricar partidas falsas)
    const roundMatches = compMatches.filter((m) => m.round === nextRoundNumber);

    const userMatch = preferredClubId
      ? roundMatches.find((m) => m.homeClubId === preferredClubId || m.awayClubId === preferredClubId) || null
      : roundMatches[0] || null;

    const isLastRound = nextRoundNumber >= competition.roundsCount;

    let hasValidMatchForClub = true;
    let diagnosticReason: string | null = null;

    if (season.status === 'RASCUNHO') {
      hasValidMatchForClub = false;
      diagnosticReason = `A temporada "${season.name}" está em status RASCUNHO e precisa ser HOMOLOGADA pelo Administrador antes do avanço de rodadas.`;
    } else if (competition.calendarStatus === 'RASCUNHO') {
      hasValidMatchForClub = false;
      diagnosticReason = `O calendário oficial da ${competition.name} está em status RASCUNHO e precisa ser HOMOLOGADO pelo Administrador antes do avanço de rodadas.`;
    } else if (preferredClubId) {
      if (!userMatch) {
        hasValidMatchForClub = false;
        const inCompetition = competition.standings.some((s) => s.clubId === preferredClubId);
        const anyMatches = allMatches.filter(
          (m) => m.homeClubId === preferredClubId || m.awayClubId === preferredClubId
        );

        if (!inCompetition && anyMatches.length === 0) {
          diagnosticReason = `O clube não possui inscrição na ${competition.name} nem partidas agendadas no calendário oficial.`;
        } else if (!userMatch) {
          diagnosticReason = `O clube não possui partida agendada para a Rodada ${nextRoundNumber} no calendário oficial da ${competition.name}.`;
        }
      }
    } else {
      if (roundMatches.length === 0) {
        hasValidMatchForClub = false;
        diagnosticReason = `Não há partidas agendadas para a Rodada ${nextRoundNumber} no calendário oficial.`;
      }
    }

    // Sincronização Temporal do Motor de Rodadas:
    // Reconhecimento do conceito de PARTIDA PENDENTE (a partida SCHEDULED mais antiga é obrigatória)
    const CURRENT_SEASON_DATE = '2026-09-10';
    const isPendingRound = scheduledMatches.some((m) => m.round === nextRoundNumber);
    const isOverdue = scheduledMatches.some((m) => m.round === nextRoundNumber && m.date < CURRENT_SEASON_DATE);
    const blockedBeyondPending = isPendingRound;

    return {
      competition,
      season,
      roundNumber: nextRoundNumber,
      userMatch,
      allRoundMatches: roundMatches,
      isLastRound,
      hasValidMatchForClub,
      diagnosticReason,
      isPendingRound,
      isOverdue,
      referenceDate: CURRENT_SEASON_DATE,
      minPendingRound: nextRoundNumber,
      blockedBeyondPending,
    };
  }

  /**
   * Garante que haja confrontos gerados para todos os clubes da competição na rodada.
   */
  private async ensureRoundFixtures(
    competition: Competition,
    roundNumber: number,
    seasonYear: string,
    userClubId?: string
  ): Promise<Match[]> {
    const clubs = await clubesService.getAll();
    // Filtra clubes participantes da competição
    let compClubs = clubs.filter((c) => competition.standings.some((s) => s.clubId === c.id));
    if (compClubs.length === 0) {
      compClubs = clubs.slice(0, 6);
    }

    // Se o clube do usuário estiver ativo mas não na lista, inclui-o
    if (userClubId && !compClubs.some((c) => c.id === userClubId)) {
      const userClub = clubs.find((c) => c.id === userClubId);
      if (userClub) {
        compClubs = [userClub, ...compClubs.slice(0, 5)];
      }
    }

    // Se número ímpar, ajusta
    if (compClubs.length % 2 !== 0 && clubs.length > compClubs.length) {
      const extra = clubs.find((c) => !compClubs.some((ec) => ec.id === c.id));
      if (extra) compClubs.push(extra);
    }

    const generatedMatches: Match[] = [];
    const paired = new Set<string>();

    for (let i = 0; i < compClubs.length; i++) {
      const home = compClubs[i];
      if (paired.has(home.id)) continue;

      let away: Club | undefined;
      for (let j = i + 1; j < compClubs.length; j++) {
        if (!paired.has(compClubs[j].id)) {
          away = compClubs[j];
          break;
        }
      }

      if (home && away) {
        paired.add(home.id);
        paired.add(away.id);

        const newMatch: Match = {
          id: `match-auto-r${roundNumber}-${home.id.slice(-4)}-${away.id.slice(-4)}`,
          homeClubId: home.id,
          homeClubName: home.name,
          awayClubId: away.id,
          awayClubName: away.name,
          competitionId: competition.id,
          competitionName: competition.name,
          season: seasonYear,
          round: roundNumber,
          date: `2026-09-${10 + (roundNumber - 5) * 7}`,
          time: '16:00',
          stadiumId: home.stadiumId || `stad-${home.id}`,
          stadiumName: home.stadiumName || `Estádio do ${home.name}`,
          status: 'SCHEDULED',
          attendance: 0,
          events: [],
        };

        await jogosService.save(newMatch);
        generatedMatches.push(newMatch);
      }
    }

    return generatedMatches;
  }

  /**
   * Avança a rodada completa:
   * 1. Proteção de concorrência e trava de idempotência.
   * 2. Simula todos os jogos da rodada com OVR, tática, mando de campo e capacidade real de estádio.
   * 3. Executa as movimentações financeiras baseadas EXCLUSIVAMENTE nos fatos geradores reais da rodada (Homologação Admin).
   * 4. Gera lançamentos detalhados no Livro Caixa (Finanças).
   * 5. Atualiza a tabela de classificação oficial e estatísticas.
   * 6. Retorna o Resumo da Rodada consolidado.
   */
  public async advanceRound(
    param1:
      | string
      | {
          userClubId?: string;
          preferredClubId?: string;
          customTactic?: TacticSetup | null;
          targetRoundNumber?: number;
        },
    param2?: TacticSetup | null,
    param3?: number
  ): Promise<RoundSummaryData> {
    let userClubId: string | undefined;
    let customTactic: TacticSetup | null | undefined;
    let targetRoundNumber: number | undefined;

    if (typeof param1 === 'object' && param1 !== null) {
      userClubId = param1.userClubId || param1.preferredClubId;
      customTactic = param1.customTactic;
      targetRoundNumber = param1.targetRoundNumber;
    } else {
      userClubId = typeof param1 === 'string' ? param1 : undefined;
      customTactic = param2;
      targetRoundNumber = param3;
    }

    if (this.processingLock) {
      throw new Error('O Motor de Temporada já está processando uma rodada neste momento.');
    }

    this.processingLock = true;

    try {
      const nextData = await this.getNextPendingRound(userClubId);
      const { competition, season, roundNumber, allRoundMatches, userMatch, hasValidMatchForClub, diagnosticReason } =
        nextData;

      if (targetRoundNumber) {
        const compId = competition.id;
        const sYear = season.id || season.year;
        if (this.isRoundProcessed(sYear, compId, targetRoundNumber) || targetRoundNumber < roundNumber) {
          throw new Error(
            `A Rodada ${targetRoundNumber} da Temporada ${season.year} já foi processada e homologada previamente. Não é permitido reprocessamento.`
          );
        }
        if (targetRoundNumber > roundNumber) {
          throw new Error(
            `Avanço bloqueado além da Rodada ${roundNumber}: A partida pendente da Rodada ${roundNumber} deve ser disputada obrigatoriamente antes de avançar para rodadas futuras.`
          );
        }
      }

      if (!hasValidMatchForClub || !userMatch) {
        throw new Error(
          diagnosticReason ||
            `Avanço bloqueado: Não existe partida agendada no calendário oficial para o seu clube na Rodada ${roundNumber}.`
        );
      }

      const temporadaId = userMatch.temporadaId || competition.temporadaId || season.id;
      const competicaoId = userMatch.competicaoId || competition.id;

      // 1. Se a partida oficial já estiver CONCLUÍDA, bloquear novo processamento
      if (userMatch.status === 'FINISHED' || (userMatch.status as string) === 'CONCLUIDA') {
        throw new Error(
          `A partida oficial da Rodada ${roundNumber} (${userMatch.homeClubName} x ${userMatch.awayClubName}) já está CONCLUÍDA. Processamento bloqueado.`
        );
      }

      // 2. Proteção de Idempotência: rodadas já processadas não podem ser reprocessadas
      if (this.isRoundProcessed(temporadaId, competicaoId, roundNumber)) {
        throw new Error(
          `A Rodada ${roundNumber} da Temporada ${season.year} já foi processada e homologada previamente. Processamento bloqueado pela chave de idempotência.`
        );
      }

      const allClubs = await clubesService.getAll();
      const clubMap = new Map<string, Club>();
      allClubs.forEach((c) => clubMap.set(c.id, c));

      // Busca táticas e configurações financeiras
      const userClub = clubMap.get(userClubId) || allClubs.find((c) => c.id === userClubId);
      if (!userClub) {
        throw new Error(`Clube gerenciado ${userClubId} não encontrado no sistema.`);
      }

      // Pega a configuração financeira homologada pelo Admin para o clube do usuário
      const adminFinConfig = await adminFinancasService.getConfigByClubId(userClub.id);

      // SNAPSHOT ANTES DE EXECUTAR
      const preIsHome = userMatch.homeClubId === userClub.id;
      const preExpectedTicket = preIsHome
        ? (userClub.capacity || 75000) * (adminFinConfig.matchday.expectedOccupancyRate / 100) * adminFinConfig.matchday.ticketAveragePrice
        : 0;
      const preTv = adminFinConfig.tvRights.amountPerRound || 0;
      const preSponsors = adminFinConfig.sponsors.reduce((sum, s) => {
        if (s.amountPerRound && s.amountPerRound > 0) return sum + s.amountPerRound;
        if (s.paymentMethod === 'POR_RODADA') return sum + (s.contractValue / (competition.roundsCount || 10));
        return sum + Math.round((s.monthlyAmount || 0) / 4);
      }, 0);
      const preMerch = adminFinConfig.merchandising?.revenuePerRound || 95000;
      const preExpectedIncomes = Math.round(preExpectedTicket + preTv + preSponsors + preMerch);

      const prePayroll = Math.round(adminFinConfig.expenses.payrollWageMonthly / 4);
      const preStaff = Math.round((adminFinConfig.expenses.coachingStaffWageMonthly + adminFinConfig.expenses.operationalStaffWageMonthly) / 4);
      const preStad = preIsHome ? Math.round(adminFinConfig.expenses.stadiumMaintenanceMonthly / 2) : 0;
      const preTravel = !preIsHome ? (adminFinConfig.expenses.travelAndLogisticsPerMatch || 120000) : 0;
      const preOther = Math.round((adminFinConfig.expenses.otherOperationalExpensesMonthly + adminFinConfig.expenses.youthAcademyMonthly) / 4);
      const preExpectedExpenses = prePayroll + preStaff + preStad + preTravel + preOther;

      console.log('====================================================');
      console.log('📊 SNAPSHOT ANTES DE EXECUTAR O MOTOR DE TEMPORADA:');
      console.log(`SALDO ANTES: R$ ${userClub.balance.toLocaleString('pt-BR')}`);
      console.log(`ORÇAMENTO DE TRANSFERÊNCIAS: R$ ${(userClub.transferBudget || 0).toLocaleString('pt-BR')}`);
      console.log(`RODADA: ${roundNumber}`);
      console.log(`PARTIDA: ${userMatch.homeClubName} vs ${userMatch.awayClubName} (${preIsHome ? 'Mandante' : 'Visitante'})`);
      console.log(`ESTÁDIO: ${userMatch.stadiumName || 'Arena Thales'}`);
      console.log(`STATUS DA PARTIDA: ${userMatch.status}`);
      console.log(`RECEITAS ESPERADAS: R$ ${preExpectedIncomes.toLocaleString('pt-BR')}`);
      console.log(`DESPESAS ESPERADAS: R$ ${preExpectedExpenses.toLocaleString('pt-BR')}`);
      console.log('====================================================');

      // Simula cada partida da rodada
      const simulatedMatches: Match[] = [];
      let userSimulatedMatch: Match | null = null;

      for (const rawMatch of allRoundMatches) {
        const homeClub = clubMap.get(rawMatch.homeClubId) || {
          id: rawMatch.homeClubId,
          name: rawMatch.homeClubName,
          capacity: 50000,
          reputation: 80,
          balance: 20000000,
          transferBudget: 20000000,
          wageBudget: 3500000,
        } as Club;

        const awayClub = clubMap.get(rawMatch.awayClubId) || {
          id: rawMatch.awayClubId,
          name: rawMatch.awayClubName,
          capacity: 45000,
          reputation: 78,
          balance: 15000000,
          transferBudget: 15000000,
          wageBudget: 3000000,
        } as Club;

        const isUserMatch = rawMatch.homeClubId === userClubId || rawMatch.awayClubId === userClubId;
        const homeTactic = isUserMatch && rawMatch.homeClubId === userClubId ? customTactic : null;
        const awayTactic = isUserMatch && rawMatch.awayClubId === userClubId ? customTactic : null;

        // Pega jogadores se disponíveis
        const homePlayers = dataStore.getPlayersByClubId(homeClub.id);
        const awayPlayers = dataStore.getPlayersByClubId(awayClub.id);

        const ticketPrice = homeClub.id === userClubId
          ? adminFinConfig.matchday.ticketAveragePrice
          : 80;
        const occupancyRate = homeClub.id === userClubId
          ? adminFinConfig.matchday.expectedOccupancyRate
          : 82;

        const finishedMatch = matchSimulationService.simulateMatch(
          rawMatch,
          homeClub,
          awayClub,
          homeTactic,
          awayTactic,
          homePlayers,
          awayPlayers,
          ticketPrice,
          occupancyRate
        );

        await jogosService.save(finishedMatch);
        simulatedMatches.push(finishedMatch);

        if (isUserMatch) {
          userSimulatedMatch = finishedMatch;
        }
      }

      if (!userSimulatedMatch && simulatedMatches.length > 0) {
        userSimulatedMatch = simulatedMatches[0];
      }

      if (!userSimulatedMatch) {
        throw new Error('Não foi possível obter a partida simulada do clube.');
      }

      // -------------------------------------------------------------
      // 3. PROCESSAMENTO ECONÔMICO E FINANCEIRO DA RODADA (ADMIN RULES)
      // REGRA: Receitas futuras NÃO entram no caixa antecipadamente!
      // Apenas fatos geradores desta partida/rodada entram no Livro Caixa.
      // -------------------------------------------------------------
      const isHomeMatch = userSimulatedMatch.homeClubId === userClubId;
      const opponentId = isHomeMatch ? userSimulatedMatch.awayClubId : userSimulatedMatch.homeClubId;
      const opponentName = isHomeMatch ? userSimulatedMatch.awayClubName : userSimulatedMatch.homeClubName;
      const userGoals = isHomeMatch ? (userSimulatedMatch.homeScore || 0) : (userSimulatedMatch.awayScore || 0);
      const opponentGoals = isHomeMatch ? (userSimulatedMatch.awayScore || 0) : (userSimulatedMatch.homeScore || 0);

      const matchResult: 'WIN' | 'DRAW' | 'LOSS' =
        userGoals > opponentGoals ? 'WIN' : userGoals === opponentGoals ? 'DRAW' : 'LOSS';

      const stadiumCapacity = userClub.capacity || 50000;
      const attendance = isHomeMatch
        ? Math.min(stadiumCapacity, userSimulatedMatch.attendance || 0)
        : (userSimulatedMatch.attendance || 0);
      const occupancyRate = isHomeMatch && stadiumCapacity > 0
        ? Math.round((attendance / stadiumCapacity) * 100)
        : 0;

      // RECEITAS DA RODADA
      // 1. Bilheteria (somente quando for mandante)
      let ticketSales = 0;
      if (isHomeMatch) {
        const ticketBase = attendance * adminFinConfig.matchday.ticketAveragePrice;
        const concessions = adminFinConfig.matchday.concessionsRevenuePerMatch || 0;
        const parking = adminFinConfig.matchday.parkingAndCommercialRevenue || 0;
        ticketSales = ticketBase + concessions + parking;
      }

      // 2. Direitos de TV (por rodada homologada)
      const tvRights = adminFinConfig.tvRights.amountPerRound || 0;

      // 3. Patrocínios por rodada
      // Soma todos os patrocinadores com valor por rodada ou pagamento por rodada
      const activeSponsors = adminFinConfig.sponsors.filter((s) => s.status === 'ATIVO');
      const sponsorships = activeSponsors.reduce((sum, s) => {
        if (s.amountPerRound && s.amountPerRound > 0) return sum + s.amountPerRound;
        if (s.paymentMethod === 'POR_RODADA') return sum + (s.contractValue / (competition.roundsCount || 10));
        return sum + Math.round(s.monthlyAmount / 4); // Rateio semanal caso mensal
      }, 0);

      // 4. Bônus de Patrocínio e Premiação Esportiva da Liga
      let sponsorBonus = 0;
      let leaguePrizeMoney = 0;

      if (matchResult === 'WIN') {
        sponsorBonus = activeSponsors.reduce((sum, s) => sum + (s.bonusWin || 0), 0);
        leaguePrizeMoney = adminFinConfig.prizes.winPrize || 0;
      } else if (matchResult === 'DRAW') {
        sponsorBonus = activeSponsors.reduce((sum, s) => sum + (s.bonusDraw || 0), 0);
        leaguePrizeMoney = adminFinConfig.prizes.drawPrize || 0;
      }

      // 5. Merchandising da rodada
      const merchandising = adminFinConfig.merchandising?.revenuePerRound ||
        Math.round((ticketSales > 0 ? ticketSales * 0.15 : 250000));

      const totalIncome = ticketSales + tvRights + sponsorships + sponsorBonus + leaguePrizeMoney + merchandising;

      // DESPESAS DA RODADA (Rateio operacional real sem duplicações)
      // 1. Folha salarial do elenco (rateio da rodada / semanal)
      const payrollWageShare = Math.round(adminFinConfig.expenses.payrollWageMonthly / 4);

      // 2. Salários de comissão e staff (rateio da rodada)
      const staffWageShare = Math.round(
        (adminFinConfig.expenses.coachingStaffWageMonthly + adminFinConfig.expenses.operationalStaffWageMonthly) / 4
      );

      // 3. Manutenção e operação de estádio (se mandante)
      const stadiumMaintenance = isHomeMatch
        ? Math.round(adminFinConfig.expenses.stadiumMaintenanceMonthly / 2)
        : 0;

      // 4. Viagem e logística (se visitante)
      const travelAndLogistics = !isHomeMatch
        ? (adminFinConfig.expenses.travelAndLogisticsPerMatch || 120000)
        : 0;

      // 5. Outras despesas operacionais da rodada
      const otherOperational = Math.round(
        (adminFinConfig.expenses.otherOperationalExpensesMonthly + adminFinConfig.expenses.youthAcademyMonthly) / 4
      );

      const totalExpense = payrollWageShare + staffWageShare + stadiumMaintenance + travelAndLogistics + otherOperational;
      const netAmount = totalIncome - totalExpense;

      const previousBalance = userClub.balance ?? adminFinConfig.initialSeasonBudget;
      const newBalance = previousBalance + netAmount;

      // GERAÇÃO DOS LANÇAMENTOS DETALHADOS NO LIVRO CAIXA
      const ledgerEntries: FinanceRecord[] = [];
      let runningBalance = previousBalance;

      // Créditos
      if (ticketSales > 0) {
        runningBalance += ticketSales;
        ledgerEntries.push({
          id: `fin-r${roundNumber}-ticket-${Date.now()}-1`,
          clubId: userClub.id,
          date: userSimulatedMatch.date,
          round: roundNumber,
          season: season.year,
          type: 'INCOME',
          inOut: 'CREDIT',
          category: 'BILHETERIA',
          transactionType: 'Receita de Matchday',
          description: `Bilheteria e Consumo no Estádio (Público: ${attendance.toLocaleString('pt-BR')} - Ocupação: ${occupancyRate}%)`,
          amount: ticketSales,
          balanceAfter: runningBalance,
          origin: 'MOTOR_TEMPORADA',
        });
      }

      if (tvRights > 0) {
        runningBalance += tvRights;
        ledgerEntries.push({
          id: `fin-r${roundNumber}-tv-${Date.now()}-2`,
          clubId: userClub.id,
          date: userSimulatedMatch.date,
          round: roundNumber,
          season: season.year,
          type: 'INCOME',
          inOut: 'CREDIT',
          category: 'DIREITOS_TV',
          transactionType: 'Cota de Televisão',
          description: `Cota de Transmissão de TV • Rodada ${roundNumber}`,
          amount: tvRights,
          balanceAfter: runningBalance,
          origin: 'MOTOR_TEMPORADA',
        });
      }

      if (sponsorships > 0) {
        runningBalance += sponsorships;
        ledgerEntries.push({
          id: `fin-r${roundNumber}-sp-${Date.now()}-3`,
          clubId: userClub.id,
          date: userSimulatedMatch.date,
          round: roundNumber,
          season: season.year,
          type: 'INCOME',
          inOut: 'CREDIT',
          category: 'PATROCINIO_RODADA',
          transactionType: 'Patrocínio Oficial',
          description: `Cotas de Patrocínios Ativos (${activeSponsors.length} contratos homologados) • Rodada ${roundNumber}`,
          amount: sponsorships,
          balanceAfter: runningBalance,
          origin: 'MOTOR_TEMPORADA',
        });
      }

      if (leaguePrizeMoney + sponsorBonus > 0) {
        const bonusTotal = leaguePrizeMoney + sponsorBonus;
        runningBalance += bonusTotal;
        ledgerEntries.push({
          id: `fin-r${roundNumber}-prem-${Date.now()}-4`,
          clubId: userClub.id,
          date: userSimulatedMatch.date,
          round: roundNumber,
          season: season.year,
          type: 'INCOME',
          inOut: 'CREDIT',
          category: matchResult === 'WIN' ? 'PREMIACAO_VITORIA' : 'PREMIACAO_EMPATE',
          transactionType: 'Premiação Esportiva',
          description: `Bonificação da Liga e Bônus por ${matchResult === 'WIN' ? 'Vitória' : 'Empate'} contra ${opponentName}`,
          amount: bonusTotal,
          balanceAfter: runningBalance,
          origin: 'MOTOR_TEMPORADA',
        });
      }

      if (merchandising > 0) {
        runningBalance += merchandising;
        ledgerEntries.push({
          id: `fin-r${roundNumber}-merch-${Date.now()}-5`,
          clubId: userClub.id,
          date: userSimulatedMatch.date,
          round: roundNumber,
          season: season.year,
          type: 'INCOME',
          inOut: 'CREDIT',
          category: 'MERCHANDISING',
          transactionType: 'Produtos Oficiais',
          description: `Venda de Camisas e Merchandising • Rodada ${roundNumber}`,
          amount: merchandising,
          balanceAfter: runningBalance,
          origin: 'MOTOR_TEMPORADA',
        });
      }

      // Débitos
      runningBalance -= payrollWageShare;
      ledgerEntries.push({
        id: `fin-r${roundNumber}-wages-${Date.now()}-6`,
        clubId: userClub.id,
        date: userSimulatedMatch.date,
        round: roundNumber,
        season: season.year,
        type: 'EXPENSE',
        inOut: 'DEBIT',
        category: 'FOLHA_SALARIAL_RODADA',
        transactionType: 'Salários do Elenco',
        description: `Rateio de Folha Salarial dos Jogadores Profissionais • Rodada ${roundNumber}`,
        amount: payrollWageShare,
        balanceAfter: runningBalance,
        origin: 'MOTOR_TEMPORADA',
      });

      runningBalance -= staffWageShare;
      ledgerEntries.push({
        id: `fin-r${roundNumber}-staff-${Date.now()}-7`,
        clubId: userClub.id,
        date: userSimulatedMatch.date,
        round: roundNumber,
        season: season.year,
        type: 'EXPENSE',
        inOut: 'DEBIT',
        category: 'STAFF_RODADA',
        transactionType: 'Salários da Comissão e Staff',
        description: `Salários da Comissão Técnica e Funcionários Operacionais • Rodada ${roundNumber}`,
        amount: staffWageShare,
        balanceAfter: runningBalance,
        origin: 'MOTOR_TEMPORADA',
      });

      if (stadiumMaintenance > 0) {
        runningBalance -= stadiumMaintenance;
        ledgerEntries.push({
          id: `fin-r${roundNumber}-stad-${Date.now()}-8`,
          clubId: userClub.id,
          date: userSimulatedMatch.date,
          round: roundNumber,
          season: season.year,
          type: 'EXPENSE',
          inOut: 'DEBIT',
          category: 'MANUTENCAO_ESTADIO',
          transactionType: 'Operação do Estádio',
          description: `Custos de Operação, Segurança e Manutenção do Estádio • Rodada ${roundNumber}`,
          amount: stadiumMaintenance,
          balanceAfter: runningBalance,
          origin: 'MOTOR_TEMPORADA',
        });
      }

      if (travelAndLogistics > 0) {
        runningBalance -= travelAndLogistics;
        ledgerEntries.push({
          id: `fin-r${roundNumber}-travel-${Date.now()}-9`,
          clubId: userClub.id,
          date: userSimulatedMatch.date,
          round: roundNumber,
          season: season.year,
          type: 'EXPENSE',
          inOut: 'DEBIT',
          category: 'LOGISTICA_VIAGEM',
          transactionType: 'Logística de Viagem',
          description: `Transporte, Hospedagem e Logística (Partida como Visitante)`,
          amount: travelAndLogistics,
          balanceAfter: runningBalance,
          origin: 'MOTOR_TEMPORADA',
        });
      }

      if (otherOperational > 0) {
        runningBalance -= otherOperational;
        ledgerEntries.push({
          id: `fin-r${roundNumber}-other-${Date.now()}-10`,
          clubId: userClub.id,
          date: userSimulatedMatch.date,
          round: roundNumber,
          season: season.year,
          type: 'EXPENSE',
          inOut: 'DEBIT',
          category: 'DESPESAS_OPERACIONAIS',
          transactionType: 'Despesas Operacionais',
          description: `Custos Gerais Operacionais e Categorias de Base • Rodada ${roundNumber}`,
          amount: otherOperational,
          balanceAfter: runningBalance,
          origin: 'MOTOR_TEMPORADA',
        });
      }

      // Persiste os registros contábeis no Livro Caixa
      ledgerEntries.forEach((entry) => dataStore.addFinanceRecord(entry));

      // Atualiza o clube com o novo saldo em caixa de liquidez real
      const updatedUserClub: Club = {
        ...userClub,
        balance: newBalance,
        lastAudit: {
          type: 'SEASON_MOTOR_ROUND',
          cost: Math.abs(netAmount),
          previousBalance,
          newBalance,
          timestamp: new Date().toISOString(),
          description: `Avanço da Rodada ${roundNumber} (${matchResult} vs ${opponentName})`,
          idempotencyKey: this.getIdempotencyKey(temporadaId, competicaoId, roundNumber),
        },
        updatedAt: new Date().toISOString(),
      };

      await clubesService.save(updatedUserClub);
      dataStore.saveClub(updatedUserClub);

      // -------------------------------------------------------------
      // 4. ATUALIZAÇÃO DA TABELA DE CLASSIFICAÇÃO OFICIAL (STANDINGS)
      // -------------------------------------------------------------
      const previousPosition =
        competition.standings.find((s) => s.clubId === userClubId)?.position || userClub.leaguePosition || 1;

      const updatedStandings = this.updateCompetitionStandings(competition.standings, simulatedMatches);
      const newPosition =
        updatedStandings.find((s) => s.clubId === userClubId)?.position || previousPosition;

      // Salva a competição atualizada
      const updatedCompetition: Competition = {
        ...competition,
        currentRound: Math.min(competition.roundsCount, roundNumber + 1),
        standings: updatedStandings,
        status: roundNumber >= competition.roundsCount ? 'FINALIZADA' : 'EM_ANDAMENTO',
      };
      await competicoesService.save(updatedCompetition);

      // Marca esta rodada como processada (Idempotência estrita: temporadaId + competicaoId + rodada)
      this.markRoundProcessed(temporadaId, competicaoId, roundNumber);

      // Log do SNAPSHOT DEPOIS DA EXECUÇÃO
      console.log('====================================================');
      console.log('🏁 SNAPSHOT DEPOIS DA EXECUÇÃO DO MOTOR DE TEMPORADA:');
      console.log(`PLACAR: ${userSimulatedMatch.homeClubName} ${userSimulatedMatch.homeScore} x ${userSimulatedMatch.awayScore} ${userSimulatedMatch.awayClubName}`);
      console.log(`PÚBLICO: ${attendance.toLocaleString('pt-BR')} torcedores (${occupancyRate}% de ocupação)`);
      console.log(`BILHETERIA: R$ ${ticketSales.toLocaleString('pt-BR')}`);
      console.log(`TV: R$ ${tvRights.toLocaleString('pt-BR')}`);
      console.log(`PATROCÍNIOS: R$ ${sponsorships.toLocaleString('pt-BR')}`);
      console.log(`BÔNUS: R$ ${(sponsorBonus + leaguePrizeMoney).toLocaleString('pt-BR')}`);
      console.log(`DESPESAS: R$ ${totalExpense.toLocaleString('pt-BR')}`);
      console.log(`RESULTADO FINANCEIRO: ${netAmount >= 0 ? '+' : ''}R$ ${netAmount.toLocaleString('pt-BR')}`);
      console.log(`SALDO ANTERIOR: R$ ${previousBalance.toLocaleString('pt-BR')}`);
      console.log(`SALDO ATUAL: R$ ${newBalance.toLocaleString('pt-BR')}`);
      console.log(`POSIÇÃO NA TABELA: ${newPosition}º lugar (era ${previousPosition}º)`);
      console.log('====================================================');

      // Cria notificação informativa para o Manager
      await notificacoesService.create({
        clubId: userClub.id,
        title: `Rodada ${roundNumber} Concluída: ${userGoals} x ${opponentGoals} vs ${opponentName}`,
        message: `Resultado: ${matchResult === 'WIN' ? 'Vitória! 3 pontos somados.' : matchResult === 'DRAW' ? 'Empate. 1 ponto somado.' : 'Derrota.'} Saldo em caixa atualizado para R$ ${newBalance.toLocaleString('pt-BR')}.`,
        type: matchResult === 'WIN' ? 'SUCCESS' : matchResult === 'DRAW' ? 'INFO' : 'WARNING',
        date: userSimulatedMatch.date,
      });

      const financialBreakdown: RoundFinancialBreakdown = {
        clubId: userClub.id,
        clubName: userClub.name,
        roundNumber,
        seasonYear: season.year,
        matchId: userSimulatedMatch.id,
        isHomeMatch,
        matchResult,
        scoreFormatted: `${userGoals} x ${opponentGoals}`,
        opponentId,
        opponentName,
        attendance,
        stadiumCapacity,
        occupancyRate,
        incomes: {
          ticketSales,
          tvRights,
          sponsorships,
          bonuses: sponsorBonus,
          prizeMoney: leaguePrizeMoney,
          merchandising,
          totalIncome,
        },
        expenses: {
          payrollWageShare,
          staffWageShare,
          stadiumMaintenance,
          travelAndLogistics,
          otherOperational,
          totalExpense,
        },
        netAmount,
        previousBalance,
        newBalance,
        ledgerEntries,
      };

      const highlights = userSimulatedMatch.events
        .filter((e) => e.type === 'GOAL')
        .map((e) => `${e.minute}' Gol de ${e.playerName} (${e.detail || 'Finalização'})`);

      const roundSummaryResult: RoundSummaryData = {
        round: roundNumber,
        seasonYear: season.year,
        competitionId: competition.id,
        competitionName: competition.name,
        userMatch: userSimulatedMatch,
        allMatches: simulatedMatches,
        financialBreakdown,
        updatedStandings,
        previousPosition,
        newPosition,
        eventsHighlights: highlights,
      };

      // 14. Registrar a rodada no Histórico Oficial
      dataStore.addRoundHistory(roundSummaryResult);

      return roundSummaryResult;
    } finally {
      this.processingLock = false;
    }
  }

  /**
   * Atualiza a tabela de classificação de acordo com os resultados dos jogos da rodada.
   */
  private updateCompetitionStandings(
    currentStandings: ClubStanding[],
    matches: Match[]
  ): ClubStanding[] {
    const standingsMap = new Map<string, ClubStanding>();

    currentStandings.forEach((s) => {
      standingsMap.set(s.clubId, { ...s, form: [...(s.form || [])] });
    });

    matches.forEach((m) => {
      if (m.homeScore === undefined || m.awayScore === undefined) return;

      const homeId = m.homeClubId;
      const awayId = m.awayClubId;

      if (!standingsMap.has(homeId)) {
        standingsMap.set(homeId, {
          position: 0,
          clubId: homeId,
          clubName: m.homeClubName,
          clubSlug: homeId,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          points: 0,
          form: [],
        });
      }

      if (!standingsMap.has(awayId)) {
        standingsMap.set(awayId, {
          position: 0,
          clubId: awayId,
          clubName: m.awayClubName,
          clubSlug: awayId,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          points: 0,
          form: [],
        });
      }

      const home = standingsMap.get(homeId)!;
      const away = standingsMap.get(awayId)!;

      home.played += 1;
      away.played += 1;

      home.goalsFor += m.homeScore;
      home.goalsAgainst += m.awayScore;
      home.goalDifference = home.goalsFor - home.goalsAgainst;

      away.goalsFor += m.awayScore;
      away.goalsAgainst += m.homeScore;
      away.goalDifference = away.goalsFor - away.goalsAgainst;

      if (m.homeScore > m.awayScore) {
        home.won += 1;
        home.points += 3;
        home.form.push('W');

        away.lost += 1;
        away.form.push('L');
      } else if (m.homeScore < m.awayScore) {
        away.won += 1;
        away.points += 3;
        away.form.push('W');

        home.lost += 1;
        home.form.push('L');
      } else {
        home.drawn += 1;
        home.points += 1;
        home.form.push('D');

        away.drawn += 1;
        away.points += 1;
        away.form.push('D');
      }

      // Mantém últimos 5 jogos na forma
      if (home.form.length > 5) home.form = home.form.slice(-5);
      if (away.form.length > 5) away.form = away.form.slice(-5);
    });

    const sorted = Array.from(standingsMap.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return b.won - a.won;
    });

    sorted.forEach((item, index) => {
      item.position = index + 1;
    });

    return sorted;
  }
}

export const seasonMotorService = new SeasonMotorService();
