import { FinanceRecord, ClubStaff, ClubFacility, TacticSetup, FinancialReport } from '../types';
import { dataStore } from './dataStore';
import { clubesService } from './clubesService';
import { adminFinancasService } from './adminFinancasService';

export const financasService = {
  async getRecords(): Promise<FinanceRecord[]> {
    return dataStore.getFinances();
  },
  async getRecordsByClubId(clubId: string): Promise<FinanceRecord[]> {
    return dataStore.getFinancesByClubId(clubId);
  },
  async getByClubId(clubId: string): Promise<FinancialReport> {
    let club = dataStore.getClubById(clubId);
    if (!club) {
      try {
        club = (await clubesService.getById(clubId)) || undefined;
      } catch {
        // ignore
      }
    }

    const config = await adminFinancasService.getConfigByClubId(clubId);
    const balance = club?.balance ?? config.initialSeasonBudget;
    const transferBudget = club?.transferBudget ?? config.transferBudget;
    const wageBudget = config.wageBudget || club?.wageBudget || 3800000;

    // Consolida receitas mensais a partir das regras definidas pelo Administrador
    const monthlySponsorships = config.sponsors
      .filter((s) => s.status === 'ATIVO')
      .reduce((sum, s) => sum + (s.monthlyAmount || 0), 0) || 3500000;

    // Estimativa de 2 jogos com mando de campo no mês + programa sócio-torcedor
    const monthlyTicketSales = (config.matchday.estimatedMatchRevenue * 2) + config.matchday.memberSubscriptionRevenueMonthly;
    // Estimativa de 4 rodadas televisionadas no mês
    const monthlyTvRights = config.tvRights.amountPerRound * 4;
    // Bônus/premiações médias mensais
    const monthlyPrizeMoney = (config.prizes.winPrize * 2) + config.prizes.drawPrize;
    const merchandising = Math.round(monthlyTicketSales * 0.25);

    // Despesas fixas configuradas pelo Admin
    const playerWages = config.expenses.payrollWageMonthly;
    const staffWages = config.expenses.coachingStaffWageMonthly + config.expenses.operationalStaffWageMonthly;
    const stadiumMaintenance = config.expenses.stadiumMaintenanceMonthly;
    const youthAcademy = config.expenses.youthAcademyMonthly;

    return {
      balance,
      transferBudget,
      wageBudget,
      wageSpend: playerWages + staffWages,
      incomes: {
        ticketSales: monthlyTicketSales,
        sponsorships: monthlySponsorships,
        tvRights: monthlyTvRights,
        merchandising,
        prizeMoney: monthlyPrizeMoney,
      },
      expenses: {
        playerWages,
        staffWages,
        stadiumMaintenance,
        youthAcademy,
      },
    };
  },
  async getStaff(): Promise<ClubStaff[]> {
    return dataStore.getStaff();
  },
  async getFacilities(): Promise<ClubFacility> {
    return dataStore.getFacilities();
  },
  async upgradeFacility(field: keyof ClubFacility): Promise<ClubFacility> {
    dataStore.upgradeFacility(field);
    return dataStore.getFacilities();
  },
  async getTactic(): Promise<TacticSetup> {
    return dataStore.getTactic();
  },
  async saveTactic(tactic: TacticSetup): Promise<void> {
    dataStore.saveTactic(tactic);
  },
};
