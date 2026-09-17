import { Club, ClubFinancialConfig, SponsorContract, FinancialAuditEntry, FinancialAuditFieldChange } from '../types';
import { isFirebaseConfigured, firestoreDb, getFirestoreDb } from '../config/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { dataStore } from './dataStore';
import { clubesService } from './clubesService';

function computeFieldChanges(prev: ClubFinancialConfig, next: ClubFinancialConfig): FinancialAuditFieldChange[] {
  const changes: FinancialAuditFieldChange[] = [];

  const compare = (fieldLabel: string, fieldName: string, pVal: any, nVal: any) => {
    if (pVal !== nVal) {
      changes.push({
        fieldName,
        fieldLabel,
        previousValue: pVal !== undefined && pVal !== null ? pVal : '-',
        newValue: nVal !== undefined && nVal !== null ? nVal : '-',
      });
    }
  };

  compare('Caixa Inicial', 'initialCash', prev.initialCash, next.initialCash);
  compare('Saldo Inicial da Temporada', 'initialSeasonBudget', prev.initialSeasonBudget, next.initialSeasonBudget);
  compare('Orçamento de Transferências', 'transferBudget', prev.transferBudget, next.transferBudget);
  compare('Teto Salarial Mensal', 'wageBudget', prev.wageBudget, next.wageBudget);
  compare('Verba para Montagem de Elenco', 'squadBudget', prev.squadBudget, next.squadBudget);
  compare('Verba para Comissão Técnica', 'coachingStaffBudget', prev.coachingStaffBudget, next.coachingStaffBudget);
  compare('Verba para Staff', 'staffBudget', prev.staffBudget, next.staffBudget);

  compare('Preço Mínimo do Ingresso', 'matchday.ticketMinPrice', prev.matchday?.ticketMinPrice, next.matchday?.ticketMinPrice);
  compare('Preço Médio do Ingresso', 'matchday.ticketAveragePrice', prev.matchday?.ticketAveragePrice, next.matchday?.ticketAveragePrice);
  compare('Preço Máximo do Ingresso', 'matchday.ticketMaxPrice', prev.matchday?.ticketMaxPrice, next.matchday?.ticketMaxPrice);
  compare('Público Esperado', 'matchday.expectedAttendance', prev.matchday?.expectedAttendance, next.matchday?.expectedAttendance);
  compare('Taxa de Ocupação', 'matchday.expectedOccupancyRate', prev.matchday?.expectedOccupancyRate, next.matchday?.expectedOccupancyRate);
  compare('Receita Média Bilheteria', 'matchday.estimatedMatchRevenue', prev.matchday?.estimatedMatchRevenue, next.matchday?.estimatedMatchRevenue);
  compare('Sócio-Torcedor Mensal', 'matchday.memberSubscriptionRevenueMonthly', prev.matchday?.memberSubscriptionRevenueMonthly, next.matchday?.memberSubscriptionRevenueMonthly);

  compare('Cota TV por Rodada', 'tvRights.amountPerRound', prev.tvRights?.amountPerRound, next.tvRights?.amountPerRound);
  compare('Cota TV Mensal', 'tvRights.monthlyQuota', prev.tvRights?.monthlyQuota, next.tvRights?.monthlyQuota);
  compare('Cota TV por Competição', 'tvRights.amountPerCompetition', prev.tvRights?.amountPerCompetition, next.tvRights?.amountPerCompetition);
  compare('Bônus TV Classificação', 'tvRights.bonusQualification', prev.tvRights?.bonusQualification, next.tvRights?.bonusQualification);
  compare('Bônus TV Audiência/PPV', 'tvRights.bonusAudienceShare', prev.tvRights?.bonusAudienceShare, next.tvRights?.bonusAudienceShare);

  compare('Merchandising por Rodada', 'merchandising.revenuePerRound', prev.merchandising?.revenuePerRound, next.merchandising?.revenuePerRound);
  compare('Merchandising Mensal', 'merchandising.monthlyRevenue', prev.merchandising?.monthlyRevenue, next.merchandising?.monthlyRevenue);
  compare('Bônus / Eventos Merchandising', 'merchandising.specialEventsRevenue', prev.merchandising?.specialEventsRevenue, next.merchandising?.specialEventsRevenue);

  compare('Prêmio por Vitória', 'prizes.winPrize', prev.prizes?.winPrize, next.prizes?.winPrize);
  compare('Prêmio por Empate', 'prizes.drawPrize', prev.prizes?.drawPrize, next.prizes?.drawPrize);
  compare('Prêmio por Classificação', 'prizes.qualificationPrize', prev.prizes?.qualificationPrize, next.prizes?.qualificationPrize);
  compare('Prêmio por Título', 'prizes.titlePrize', prev.prizes?.titlePrize, next.prizes?.titlePrize);

  compare('Folha Salarial Atletas', 'expenses.payrollWageMonthly', prev.expenses?.payrollWageMonthly, next.expenses?.payrollWageMonthly);
  compare('Comissão Técnica', 'expenses.coachingStaffWageMonthly', prev.expenses?.coachingStaffWageMonthly, next.expenses?.coachingStaffWageMonthly);
  compare('Staff Operacional', 'expenses.operationalStaffWageMonthly', prev.expenses?.operationalStaffWageMonthly, next.expenses?.operationalStaffWageMonthly);
  compare('Manutenção do Estádio', 'expenses.stadiumMaintenanceMonthly', prev.expenses?.stadiumMaintenanceMonthly, next.expenses?.stadiumMaintenanceMonthly);
  compare('Categorias de Base', 'expenses.youthAcademyMonthly', prev.expenses?.youthAcademyMonthly, next.expenses?.youthAcademyMonthly);
  compare('Logística', 'expenses.travelAndLogisticsPerMatch', prev.expenses?.travelAndLogisticsPerMatch, next.expenses?.travelAndLogisticsPerMatch);
  compare('Outras Despesas Operacionais', 'expenses.otherOperationalExpensesMonthly', prev.expenses?.otherOperationalExpensesMonthly, next.expenses?.otherOperationalExpensesMonthly);

  if (prev.sponsors?.length !== next.sponsors?.length) {
    compare('Total de Patrocinadores', 'sponsors.count', prev.sponsors?.length || 0, next.sponsors?.length || 0);
  }

  return changes;
}

export const adminFinancasService = {
  /**
   * Constrói uma configuração padrão completa para o clube caso ainda não exista uma salva.
   * Respeita rigorosamente os dados validados de cada equipe (especialmente o Thales FC).
   */
  getDefaultConfigForClub(club: Club, seasonYear = '2026/2027'): ClubFinancialConfig {
    const isThales = club.id === 'club-qowYWnG0EfUqrr1a5cHlu4UYmNB3';

    // Parâmetros orçamentários fundamentais
    const initialSeasonBudget = isThales ? 20000000 : (club.balance || 35000000);
    const initialCash = isThales ? 20000000 : (club.balance || 35000000);
    const transferBudget = isThales ? 20000000 : (club.transferBudget || 20000000);
    const wageBudget = isThales ? 4500000 : (club.wageBudget || 3200000);
    const squadBudget = Math.round(initialSeasonBudget * 0.45);
    const coachingStaffBudget = Math.round(initialSeasonBudget * 0.08);
    const staffBudget = Math.round(initialSeasonBudget * 0.05);

    // Parâmetros do estádio e bilheteria
    const capacity = isThales ? 75000 : (club.capacity || 40000);
    const occupancyRate = 82; // 82% média
    const expectedAttendance = Math.round(capacity * (occupancyRate / 100));
    const ticketMinPrice = isThales ? 40 : 30;
    const ticketAveragePrice = isThales ? 85 : 70;
    const ticketMaxPrice = isThales ? 180 : 140;
    const estimatedMatchRevenue = Math.round(expectedAttendance * ticketAveragePrice);

    // Patrocinadores padrão estruturados
    const sponsors: SponsorContract[] = isThales
      ? [
          {
            id: `sp-master-${club.id}`,
            name: 'Universe Bet & Gaming',
            category: 'MASTER',
            contractValue: 24000000,
            paymentMethod: 'MENSAL',
            amountPerRound: 630000,
            monthlyAmount: 2000000,
            bonusWin: 120000,
            bonusDraw: 40000,
            bonusQualification: 600000,
            bonusTitle: 3000000,
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            status: 'ATIVO',
          },
          {
            id: `sp-manga-${club.id}`,
            name: 'AeroSky Global Airlines',
            category: 'MANGA',
            contractValue: 8400000,
            paymentMethod: 'MENSAL',
            amountPerRound: 220000,
            monthlyAmount: 700000,
            bonusWin: 50000,
            bonusDraw: 15000,
            bonusQualification: 200000,
            bonusTitle: 1000000,
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            status: 'ATIVO',
          },
          {
            id: `sp-material-${club.id}`,
            name: 'NovaSport Elite Apparel',
            category: 'MATERIAL_ESPORTIVO',
            contractValue: 14400000,
            paymentMethod: 'A_VISTA',
            amountPerRound: 0,
            monthlyAmount: 1200000,
            bonusWin: 80000,
            bonusDraw: 25000,
            bonusQualification: 400000,
            bonusTitle: 2000000,
            startDate: '2026-01-01',
            endDate: '2027-12-31',
            status: 'ATIVO',
          },
          {
            id: `sp-costas-${club.id}`,
            name: 'FinTech Capital Prime',
            category: 'COSTAS',
            contractValue: 6000000,
            paymentMethod: 'POR_RODADA',
            amountPerRound: 157000,
            monthlyAmount: 500000,
            bonusWin: 30000,
            bonusDraw: 10000,
            bonusQualification: 150000,
            bonusTitle: 800000,
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            status: 'ATIVO',
          },
        ]
      : [
          {
            id: `sp-master-${club.id}`,
            name: 'Patrocinador Master Oficial',
            category: 'MASTER',
            contractValue: 18000000,
            paymentMethod: 'MENSAL',
            amountPerRound: 470000,
            monthlyAmount: 1500000,
            bonusWin: 80000,
            bonusDraw: 25000,
            bonusQualification: 400000,
            bonusTitle: 2000000,
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            status: 'ATIVO',
          },
          {
            id: `sp-manga-${club.id}`,
            name: 'Empresa de Logística Express',
            category: 'MANGA',
            contractValue: 5400000,
            paymentMethod: 'MENSAL',
            amountPerRound: 140000,
            monthlyAmount: 450000,
            bonusWin: 30000,
            bonusDraw: 10000,
            bonusQualification: 150000,
            bonusTitle: 600000,
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            status: 'ATIVO',
          },
        ];

    const initialAudit: FinancialAuditEntry = {
      id: `aud-init-${club.id}-${seasonYear.replace('/', '-')}`,
      clubId: club.id,
      clubName: club.name,
      seasonYear,
      action: 'HOMOLOGATE_SEASON',
      description: `Homologação inicial oficial dos parâmetros econômicos para a Temporada ${seasonYear}.`,
      reason: 'Criação e homologação inicial de parâmetros para abertura de temporada.',
      fieldChanges: [
        { fieldName: 'initialCash', fieldLabel: 'Caixa Inicial', previousValue: 0, newValue: initialCash },
        { fieldName: 'initialSeasonBudget', fieldLabel: 'Saldo Inicial', previousValue: 0, newValue: initialSeasonBudget },
        { fieldName: 'transferBudget', fieldLabel: 'Orçamento Transferências', previousValue: 0, newValue: transferBudget },
        { fieldName: 'wageBudget', fieldLabel: 'Teto Salarial', previousValue: 0, newValue: wageBudget },
      ],
      adminEmail: 'admin@fmuniverse.com',
      adminUid: 'admin-system',
      timestamp: new Date().toISOString(),
    };

    return {
      id: `${club.id}_financial_config_${seasonYear.replace('/', '-')}`,
      clubId: club.id,
      clubName: club.name,
      seasonId: `season-${seasonYear.replace('/', '-')}`,
      seasonYear,

      // Status de Homologação Oficial
      isHomologated: true,
      isOfficial: true,
      status: 'HOMOLOGADA',
      homologatedAt: new Date().toISOString(),
      homologatedBy: 'Admin FM Universe',

      // 1. Orçamento Inicial da Temporada
      initialCash,
      initialSeasonBudget,
      transferBudget,
      wageBudget,
      squadBudget,
      coachingStaffBudget,
      staffBudget,

      // 2. Patrocínios
      sponsors,

      // 3. Bilheteria & Receitas de Jogos
      matchday: {
        ticketMinPrice,
        ticketAveragePrice,
        ticketMaxPrice,
        expectedAttendance,
        expectedOccupancyRate: occupancyRate,
        estimatedMatchRevenue,
        concessionsRevenuePerMatch: Math.round(expectedAttendance * 14), // Média R$ 14 por torcedor
        parkingAndCommercialRevenue: Math.round(expectedAttendance * 6),
        memberSubscriptionRevenueMonthly: isThales ? 1950000 : 1200000,
        merchandisingMonthly: isThales ? 850000 : 420000,
        otherRevenuesMonthly: isThales ? 250000 : 150000,
        otherMatchdayRevenue: 150000,
      },

      // 4. Receitas de TV
      tvRights: {
        amountPerRound: isThales ? 920000 : 750000,
        monthlyQuota: isThales ? 2800000 : 2100000,
        amountPerCompetition: isThales ? 22000000 : 16000000,
        bonusQualification: isThales ? 2000000 : 1200000,
        bonusAudienceShare: isThales ? 550000 : 350000,
        internationalBroadcasting: isThales ? 3500000 : 1800000,
        otherBroadcastingRevenue: 250000,
      },

      // 5. Premiações
      prizes: {
        winPrize: isThales ? 320000 : 250000,
        drawPrize: isThales ? 110000 : 85000,
        qualificationPrize: isThales ? 2800000 : 1800000,
        titlePrize: isThales ? 18000000 : 12000000,
        specificCompetitionPrizes: [
          {
            competitionId: 'comp-brasileirao',
            competitionName: 'Série A FM Universe',
            championPrize: 45000000,
            runnerUpPrize: 28000000,
            participationPrize: 8000000,
          },
          {
            competitionId: 'comp-copa-brasil',
            competitionName: 'Copa Nacional',
            championPrize: 65000000,
            runnerUpPrize: 25000000,
            participationPrize: 3500000,
          },
          {
            competitionId: 'comp-libertadores',
            competitionName: 'Copa Continental',
            championPrize: 95000000,
            runnerUpPrize: 40000000,
            participationPrize: 12000000,
          },
        ],
      },

      // 6. Merchandising
      merchandising: {
        revenuePerRound: isThales ? 95000 : 50000,
        monthlyRevenue: isThales ? 850000 : 420000,
        specialEventsRevenue: isThales ? 300000 : 150000,
      },

      // 7. Despesas Fixas & Operacionais
      expenses: {
        payrollWageMonthly: Math.round(wageBudget * 0.82),
        coachingStaffWageMonthly: Math.round(wageBudget * 0.1),
        operationalStaffWageMonthly: Math.round(wageBudget * 0.05),
        stadiumMaintenanceMonthly: isThales ? 650000 : 450000,
        youthAcademyMonthly: isThales ? 420000 : 250000,
        travelAndLogisticsPerMatch: 180000,
        otherOperationalExpensesMonthly: 150000,
      },

      // 8. Histórico de Auditoria
      auditHistory: [initialAudit],

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: 'Admin FM Universe',
    };
  },

  /**
   * Carrega a configuração financeira do clube via Firestore ou DataStore para a temporada selecionada.
   */
  async getConfigByClubId(clubId: string, seasonYear = '2026/2027'): Promise<ClubFinancialConfig> {
    const db = getFirestoreDb() || firestoreDb;
    if (isFirebaseConfigured() && db) {
      try {
        const clubRef = doc(db, 'clubes', clubId);
        const snap = await getDoc(clubRef);
        if (snap.exists()) {
          const clubData = snap.data() as Club;
          if (clubData.financialConfig) {
            // Se a config do clube corresponder à temporada solicitada, armazena no cache local e retorna
            if (!seasonYear || clubData.financialConfig.seasonYear === seasonYear) {
              dataStore.saveFinancialConfig(clubData.financialConfig);
              return clubData.financialConfig;
            }
          }
        }
      } catch (err) {
        console.warn('Falha ao buscar config financeira do Firestore. Usando cache local.', err);
      }
    }

    // Consulta no DataStore local
    const cached = dataStore.getFinancialConfig(clubId, seasonYear);
    if (cached) {
      return cached;
    }

    // Busca o clube para construir a configuração padrão adequada
    let club = dataStore.getClubById(clubId);
    if (!club) {
      try {
        club = (await clubesService.getById(clubId)) || undefined;
      } catch {
        // ignore
      }
    }

    const fallbackClub: Club = club || {
      id: clubId,
      name: clubId === 'club-qowYWnG0EfUqrr1a5cHlu4UYmNB3' ? 'Thales FC' : 'Clube',
      slug: 'clube',
      shortName: 'CLB',
      code: 'CLB',
      badge: '⚽',
      stadiumId: 'stad-1',
      stadiumName: 'Estádio',
      capacity: clubId === 'club-qowYWnG0EfUqrr1a5cHlu4UYmNB3' ? 75000 : 45000,
      reputation: 80,
      transferBudget: clubId === 'club-qowYWnG0EfUqrr1a5cHlu4UYmNB3' ? 20000000 : 20000000,
      wageBudget: 4500000,
      balance: clubId === 'club-qowYWnG0EfUqrr1a5cHlu4UYmNB3' ? 20000000 : 30000000,
      managerName: 'Manager',
      squadCount: 26,
      fansCount: 150000,
      primaryColor: '#10b981',
      secondaryColor: '#0f172a',
      boardExpectation: 'Título',
      seasonTarget: 'G4',
      trophiesCount: 5,
      foundedYear: 1910,
    };

    const defaultConfig = this.getDefaultConfigForClub(fallbackClub, seasonYear);
    dataStore.saveFinancialConfig(defaultConfig);
    return defaultConfig;
  },

  /**
   * Salva e persiste a configuração financeira editada pelo Administrador.
   * Registra detalhadamente o log de auditoria com os valores anteriores vs novos valores e motivo se informado.
   */
  async saveConfig(
    config: ClubFinancialConfig,
    adminUser?: { email?: string; uid?: string },
    customAction?: FinancialAuditEntry['action'],
    customDescription?: string,
    reason?: string
  ): Promise<ClubFinancialConfig> {
    const prevConfig = dataStore.getFinancialConfig(config.clubId, config.seasonYear);
    const changes = prevConfig ? computeFieldChanges(prevConfig, config) : [];

    const auditEntry: FinancialAuditEntry = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      clubId: config.clubId,
      clubName: config.clubName || 'Clube',
      seasonYear: config.seasonYear,
      action: customAction || 'UPDATE_CONFIG',
      description:
        customDescription ||
        (changes.length > 0
          ? `Atualização de ${changes.length} parâmetros econômicos pelo Administrador.`
          : 'Configuração financeira revisada e confirmada pelo Administrador.'),
      reason: reason?.trim() || undefined,
      fieldChanges: changes,
      adminEmail: adminUser?.email || 'admin@fmuniverse.com',
      adminUid: adminUser?.uid || 'admin',
      timestamp: new Date().toISOString(),
    };

    const existingAudit = config.auditHistory || prevConfig?.auditHistory || [];
    const updatedAuditHistory = [auditEntry, ...existingAudit].slice(0, 50); // Mantém últimos 50 eventos

    const updatedConfig: ClubFinancialConfig = {
      ...config,
      auditHistory: updatedAuditHistory,
      updatedAt: new Date().toISOString(),
      updatedBy: adminUser?.email || 'Admin FM Universe',
    };

    // Salva no DataStore local imediatamente
    dataStore.saveFinancialConfig(updatedConfig);

    // Persiste no Firestore se configurado
    const db = getFirestoreDb() || firestoreDb;
    if (isFirebaseConfigured() && db) {
      try {
        const clubRef = doc(db, 'clubes', config.clubId);
        await updateDoc(clubRef, {
          financialConfig: updatedConfig,
          transferBudget: updatedConfig.transferBudget,
          wageBudget: updatedConfig.wageBudget,
        });
      } catch (err) {
        console.warn('Aviso: persistência Firestore de financialConfig não concluída (modo offline/fallback ativo).', err);
      }
    }

    return updatedConfig;
  },

  /**
   * Salva como Rascunho (ainda não oficial/não homologada).
   * Mantém o status RASCUNHO para continuar edição posterior.
   */
  async saveDraft(
    config: ClubFinancialConfig,
    adminUser?: { email?: string; uid?: string },
    reason?: string
  ): Promise<ClubFinancialConfig> {
    const draftConfig: ClubFinancialConfig = {
      ...config,
      isHomologated: false,
      isOfficial: false,
      status: 'RASCUNHO',
    };

    return this.saveConfig(
      draftConfig,
      adminUser,
      'SAVE_DRAFT',
      `Rascunho de parâmetros econômicos salvo pelo Administrador para a Temporada ${config.seasonYear}.`,
      reason
    );
  },

  /**
   * Homologa a temporada oficialmente.
   * Transforma a configuração em "HOMOLOGADA", com a flag isOfficial = true,
   * conferindo status de regra oficial da liga.
   */
  async homologateSeason(
    config: ClubFinancialConfig,
    adminUser?: { email?: string; uid?: string },
    reason?: string
  ): Promise<ClubFinancialConfig> {
    const homologatedConfig: ClubFinancialConfig = {
      ...config,
      isHomologated: true,
      isOfficial: true,
      status: 'HOMOLOGADA',
      homologatedAt: new Date().toISOString(),
      homologatedBy: adminUser?.email || 'Admin FM Universe',
    };

    return this.saveConfig(
      homologatedConfig,
      adminUser,
      'HOMOLOGATE_SEASON',
      `Homologação oficial das regras e orçamentos para a Temporada ${config.seasonYear} concluída pelo Administrador. Configuração marcada como OFICIAL.`,
      reason
    );
  },
};
