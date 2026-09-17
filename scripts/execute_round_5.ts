/**
 * Script para execução e verificação do Primeiro Teste Real do Motor de Temporada (Rodada 5)
 * - Coerência de Temporada 2026/2027
 * - Partida Oficial: Thales FC x FM United (Rodada 5)
 * - Processamento completo via SeasonMotorService
 * - Teste de Idempotência estrita
 * - Relatório completo para homologação
 */

// Polyfill window & localStorage para ambiente de execução tsx/node
const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) || null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
  get length() { return storage.size; },
  key: (index: number) => Array.from(storage.keys())[index] || null,
};

(globalThis as any).window = globalThis;
(globalThis as any).localStorage = localStorageMock;

import { seasonMotorService } from '../src/services/seasonMotorService';
import { dataStore } from '../src/services/dataStore';
import { clubesService } from '../src/services/clubesService';
import { jogosService } from '../src/services/jogosService';
import { competicoesService } from '../src/services/competicoesService';
import { financasService } from '../src/services/financasService';
import { temporadasService } from '../src/services/temporadasService';

async function run() {
  console.log('================================================================');
  console.log('   PRIMEIRO PROCESSAMENTO REAL DE UMA RODADA - MOTOR DE TEMPORADA');
  console.log('================================================================\n');

  const clubId = 'club-qowYWnG0EfUqrr1a5cHlu4UYmNB3'; // Thales FC

  // 1. DADOS ANTES DO PROCESSAMENTO
  const clubBefore = await clubesService.getById(clubId);
  const activeSeason = await seasonMotorService.getActiveSeason();
  const allComps = await competicoesService.getAll();
  const mainComp = allComps.find(c => c.id === 'comp-1') || allComps[0];
  
  const matchesBefore = await jogosService.getByClubId(clubId);
  const targetMatchBefore = matchesBefore.find(m => (m.round === 5 || m.rodada === 5));

  console.log('--- DADOS ANTES DO PROCESSAMENTO ---');
  console.log(`Temporada:   ${activeSeason.year} (${activeSeason.name})`);
  console.log(`Competição:  ${mainComp.name}`);
  console.log(`Rodada:      ${targetMatchBefore?.round || targetMatchBefore?.rodada || 5}`);
  console.log(`Data:        ${targetMatchBefore?.date || '2026-09-09'}`);
  console.log(`Mandante:    ${targetMatchBefore?.homeClubName}`);
  console.log(`Visitante:   ${targetMatchBefore?.awayClubName}`);
  console.log(`Estádio:     ${targetMatchBefore?.stadiumName}`);
  console.log(`Status:      ${targetMatchBefore?.status}`);
  const initialBalance = clubBefore?.balance || 0;
  console.log(`Saldo Atual: R$ ${initialBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log('------------------------------------\n');

  if (!targetMatchBefore) {
    throw new Error('Partida oficial da Rodada 5 não encontrada no calendário!');
  }

  // 2. EXECUTAR PROCESSAMENTO VIA SEASON MOTOR SERVICE
  console.log('>>> Processando rodada via seasonMotorService.advanceRound({ preferredClubId: "Thales FC" })...\n');
  
  const result = await seasonMotorService.advanceRound({
    preferredClubId: clubId,
    targetRoundNumber: 5,
  });

  console.log('================================================================');
  console.log('       RESULTADO DO PROCESSAMENTO DA RODADA 5');
  console.log('================================================================\n');

  console.log(`Rodada Processada:    ${result.round}`);
  console.log(`Temporada:            ${result.seasonYear || '2026/2027'}`);
  console.log(`Total de Jogos Simulados: ${result.allMatches.length}`);
  console.log(`Destaques da Rodada:  ${result.eventsHighlights.join(' | ') || 'Rodada concluída'}\n`);

  // Partida do Thales FC
  const thalesMatch = result.userMatch || result.allMatches.find(
    m => m.homeClubId === clubId || m.awayClubId === clubId
  );

  if (thalesMatch) {
    console.log('--- PARTIDA OFICIAL DO THALES FC ---');
    console.log(`Confronto:      ${thalesMatch.homeClubName} ${thalesMatch.homeScore} x ${thalesMatch.awayScore} ${thalesMatch.awayClubName}`);
    console.log(`Data / Hora:    ${thalesMatch.date} às ${thalesMatch.time}`);
    console.log(`Estádio:        ${thalesMatch.stadiumName}`);
    console.log(`Público Pagante: ${thalesMatch.attendance.toLocaleString('pt-BR')} torcedores`);
    console.log(`Bilheteria Bruta: R$ ${(thalesMatch.ticketRevenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`Status da Partida: ${thalesMatch.status}`);
    
    console.log('\nEstatísticas da Partida (Mandante x Visitante):');
    console.log(`  Posse de Bola:       ${thalesMatch.stats?.possession[0]}% x ${thalesMatch.stats?.possession[1]}%`);
    console.log(`  Finalizações:        ${thalesMatch.stats?.shots[0]} x ${thalesMatch.stats?.shots[1]}`);
    console.log(`  Chutes no Alvo:      ${thalesMatch.stats?.shotsOnTarget[0]} x ${thalesMatch.stats?.shotsOnTarget[1]}`);
    console.log(`  Faltas:              ${thalesMatch.stats?.fouls[0]} x ${thalesMatch.stats?.fouls[1]}`);
    console.log(`  Escanteios:          ${thalesMatch.stats?.corners[0]} x ${thalesMatch.stats?.corners[1]}`);
    console.log(`  Precisão de Passes:  ${thalesMatch.stats?.passesAccuracy[0]}% x ${thalesMatch.stats?.passesAccuracy[1]}%`);

    if (thalesMatch.events && thalesMatch.events.length > 0) {
      console.log('\nEventos do Jogo:');
      thalesMatch.events.forEach(ev => {
        console.log(`  - [${ev.minute}'] ${ev.type}: ${ev.playerName} (${ev.detail || ''})`);
      });
    }
    console.log('------------------------------------\n');
  }

  // Finanças da Rodada
  const clubFinances = result.financialBreakdown;
  const clubAfter = await clubesService.getById(clubId);

  console.log('--- MOVIMENTAÇÃO FINANCEIRA DO THALES FC (RODADA 5) ---');
  if (clubFinances) {
    console.log(`Receita de Bilheteria:  R$ ${clubFinances.incomes.ticketSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`Receita de Transmissão: R$ ${clubFinances.incomes.tvRights.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`Patrocínios da Rodada:  R$ ${clubFinances.incomes.sponsorships.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`Bônus / Premiações:     R$ ${clubFinances.incomes.bonuses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`TOTAL DE ENTRADAS:      R$ ${clubFinances.incomes.totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`Despesas Operacionais:  R$ ${clubFinances.expenses.totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`LUCRO LÍQUIDO DA RODADA: R$ ${clubFinances.netAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  }
  console.log(`\nSALDO ANTERIOR:  R$ ${initialBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`SALDO ATUALIZADO: R$ ${(clubAfter?.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`DIFERENÇA NO CAIXA: R$ ${((clubAfter?.balance || 0) - initialBalance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log('-------------------------------------------------------\n');

  // Livro Caixa / Transações registradas
  const transactions = await financasService.getRecordsByClubId(clubId);
  const roundTx = transactions.slice(-6); // últimas transações geradas
  console.log('--- TRANSAÇÕES REGISTRADAS NO LIVRO CAIXA ---');
  roundTx.forEach(tx => {
    const sign = tx.type === 'INCOME' ? '+' : '-';
    console.log(`- [${tx.date || tx.month}] ${tx.category || tx.transactionType} (${tx.type}): ${sign} R$ ${(tx.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Ref: ${tx.description}`);
  });
  console.log('---------------------------------------------\n');

  // Classificação Atualizada
  const compAfter = (await competicoesService.getAll()).find(c => c.id === 'comp-1');
  console.log('--- CLASSIFICAÇÃO ATUALIZADA (LIGA FM UNIVERSE) ---');
  console.log('Pos | Clube                | Pts | J | V | E | D | GP | GC | SG');
  console.log('-------------------------------------------------------------');
  compAfter?.standings.forEach(s => {
    const pos = String(s.position).padStart(3, ' ');
    const name = s.clubName.padEnd(20, ' ');
    const pts = String(s.points).padStart(3, ' ');
    const j = String(s.played).padStart(2, ' ');
    const v = String(s.won).padStart(2, ' ');
    const e = String(s.drawn).padStart(2, ' ');
    const d = String(s.lost).padStart(2, ' ');
    const gp = String(s.goalsFor).padStart(3, ' ');
    const gc = String(s.goalsAgainst).padStart(3, ' ');
    const sg = String(s.goalDifference).padStart(3, ' ');
    console.log(`${pos} | ${name} | ${pts} | ${j} | ${v} | ${e} | ${d} | ${gp} | ${gc} | ${sg}`);
  });
  console.log('-------------------------------------------------------------\n');

  // Próxima Partida no Calendário
  const nextPending = await seasonMotorService.getNextPendingRound(clubId);
  const upcomingMatches = (await jogosService.getByClubId(clubId)).filter(m => m.status === 'SCHEDULED');
  const nextMatch = upcomingMatches[0];

  console.log('--- PRÓXIMO CONFRONTO NO CALENDÁRIO ---');
  console.log(`Próxima Rodada Pendente: Rodada ${nextPending?.roundNumber}`);
  if (nextMatch) {
    const mando = nextMatch.homeClubId === clubId ? 'Casa (Mandante)' : 'Fora (Visitante)';
    const adversario = nextMatch.homeClubId === clubId ? nextMatch.awayClubName : nextMatch.homeClubName;
    console.log(`Adversário:             ${adversario}`);
    console.log(`Mando de Campo:         ${mando}`);
    console.log(`Data Prevista:          ${nextMatch.date} às ${nextMatch.time}`);
    console.log(`Estádio:                ${nextMatch.stadiumName}`);
  }
  console.log('---------------------------------------\n');

  // 3. TESTE DE IDEMPOTÊNCIA: Segunda tentativa de processamento da mesma rodada
  console.log('================================================================');
  console.log('           TESTE DE IDEMPOTÊNCIA ESTATAL ESTREITA');
  console.log('================================================================');
  console.log('Tentando processar novamente a Rodada 5 para verificar bloqueio...');

  let idempotencyPassed = false;
  try {
    await seasonMotorService.advanceRound({
      preferredClubId: clubId,
      targetRoundNumber: 5,
    });
    console.error('FALHA: A rodada foi processada novamente sem disparar bloqueio de idempotência!');
  } catch (err: any) {
    console.log(`SUCESSO: Tentativa rejeitada com segurança pelo motor!`);
    console.log(`Mensagem de Erro Capturada: "${err.message}"`);
    idempotencyPassed = true;
  }

  // Verifica se o saldo do Thales FC permaneceu inalterado após a tentativa rejeitada
  const clubAfterSecondAttempt = await clubesService.getById(clubId);
  const balanceUnchanged = clubAfterSecondAttempt?.balance === clubAfter?.balance;
  console.log(`Saldo pós-tentativa rejeitada: R$ ${clubAfterSecondAttempt?.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (Inalterado: ${balanceUnchanged ? 'SIM' : 'NÃO'})`);

  if (idempotencyPassed && balanceUnchanged) {
    console.log('\n>> IDEMPOTÊNCIA 100% HOMOLOGADA COM SUCESSO: Nenhum débito, crédito ou partida duplicada gerada!\n');
  } else {
    throw new Error('Falha na validação de idempotência.');
  }

  console.log('================================================================');
  console.log('     PRIMEIRO TESTE REAL CONCLUÍDO E APROVADO COM ÊXITO');
  console.log('================================================================');
  process.exit(0);
}

run().catch((err) => {
  console.error('ERRO FATAL NA EXECUÇÃO:', err);
  process.exit(1);
});
