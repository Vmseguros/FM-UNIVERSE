import { Match, Competition, Club } from '../types';
import { jogosService } from './jogosService';
import { competicoesService } from './competicoesService';
import { participantesService } from './participantesService';

export interface CalendarGenerationOptions {
  competitionId: string;
  seasonId?: string;
  legs?: 'TURNO_UNICO' | 'TURNO_E_RETURNO';
  baseStartDate?: string;
  selectedClubIds?: string[];
  allowAdministrativeRevision?: boolean;
}

// Club IDs explicitamente permitidos na competição oficial (6 clubes)
const ALLOWED_CLUB_IDS = [
  'club-1', // FM United
  'club-2', // Real Football
  'club-3', // Inter Tech
  'club-4', // Porto Real
  'club-5', // Santos Stars
  'club-qowYWnG0EfUqrr1a5cHlu4UYmNB3', // Thales FC
];

// Nomes ou IDs de clubes que NÃO podem constar no calendário
const BANNED_CLUB_IDENTIFIERS = [
  'atlético fc',
  'atletico fc',
  'atlântico fc',
  'atlantico fc',
  'real madrid',
  'club-6',
  'club-real-madrid',
];

// Tabela Canônica Berger para 6 clubes (0 a 5)
// 5 rodadas no 1º turno, 3 jogos por rodada
const CANONICAL_BERGER_6: [number, number][][] = [
  // Rodada 1: C0 x C5, C1 x C4, C2 x C3
  [[0, 5], [1, 4], [2, 3]],
  // Rodada 2: C5 x C3, C4 x C2, C0 x C1
  [[5, 3], [4, 2], [0, 1]],
  // Rodada 3: C1 x C5, C2 x C0, C3 x C4
  [[1, 5], [2, 0], [3, 4]],
  // Rodada 4: C5 x C4, C0 x C3, C1 x C2
  [[5, 4], [0, 3], [1, 2]],
  // Rodada 5: C2 x C5, C3 x C1, C4 x C0
  [[2, 5], [3, 1], [4, 0]],
];

export const calendarioService = {
  /**
   * Gera o calendário oficial de confrontos no formato TODOS CONTRA TODOS (Round-Robin)
   * Garante:
   * - 6 clubes participantes oficiais exclusivamente (FM United, Real Football, Inter Tech, Porto Real, Santos Stars, Thales FC)
   * - Atlântico FC, Atlético FC e Real Madrid excluídos
   * - 10 rodadas (5 no turno, 5 no returno)
   * - Exatamente 3 partidas por rodada (30 partidas no total)
   * - Todos os 6 clubes jogando exatamente 1 vez por rodada
   * - Nenhum confronto duplicado no mesmo turno
   * - Returno com inversão rigorosa de mando de campo (CASA x FORA)
   * - Mando de campo equilibrado (5 em casa, 5 fora para cada clube)
   * - Estádio oficial do mandante correto em cada partida
   */
  async generateRoundRobinCalendar(options: CalendarGenerationOptions): Promise<Match[]> {
    const {
      competitionId,
      seasonId = 's-2026',
      legs = 'TURNO_E_RETURNO',
      baseStartDate = '2026-08-08',
      selectedClubIds,
      allowAdministrativeRevision = false,
    } = options;

    const competition = await competicoesService.getById(competitionId);
    if (!competition) {
      throw new Error(`Competição "${competitionId}" não encontrada.`);
    }

    if (competition.calendarStatus === 'HOMOLOGADO' && !allowAdministrativeRevision) {
      throw new Error('Não é possível regerar um calendário já HOMOLOGADO sem antes revertê-lo para Rascunho.');
    }

    // Se estiver homologado e revisão administrativa foi autorizada, reabre para rascunho
    if (competition.calendarStatus === 'HOMOLOGADO' && allowAdministrativeRevision) {
      await this.revertToDraft(competitionId, true);
    }

    // Busca os clubes da competição ou usa a seleção
    let clubs: Club[] = [];
    if (selectedClubIds && selectedClubIds.length > 0) {
      const allClubs = await participantesService.getClubsByCompetition(competitionId);
      clubs = allClubs.filter((c) => selectedClubIds.includes(c.id));
      if (clubs.length < selectedClubIds.length) {
        // Busca do dataStore/clubesService se faltar algum
        const fullClubs = await (await import('./clubesService')).clubesService.getAll();
        clubs = fullClubs.filter((c) => selectedClubIds.includes(c.id));
      }
    } else {
      clubs = await participantesService.getClubsByCompetition(competitionId);
    }

    // Filtra para remover qualquer clube banido (Atlântico FC, Atlético FC, Real Madrid)
    clubs = clubs.filter((c) => {
      const nameLower = c.name.toLowerCase();
      const isBanned = BANNED_CLUB_IDENTIFIERS.some(
        (b) => nameLower.includes(b) || c.id.toLowerCase() === b
      );
      return !isBanned;
    });

    // Se faltar algum dos 6 clubes oficiais autorizados, complementa a partir dos clubes cadastrados
    const fullClubs = await (await import('./clubesService')).clubesService.getAll();
    for (const allowedId of ALLOWED_CLUB_IDS) {
      if (!clubs.some((c) => c.id === allowedId)) {
        const found = fullClubs.find((c) => c.id === allowedId);
        if (found) clubs.push(found);
      }
    }

    // Ordenação canônica determinística para a tabela Berger
    clubs.sort((a, b) => {
      const idxA = ALLOWED_CLUB_IDS.indexOf(a.id);
      const idxB = ALLOWED_CLUB_IDS.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      return a.name.localeCompare(b.name);
    });

    if (clubs.length < 2) {
      throw new Error(`São necessários ao menos 2 clubes participantes para gerar a tabela. Atual: ${clubs.length}.`);
    }

    const generatedMatches: Match[] = [];

    // Helper para adicionar dias a uma data base
    const addDays = (startDateStr: string, days: number): string => {
      const d = new Date(startDateStr);
      d.setDate(d.getDate() + days);
      return d.toISOString().split('T')[0];
    };

    const timeSlots = ['16:00', '18:30', '21:00'];

    if (clubs.length === 6) {
      // 1º TURNO (Rodadas 1 a 5) usando a matriz Canônica Berger para 6 clubes
      for (let r = 0; r < CANONICAL_BERGER_6.length; r++) {
        const roundNumber = r + 1;
        const roundDate = addDays(baseStartDate, r * 7);
        const pairings = CANONICAL_BERGER_6[r];

        for (let m = 0; m < pairings.length; m++) {
          const [homeIdx, awayIdx] = pairings[m];
          const homeTeam = clubs[homeIdx];
          const awayTeam = clubs[awayIdx];

          const matchId = `match-${competitionId}-r${roundNumber}-${homeTeam.id.slice(-4)}-${awayTeam.id.slice(-4)}`;

          const match: Match = {
            id: matchId,
            temporadaId: seasonId,
            seasonId: seasonId,
            competicaoId: competitionId,
            competitionId: competitionId,
            competitionName: competition.name,
            season: competition.season,
            round: roundNumber,
            rodada: roundNumber,
            date: roundDate,
            time: timeSlots[m % timeSlots.length],
            homeClubId: homeTeam.id,
            homeClubName: homeTeam.name,
            awayClubId: awayTeam.id,
            awayClubName: awayTeam.name,
            stadiumId: homeTeam.stadiumId || 'stad-default',
            stadiumName: homeTeam.stadiumName || 'Estádio Principal',
            status: 'SCHEDULED',
            events: [],
          };

          generatedMatches.push(match);
        }
      }

      // 2º TURNO (RETURNO - Rodadas 6 a 10): Mando estritamente invertido
      if (legs === 'TURNO_E_RETURNO') {
        const returnoBaseDate = addDays(baseStartDate, 5 * 7); // Continua 7 dias após a rodada 5

        for (let r = 0; r < CANONICAL_BERGER_6.length; r++) {
          const returnoRoundNumber = 5 + r + 1; // Rodadas 6 a 10
          const returnoDate = addDays(returnoBaseDate, r * 7);
          const turnoMatches = generatedMatches.filter((m) => m.round === r + 1);

          for (let m = 0; m < turnoMatches.length; m++) {
            const original = turnoMatches[m];
            const newHomeClub = clubs.find((c) => c.id === original.awayClubId)!;
            const newAwayClub = clubs.find((c) => c.id === original.homeClubId)!;

            const matchId = `match-${competitionId}-r${returnoRoundNumber}-${newHomeClub.id.slice(-4)}-${newAwayClub.id.slice(-4)}`;

            const returnoMatch: Match = {
              id: matchId,
              temporadaId: seasonId,
              seasonId: seasonId,
              competicaoId: competitionId,
              competitionId: competitionId,
              competitionName: competition.name,
              season: competition.season,
              round: returnoRoundNumber,
              rodada: returnoRoundNumber,
              date: returnoDate,
              time: original.time,
              homeClubId: newHomeClub.id,
              homeClubName: newHomeClub.name,
              awayClubId: newAwayClub.id,
              awayClubName: newAwayClub.name,
              stadiumId: newHomeClub.stadiumId || 'stad-default',
              stadiumName: newHomeClub.stadiumName || 'Estádio Principal',
              status: 'SCHEDULED',
              events: [],
            };

            generatedMatches.push(returnoMatch);
          }
        }
      }
    } else {
      // Fallback genérico Circle Method para N diferente de 6
      const teamList: (Club | null)[] = [...clubs];
      if (teamList.length % 2 !== 0) teamList.push(null);
      const numTeams = teamList.length;
      const numRoundsTurno = numTeams - 1;
      const matchesPerRound = numTeams / 2;
      const teams = [...teamList];

      for (let round = 0; round < numRoundsTurno; round++) {
        const roundNumber = round + 1;
        const matchDate = addDays(baseStartDate, round * 7);

        for (let m = 0; m < matchesPerRound; m++) {
          let homeTeam = teams[m];
          let awayTeam = teams[numTeams - 1 - m];

          if (m === 0) {
            if (round % 2 === 1) {
              const temp = homeTeam;
              homeTeam = awayTeam;
              awayTeam = temp;
            }
          } else if (round % 2 === 1) {
            const temp = homeTeam;
            homeTeam = awayTeam;
            awayTeam = temp;
          }

          if (!homeTeam || !awayTeam) continue;

          const matchId = `match-${competitionId}-r${roundNumber}-${homeTeam.id.slice(-4)}-${awayTeam.id.slice(-4)}`;
          generatedMatches.push({
            id: matchId,
            temporadaId: seasonId,
            seasonId: seasonId,
            competicaoId: competitionId,
            competitionId: competitionId,
            competitionName: competition.name,
            season: competition.season,
            round: roundNumber,
            rodada: roundNumber,
            date: matchDate,
            time: timeSlots[m % timeSlots.length],
            homeClubId: homeTeam.id,
            homeClubName: homeTeam.name,
            awayClubId: awayTeam.id,
            awayClubName: awayTeam.name,
            stadiumId: homeTeam.stadiumId || 'stad-default',
            stadiumName: homeTeam.stadiumName || 'Estádio Principal',
            status: 'SCHEDULED',
            events: [],
          });
        }

        const lastTeam = teams.pop();
        if (lastTeam !== undefined) teams.splice(1, 0, lastTeam);
      }

      if (legs === 'TURNO_E_RETURNO') {
        const returnoBaseDate = addDays(baseStartDate, numRoundsTurno * 7);
        for (let round = 0; round < numRoundsTurno; round++) {
          const returnoRoundNumber = numRoundsTurno + round + 1;
          const returnoDate = addDays(returnoBaseDate, round * 7);
          const turnoMatches = generatedMatches.filter((m) => m.round === round + 1);

          for (let m = 0; m < turnoMatches.length; m++) {
            const original = turnoMatches[m];
            const newHomeClub = clubs.find((c) => c.id === original.awayClubId);
            const newAwayClub = clubs.find((c) => c.id === original.homeClubId);
            if (!newHomeClub || !newAwayClub) continue;

            const matchId = `match-${competitionId}-r${returnoRoundNumber}-${newHomeClub.id.slice(-4)}-${newAwayClub.id.slice(-4)}`;
            generatedMatches.push({
              id: matchId,
              temporadaId: seasonId,
              seasonId: seasonId,
              competicaoId: competitionId,
              competitionId: competitionId,
              competitionName: competition.name,
              season: competition.season,
              round: returnoRoundNumber,
              rodada: returnoRoundNumber,
              date: returnoDate,
              time: original.time,
              homeClubId: newHomeClub.id,
              homeClubName: newHomeClub.name,
              awayClubId: newAwayClub.id,
              awayClubName: newAwayClub.name,
              stadiumId: newHomeClub.stadiumId || 'stad-default',
              stadiumName: newHomeClub.stadiumName || 'Estádio Principal',
              status: 'SCHEDULED',
              events: [],
            });
          }
        }
      }
    }

    // Substitui com integridade atômica todas as partidas da competição pelas 30 geradas
    await jogosService.replaceMatchesForCompetition(competitionId, generatedMatches);

    // Atualiza metadados da competição para RASCUNHO / EM REVISÃO
    const totalRounds = legs === 'TURNO_E_RETURNO' ? 10 : 5;
    await competicoesService.save({
      ...competition,
      roundsCount: totalRounds,
      teamsCount: clubs.length,
      format: 'TODOS_CONTRA_TODOS',
      legs,
      calendarStatus: 'RASCUNHO',
      calendarHomologatedAt: undefined,
      calendarHomologatedBy: undefined,
    });

    return generatedMatches;
  },

  /**
   * Homologa o calendário oficial da competição
   */
  async homologateCalendar(competitionId: string, adminName: string = 'Admin FM Universe'): Promise<void> {
    const comp = await competicoesService.getById(competitionId);
    if (!comp) {
      throw new Error(`Competição "${competitionId}" não encontrada.`);
    }

    const matches = (await jogosService.getAll()).filter((m) => m.competitionId === competitionId);
    if (matches.length === 0) {
      throw new Error('Não há partidas geradas no calendário para homologação.');
    }

    const participants = await participantesService.getByCompetition(competitionId);
    if (participants.length < 2) {
      throw new Error('A competição deve ter ao menos 2 participantes homologados.');
    }

    // Atualiza status de participantes para HOMOLOGADO
    await participantesService.homologateParticipants(competitionId);

    // Homologa a competição
    await competicoesService.save({
      ...comp,
      calendarStatus: 'HOMOLOGADO',
      calendarHomologatedAt: new Date().toISOString(),
      calendarHomologatedBy: adminName,
    });
  },

  /**
   * Reverte o calendário para status Rascunho
   * @param allowOverride Permite reabrir administrativamente mesmo que existam partidas
   */
  async revertToDraft(competitionId: string, allowOverride: boolean = false): Promise<void> {
    const comp = await competicoesService.getById(competitionId);
    if (!comp) return;

    const matches = (await jogosService.getAll()).filter((m) => m.competitionId === competitionId);
    const hasFinished = matches.some((m) => m.status === 'FINISHED');
    if (hasFinished && !allowOverride) {
      throw new Error('Não é possível reverter o calendário para Rascunho pois já existem partidas finalizadas nesta temporada.');
    }

    await competicoesService.save({
      ...comp,
      calendarStatus: 'RASCUNHO',
      calendarHomologatedAt: undefined,
      calendarHomologatedBy: undefined,
    });
  },

  /**
   * Obtém todas as partidas de uma competição agrupadas e ordenadas por rodada
   */
  async getCalendarByCompetition(competitionId: string): Promise<Match[]> {
    const all = await jogosService.getAll();
    return all
      .filter((m) => m.competitionId === competitionId || (!m.competitionId && competitionId === 'comp-1'))
      .sort((a, b) => a.round - b.round);
  },

  /**
   * Atualiza data, horário ou campos de uma partida
   */
  async updateMatch(matchId: string, partial: Partial<Match>): Promise<void> {
    await jogosService.update(matchId, partial);
  },

  /**
   * Remove uma partida do calendário
   */
  async deleteMatch(matchId: string): Promise<void> {
    await jogosService.delete(matchId);
  },

  /**
   * Adiciona uma nova partida ao calendário
   */
  async addMatch(match: Match): Promise<void> {
    await jogosService.save(match);
  },

  /**
   * Inverte mandante e visitante de uma partida, atualizando o estádio oficial
   */
  async swapMatchHomeAway(matchId: string): Promise<Match> {
    const match = await jogosService.getById(matchId);
    if (!match) {
      throw new Error(`Partida "${matchId}" não encontrada.`);
    }

    const clubs = await participantesService.getClubsByCompetition(match.competitionId);
    const newHomeClub = clubs.find((c) => c.id === match.awayClubId);
    const newAwayClub = clubs.find((c) => c.id === match.homeClubId);

    const updated: Match = {
      ...match,
      homeClubId: match.awayClubId,
      homeClubName: match.awayClubName,
      awayClubId: match.homeClubId,
      awayClubName: match.homeClubName,
      stadiumId: newHomeClub?.stadiumId || match.stadiumId,
      stadiumName: newHomeClub?.stadiumName || (newHomeClub ? `Estádio do ${newHomeClub.name}` : match.stadiumName),
    };

    await jogosService.save(updated);
    return updated;
  },
};
