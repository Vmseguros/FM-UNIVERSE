import { Match, Club, Player, TacticSetup, MatchEvent, MatchStats } from '../types';

export interface SimulationTeamContext {
  club: Club;
  tactic?: TacticSetup | null;
  players?: Player[];
  isHome: boolean;
}

export class MatchSimulationService {
  /**
   * Calcula o poderio geral da equipe considerando elenco, reputação e postura tática.
   */
  private calculateTeamPower(ctx: SimulationTeamContext): { power: number; attackPower: number; defensePower: number } {
    const { club, tactic, players, isHome } = ctx;

    // 1. Força baseada em elenco titular ou reputação
    let baseOverall = 78;
    if (players && players.length > 0) {
      const top11 = [...players].sort((a, b) => b.overall - a.overall).slice(0, 11);
      const avgOvr = top11.reduce((sum, p) => sum + p.overall, 0) / top11.length;
      baseOverall = Math.round(avgOvr);
    } else if (club.reputation) {
      baseOverall = Math.round(club.reputation > 50 ? club.reputation : 75 + club.reputation * 0.15);
    }

    let attackBonus = 0;
    let defenseBonus = 0;

    // 2. Influência tática
    if (tactic) {
      const mentality = (tactic.mentality || '').toLowerCase();
      if (mentality.includes('muito ofensiva')) {
        attackBonus += 4;
        defenseBonus -= 3;
      } else if (mentality.includes('ofensiva')) {
        attackBonus += 2;
        defenseBonus -= 1;
      } else if (mentality.includes('defensiva') || mentality.includes('cautelosa')) {
        attackBonus -= 2;
        defenseBonus += 3;
      } else if (mentality.includes('contra-ataque')) {
        attackBonus += 1;
        defenseBonus += 2;
      }
    }

    // 3. Fator Mando de Campo (Mundialmente reconhecido em ~+3 a +5 pontos de poder)
    const homeAdvantage = isHome ? 3.5 : 0;

    const finalAttack = Math.max(50, baseOverall + attackBonus + (isHome ? 2 : 0));
    const finalDefense = Math.max(50, baseOverall + defenseBonus + (isHome ? 2 : 0));
    const finalPower = baseOverall + homeAdvantage + (attackBonus + defenseBonus) * 0.5;

    return {
      power: finalPower,
      attackPower: finalAttack,
      defensePower: finalDefense,
    };
  }

  /**
   * Gera gols realistas usando distribuição probabilística fundamentada em xG de futebol real.
   */
  private generateGoals(attackPower: number, opponentDefensePower: number): number {
    const diff = (attackPower - opponentDefensePower) / 10;
    // Expected goals base entre 1.0 e 2.0 dependendo da diferença
    const xG = Math.max(0.4, Math.min(3.8, 1.4 + diff * 0.45));

    // Simulação determinística com variabilidade controlada
    let goals = 0;
    for (let i = 0; i < 6; i++) {
      const chance = (xG / 6) * (1 + (Math.random() * 0.4 - 0.2));
      if (Math.random() < chance) {
        goals++;
      }
    }
    return goals;
  }

  /**
   * Simula uma partida completa de forma coerente e com integridade de dados.
   */
  public simulateMatch(
    match: Match,
    homeClub: Club,
    awayClub: Club,
    homeTactic?: TacticSetup | null,
    awayTactic?: TacticSetup | null,
    homePlayers: Player[] = [],
    awayPlayers: Player[] = [],
    averageTicketPrice: number = 80,
    expectedOccupancyRate: number = 85
  ): Match {
    const homePower = this.calculateTeamPower({
      club: homeClub,
      tactic: homeTactic,
      players: homePlayers,
      isHome: true,
    });

    const awayPower = this.calculateTeamPower({
      club: awayClub,
      tactic: awayTactic,
      players: awayPlayers,
      isHome: false,
    });

    const homeScore = this.generateGoals(homePower.attackPower, awayPower.defensePower);
    const awayScore = this.generateGoals(awayPower.attackPower, homePower.defensePower);

    // Cálculo do público pagante
    // REGRA DE OURO: O público JAMAIS pode ultrapassar a capacidade real do estádio!
    const stadiumCapacity = Math.max(1000, homeClub.capacity || 50000);
    const variance = (Math.random() * 12 - 6); // -6% a +6%
    const finalOccupancy = Math.max(50, Math.min(99, expectedOccupancyRate + variance));
    const calculatedAttendance = Math.round((stadiumCapacity * finalOccupancy) / 100);
    // Garantia estrita de teto pela capacidade do estádio
    const attendance = Math.min(stadiumCapacity, calculatedAttendance);

    const ticketRevenue = attendance * (averageTicketPrice || 80);

    // Geração de Eventos da Partida (Gols, Cartões)
    const events: MatchEvent[] = [];

    // Seletores de artilheiros potenciais
    const getScorer = (players: Player[], club: Club): { id: string; name: string } => {
      if (players && players.length > 0) {
        const attackers = players.filter((p) => p.positionCategory === 'ATACANTE' || p.positionCategory === 'MEIO-CAMPISTA');
        const pool = attackers.length > 0 ? attackers : players;
        const selected = pool[Math.floor(Math.random() * pool.length)];
        return { id: selected.id, name: selected.knownAs || selected.name };
      }
      return { id: `scorer-${club.id}`, name: `${club.shortName || club.code || 'Jogador'} Artilheiro` };
    };

    // Minutos de gols distribuídos
    const goalMinutes: { minute: number; team: 'HOME' | 'AWAY' }[] = [];
    for (let i = 0; i < homeScore; i++) {
      goalMinutes.push({ minute: Math.floor(Math.random() * 88) + 2, team: 'HOME' });
    }
    for (let i = 0; i < awayScore; i++) {
      goalMinutes.push({ minute: Math.floor(Math.random() * 88) + 2, team: 'AWAY' });
    }
    goalMinutes.sort((a, b) => a.minute - b.minute);

    const goalDetails = [
      'Finalização colocada no ângulo',
      'Chute cruzado rasteiro',
      'Cabeceio fulminante após escanteio',
      'Contra-ataque em velocidade',
      'Cobrança de falta magistral',
      'Pênalti convertido com categoria',
      'Chute potente de fora da área',
      'Tabelinha rápida e toque por cobertura',
    ];

    goalMinutes.forEach((g, idx) => {
      const isHomeTeam = g.team === 'HOME';
      const targetClub = isHomeTeam ? homeClub : awayClub;
      const targetPlayers = isHomeTeam ? homePlayers : awayPlayers;
      const scorer = getScorer(targetPlayers, targetClub);

      events.push({
        id: `ev-${match.id}-${idx + 1}`,
        minute: g.minute,
        type: 'GOAL',
        teamId: targetClub.id,
        playerId: scorer.id,
        playerName: scorer.name,
        detail: goalDetails[Math.floor(Math.random() * goalDetails.length)],
      });
    });

    // Cartões amarelos eventuais
    const yellowCardsCount = Math.floor(Math.random() * 4) + 1;
    for (let c = 0; c < yellowCardsCount; c++) {
      const isHome = Math.random() > 0.48;
      const targetClub = isHome ? homeClub : awayClub;
      const targetPlayers = isHome ? homePlayers : awayPlayers;
      const player = getScorer(targetPlayers, targetClub);
      events.push({
        id: `ev-card-${match.id}-${c}`,
        minute: Math.floor(Math.random() * 85) + 5,
        type: 'YELLOW_CARD',
        teamId: targetClub.id,
        playerId: player.id,
        playerName: player.name,
        detail: 'Falta tática para interromper ataque promissor',
      });
    }

    // Estatísticas coerentes da partida
    const homePossession = Math.round(Math.max(35, Math.min(68, 50 + (homePower.power - awayPower.power) * 1.5 + (Math.random() * 8 - 4))));
    const awayPossession = 100 - homePossession;

    const homeShots = Math.max(homeScore + 2, Math.round(homeScore * 2.5 + Math.random() * 8 + 4));
    const awayShots = Math.max(awayScore + 2, Math.round(awayScore * 2.5 + Math.random() * 8 + 3));

    const homeOnTarget = Math.max(homeScore, Math.min(homeShots, Math.round(homeScore + (homeShots - homeScore) * 0.45)));
    const awayOnTarget = Math.max(awayScore, Math.min(awayShots, Math.round(awayScore + (awayShots - awayScore) * 0.45)));

    const stats: MatchStats = {
      possession: [homePossession, awayPossession],
      shots: [homeShots, awayShots],
      shotsOnTarget: [homeOnTarget, awayOnTarget],
      fouls: [Math.floor(Math.random() * 8) + 8, Math.floor(Math.random() * 8) + 9],
      corners: [Math.floor(Math.random() * 6) + 3, Math.floor(Math.random() * 6) + 2],
      offsides: [Math.floor(Math.random() * 3), Math.floor(Math.random() * 3)],
      passesAccuracy: [Math.floor(Math.random() * 10) + 80, Math.floor(Math.random() * 10) + 78],
    };

    return {
      ...match,
      status: 'FINISHED',
      homeScore,
      awayScore,
      attendance,
      ticketRevenue,
      events: events.sort((a, b) => a.minute - b.minute),
      stats,
    };
  }
}

export const matchSimulationService = new MatchSimulationService();
