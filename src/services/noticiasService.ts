import {
  News,
  NewsCategory,
  NewsPriority,
  NewsEventType,
  Match,
  TransferOffer,
  Transfer,
  FinanceRecord,
  Club,
  Stadium,
} from '../types';
import { isFirebaseConfigured, firestoreDb } from '../config/firebase';
import { dataStore } from './dataStore';
import { formatCurrencyBRL } from '../utils/currency';
import { collection, getDocs, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

export interface NewsFilter {
  clubId?: string;
  category?: NewsCategory | 'ALL';
  type?: NewsEventType | 'ALL';
  priority?: NewsPriority | 'ALL';
  unreadOnly?: boolean;
  searchQuery?: string;
}

export const noticiasService = {
  /**
   * Obtém todas as notícias com filtros flexíveis, executando sincronização
   * automática a partir de eventos reais do sistema (jogos, mercado, finanças, estádio).
   */
  async getAll(filter?: NewsFilter): Promise<News[]> {
    // 1. Sincroniza eventos reais do sistema para garantir que todos os acontecimentos oficiais tenham notícia
    this.syncFromRealEvents(filter?.clubId);

    let list: News[] = [];
    if (isFirebaseConfigured() && firestoreDb) {
      try {
        const colRef = collection(firestoreDb, 'noticias');
        const snap = await getDocs(colRef);
        if (!snap.empty) {
          const fromDb = snap.docs.map((d) => ({ id: d.id, ...d.data() } as News));
          const local = dataStore.getNews();
          const map = new Map<string, News>();
          fromDb.forEach((n) => map.set(n.id, n));
          local.forEach((n) => {
            if (!map.has(n.id)) map.set(n.id, n);
          });
          list = Array.from(map.values());
        }
      } catch (err) {
        console.warn('Falha na consulta Firestore para noticias. Usando fallback local.', err);
      }
    }

    if (list.length === 0) {
      list = dataStore.getNews();
    }

    // 2. Ordenação por data/hora decrescente (mais recente primeiro)
    list.sort((a, b) => {
      const timeA = new Date(a.timestamp || a.date).getTime() || 0;
      const timeB = new Date(b.timestamp || b.date).getTime() || 0;
      return timeB - timeA;
    });

    // 3. Aplicação dos filtros solicitados
    if (filter) {
      if (filter.clubId && filter.clubId !== 'ALL') {
        list = list.filter((n) => !n.clubId || n.clubId === filter.clubId);
      }
      if (filter.category && filter.category !== 'ALL') {
        list = list.filter((n) => n.category === filter.category);
      }
      if (filter.type && filter.type !== 'ALL') {
        list = list.filter((n) => n.type === filter.type);
      }
      if (filter.priority && filter.priority !== 'ALL') {
        list = list.filter((n) => n.priority === filter.priority);
      }
      if (filter.unreadOnly) {
        list = list.filter((n) => !n.isRead);
      }
      if (filter.searchQuery && filter.searchQuery.trim() !== '') {
        const q = filter.searchQuery.toLowerCase().trim();
        list = list.filter(
          (n) =>
            n.title.toLowerCase().includes(q) ||
            n.summary.toLowerCase().includes(q) ||
            n.content.toLowerCase().includes(q) ||
            n.clubName?.toLowerCase().includes(q)
        );
      }
    }

    return list;
  },

  /**
   * Busca uma notícia pelo ID.
   */
  async getById(id: string): Promise<News | null> {
    if (isFirebaseConfigured() && firestoreDb) {
      try {
        const docRef = doc(firestoreDb, 'noticias', id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          return { id: snap.id, ...snap.data() } as News;
        }
      } catch (err) {
        console.warn('Falha ao buscar notícia no Firestore.', err);
      }
    }
    return dataStore.getNewsById(id) || null;
  },

  /**
   * Publica ou atualiza uma notícia no sistema.
   * Totalmente idempotente: deduplica por ID ou sourceEventId.
   */
  async publishNews(newsItem: News): Promise<News> {
    const formatted: News = {
      ...newsItem,
      timestamp: newsItem.timestamp || new Date().toISOString(),
      isRead: newsItem.isRead ?? false,
    };

    dataStore.addNews(formatted);

    if (isFirebaseConfigured() && firestoreDb) {
      try {
        const docRef = doc(firestoreDb, 'noticias', formatted.id);
        const cleanData = Object.fromEntries(
          Object.entries(formatted).filter(([_, v]) => v !== undefined)
        );
        await setDoc(docRef, cleanData);
      } catch (err) {
        console.warn('Falha ao persistir notícia no Firestore.', err);
      }
    }

    return formatted;
  },

  /**
   * Marca uma notícia como lida.
   */
  async markAsRead(id: string): Promise<void> {
    dataStore.markNewsAsRead(id);
    if (isFirebaseConfigured() && firestoreDb) {
      try {
        const docRef = doc(firestoreDb, 'noticias', id);
        await updateDoc(docRef, { isRead: true });
      } catch (err) {
        console.warn('Falha ao atualizar status de leitura da notícia no Firestore.', err);
      }
    }
  },

  /**
   * Marca todas as notícias como lidas.
   */
  async markAllAsRead(clubId?: string): Promise<void> {
    dataStore.markAllNewsAsRead(clubId);
  },

  /**
   * Retorna o contador de notícias não lidas.
   */
  async getUnreadCount(clubId?: string): Promise<number> {
    const all = await this.getAll();
    return all.filter((n) => !n.isRead && (!clubId || !n.clubId || n.clubId === clubId)).length;
  },

  /**
   * MOTOR DE SINCRONIZAÇÃO DINÂMICA COM EVENTOS REAIS DO SISTEMA
   * Varre exclusivamente dados e eventos reais homologados no dataStore:
   * 1. Partidas concluídas (resultados, destaques, público e estádio)
   * 2. Propostas e contrapropostas de transferência reais
   * 3. Transferências concluídas reais
   * 4. Lesões / Desgaste e Suspensões de atletas por cartões
   * 5. Obras de Estádio e movimentações financeiras relevantes
   * 6. Mudanças na liderança e classificação do campeonato
   */
  syncFromRealEvents(currentClubId?: string): void {
    const clubs = dataStore.getClubs();
    const stadiums = dataStore.getStadiums();
    const existingNews = dataStore.getNews();
    const publishedSourceIds = new Set<string>(
      existingNews.map((n) => n.sourceEventId).filter((id): id is string => Boolean(id))
    );

    const getClub = (id?: string): Club | undefined => clubs.find((c) => c.id === id);
    const getStadium = (id?: string): Stadium | undefined => stadiums.find((s) => s.id === id);

    // -------------------------------------------------------------
    // 1. EVENTOS REAIS DE PARTIDAS CONCLUÍDAS
    // -------------------------------------------------------------
    const matches = dataStore.getMatches();
    const finishedMatches = matches.filter((m) => m.status === 'FINISHED');

    for (const match of finishedMatches) {
      const sourceId = `match-res-${match.id}`;
      if (!publishedSourceIds.has(sourceId)) {
        const homeClub = getClub(match.homeClubId);
        const awayClub = getClub(match.awayClubId);
        const stadium = getStadium(match.stadiumId);

        const isUserMatch =
          currentClubId &&
          (match.homeClubId === currentClubId || match.awayClubId === currentClubId);

        const primaryClub = isUserMatch
          ? (match.homeClubId === currentClubId ? homeClub : awayClub)
          : homeClub;

        const eventDate = match.date || '2026-09-09';
        const eventTime = match.time || '16:00';
        const isoTimestamp = `${eventDate}T${eventTime}:00Z`;

        const goalEvents = (match.events || []).filter((e) => e.type === 'GOAL');
        const scorersSummary =
          goalEvents.length > 0
            ? goalEvents.map((g) => `${g.minute}' ${g.playerName}`).join(', ')
            : 'Partida equilibrada sem gols marcados.';

        const newsTitle = `Liga FM (R${match.round}): ${match.homeClubName} ${match.homeScore} x ${match.awayScore} ${match.awayClubName}`;
        const summary = `Confronto disputado no ${match.stadiumName}${
          match.attendance ? ` com público oficial de ${match.attendance.toLocaleString('pt-BR')} torcedores.` : '.'
        }`;

        const possessionStr = match.stats?.possession
          ? `${match.stats.possession[0]}% x ${match.stats.possession[1]}%`
          : '50% x 50%';
        const shotsStr = match.stats?.shots
          ? `${match.stats.shots[0]} x ${match.stats.shots[1]}`
          : 'N/D';

        const content = `Em partida oficial válida pela Rodada ${match.round} da Liga FM Universe, o ${match.homeClubName} enfrentou o ${match.awayClubName} no estádio ${match.stadiumName}. O placar final registrou ${match.homeClubName} ${match.homeScore} x ${match.awayScore} ${match.awayClubName}.\n\nEstatísticas e destaques do confronto:\n• Gols: ${scorersSummary}\n• Posse de bola: ${possessionStr}\n• Finalizações: ${shotsStr}\n• Público e Bilheteria: ${match.attendance ? `${match.attendance.toLocaleString('pt-BR')} pagantes` : 'Portões normais'}.`;

        const newsItem: News = {
          id: `news-${sourceId}`,
          sourceEventId: sourceId,
          title: newsTitle,
          summary,
          content,
          category: 'COMPETICAO',
          type: isUserMatch ? 'MATCH_RESULT' : 'OTHER_CLUB_EVENT',
          priority: isUserMatch ? 'ALTA' : 'MEDIA',
          clubId: primaryClub?.id,
          clubName: primaryClub?.name || match.homeClubName,
          clubBadge: primaryClub?.badge,
          stadiumImage: stadium?.image,
          date: eventDate,
          timestamp: isoTimestamp,
          author: 'Redação Oficial FM Universe',
          readTimeMinutes: 2,
          isRead: false,
        };

        dataStore.addNews(newsItem);
        publishedSourceIds.add(sourceId);

        // Identifica suspensões ou cartões vermelhos na partida
        const cardEvents = (match.events || []).filter(
          (e) => e.type === 'RED_CARD' || (e.type === 'YELLOW_CARD' && (match.events || []).filter((y) => y.playerId === e.playerId && y.type === 'YELLOW_CARD').length >= 2)
        );

        for (const card of cardEvents) {
          const cardSourceId = `suspension-${match.id}-${card.playerId}`;
          if (!publishedSourceIds.has(cardSourceId)) {
            const cardClub = card.teamId ? getClub(card.teamId) : primaryClub;
            const suspensionNews: News = {
              id: `news-${cardSourceId}`,
              sourceEventId: cardSourceId,
              title: `Suspensão Automática: ${card.playerName} (${cardClub?.name || 'Clube'}) desfalcará a equipe`,
              summary: `Atleta foi punido pela arbitragem na Rodada ${match.round} e cumprirá suspensão disciplinar na próxima rodada oficial.`,
              content: `O departamento de competições da Liga FM Universe confirmou a suspensão automática do atleta ${card.playerName}, advertido na partida contra o ${match.awayClubName === cardClub?.name ? match.homeClubName : match.awayClubName}. O técnico não poderá contar com o jogador na rodada seguinte.`,
              category: 'DM_DISCIPLINA',
              type: 'SUSPENSION',
              priority: cardClub?.id === currentClubId ? 'URGENTE' : 'MEDIA',
              clubId: cardClub?.id,
              clubName: cardClub?.name,
              clubBadge: cardClub?.badge,
              date: eventDate,
              timestamp: isoTimestamp,
              author: 'Tribunal Disciplinar FM',
              readTimeMinutes: 1,
              isRead: false,
            };
            dataStore.addNews(suspensionNews);
            publishedSourceIds.add(cardSourceId);
          }
        }
      }
    }

    // -------------------------------------------------------------
    // 2. EVENTOS REAIS DE PROPOSTAS E NEGOCIAÇÕES DE MERCADO
    // -------------------------------------------------------------
    const offers = dataStore.getTransferOffers();
    for (const offer of offers) {
      const buyerClub = getClub(offer.buyerClubId);
      const sellerClub = getClub(offer.sellerClubId);
      const isRelated =
        currentClubId && (offer.buyerClubId === currentClubId || offer.sellerClubId === currentClubId);

      if (offer.status === 'PENDING') {
        const sourceId = `offer-pending-${offer.id}`;
        if (!publishedSourceIds.has(sourceId)) {
          const newsItem: News = {
            id: `news-${sourceId}`,
            sourceEventId: sourceId,
            title: `Mercado: ${buyerClub?.name || offer.buyerClubName} oficializa proposta por ${offer.playerName}`,
            summary: `Oferta de ${formatCurrencyBRL(offer.amount, { compact: true })} apresentada ao ${sellerClub?.name || offer.sellerClubName}. Negociação em andamento.`,
            content: `A diretoria do ${buyerClub?.name || offer.buyerClubName} formalizou proposta no valor de ${formatCurrencyBRL(offer.amount, { compact: true })} para contratar o atleta ${offer.playerName} junto ao ${sellerClub?.name || offer.sellerClubName}.\n\n${
              offer.responseNote ? `Nota da Diretoria: "${offer.responseNote}"\n\n` : ''
            }O clube vendedor tem prazo para analisar as condições e responder com aceite, recusa ou contraproposta.`,
            category: 'TRANSFERENCIAS',
            type: 'TRANSFER_PROPOSAL',
            priority: isRelated ? 'ALTA' : 'MEDIA',
            clubId: buyerClub?.id || offer.buyerClubId,
            clubName: buyerClub?.name || offer.buyerClubName,
            clubBadge: buyerClub?.badge,
            date: offer.createdAt?.split('T')[0] || '2026-09-09',
            timestamp: offer.createdAt || new Date().toISOString(),
            author: 'Central do Mercado FM',
            readTimeMinutes: 2,
            isRead: false,
          };
          dataStore.addNews(newsItem);
          publishedSourceIds.add(sourceId);
        }
      } else if (
        (offer.status === 'NEGOCIAÇÃO' || offer.status === 'NEGOTIATION' || (offer.counterOfferAmount && offer.counterOfferAmount > 0)) &&
        offer.counterOfferAmount
      ) {
        const sourceId = `offer-counter-${offer.id}-${offer.counterOfferAmount}`;
        if (!publishedSourceIds.has(sourceId)) {
          const newsItem: News = {
            id: `news-${sourceId}`,
            sourceEventId: sourceId,
            title: `Contraproposta: ${sellerClub?.name || offer.sellerClubName} pede ${formatCurrencyBRL(offer.counterOfferAmount, { compact: true })} por ${offer.playerName}`,
            summary: `Clube vendedor estabelece novo valor para liberar o atleta para o ${buyerClub?.name || offer.buyerClubName}.`,
            content: `Em resposta à investida inicial, o ${sellerClub?.name || offer.sellerClubName} apresentou uma contraproposta oficial no valor de ${formatCurrencyBRL(offer.counterOfferAmount, { compact: true })} para fechar a transferência de ${offer.playerName}.\n\n${
              offer.responseNote ? `Declaração da Diretoria: "${offer.responseNote}"\n\n` : ''
            }A decisão final agora está nas mãos da diretoria do ${buyerClub?.name || offer.buyerClubName}.`,
            category: 'TRANSFERENCIAS',
            type: 'TRANSFER_COUNTER',
            priority: isRelated ? 'URGENTE' : 'MEDIA',
            clubId: sellerClub?.id || offer.sellerClubId,
            clubName: sellerClub?.name || offer.sellerClubName,
            clubBadge: sellerClub?.badge,
            date: offer.updatedAt?.split('T')[0] || '2026-09-09',
            timestamp: offer.updatedAt || new Date().toISOString(),
            author: 'Central do Mercado FM',
            readTimeMinutes: 2,
            isRead: false,
          };
          dataStore.addNews(newsItem);
          publishedSourceIds.add(sourceId);
        }
      }
    }

    // -------------------------------------------------------------
    // 3. EVENTOS REAIS DE TRANSFERÊNCIAS CONCLUÍDAS
    // -------------------------------------------------------------
    const transfers = dataStore.getTransfers();
    for (const transfer of transfers) {
      const sourceId = `transf-done-${transfer.id}`;
      if (!publishedSourceIds.has(sourceId)) {
        const buyer = getClub(transfer.toClubId);
        const seller = getClub(transfer.fromClubId);
        const buyerStadium = getStadium(buyer?.stadiumId);

        const newsItem: News = {
          id: `news-${sourceId}`,
          sourceEventId: sourceId,
          title: `Oficial: ${transfer.playerName} assina com o ${buyer?.name || transfer.toClubName}!`,
          summary: `Contratação concluída por ${formatCurrencyBRL(transfer.fee, { compact: true })}. Atleta deixa o ${seller?.name || transfer.fromClubName}.`,
          content: `O ${buyer?.name || transfer.toClubName} anunciou oficialmente a contratação definitiva de ${transfer.playerName} (${transfer.playerPosition || 'Atleta'}). A transação foi homologada pelo montante de ${formatCurrencyBRL(transfer.fee, { compact: true })}.\n\nO jogador se juntará ao plantel imediatamente sob o comando técnico da comissão.`,
          category: 'TRANSFERENCIAS',
          type: 'TRANSFER_COMPLETED',
          priority: currentClubId && (transfer.toClubId === currentClubId || transfer.fromClubId === currentClubId) ? 'ALTA' : 'MEDIA',
          clubId: buyer?.id || transfer.toClubId,
          clubName: buyer?.name || transfer.toClubName,
          clubBadge: buyer?.badge,
          stadiumImage: buyerStadium?.image,
          date: transfer.date || '2026-09-08',
          timestamp: `${transfer.date || '2026-09-08'}T12:00:00Z`,
          author: 'Central do Mercado FM',
          readTimeMinutes: 2,
          isRead: false,
        };
        dataStore.addNews(newsItem);
        publishedSourceIds.add(sourceId);
      }
    }

    // -------------------------------------------------------------
    // 4. EVENTOS REAIS DE INFRAESTRUTURA E ESTÁDIO (ex: Arena Thales)
    // -------------------------------------------------------------
    const finances = dataStore.getFinances();
    for (const fin of finances) {
      if (
        fin.category === 'INFRAESTRUTURA' ||
        fin.description?.includes('Expansão de Arquibancada') ||
        fin.transactionType === 'Melhoria de Infraestrutura'
      ) {
        const sourceId = `infra-record-${fin.id}`;
        if (!publishedSourceIds.has(sourceId)) {
          const club = getClub(fin.clubId);
          const stadium = getStadium(club?.stadiumId);

          const newsItem: News = {
            id: `news-${sourceId}`,
            sourceEventId: sourceId,
            title: `Patrimônio: Concluída expansão da ${club?.stadiumName || 'Arena'} para 75.000 torcedores!`,
            summary: `Investimento histórico de ${formatCurrencyBRL(fin.amount, { compact: true })} amplia a capacidade e potencial de bilheteria do clube.`,
            content: `A diretoria do ${club?.name || 'clube'} confirmou a conclusão das obras de modernização e ampliação de sua praça esportiva (${club?.stadiumName || 'Arena'}), elevando a capacidade oficial para 75.000 assentos.\n\nO investimento contabilizado de ${formatCurrencyBRL(fin.amount, { compact: true })} capacita a instituição a maximizar sua arrecadação em dias de grandes clássicos e jogos decisivos da Liga FM Universe.`,
            category: 'ESTADIO',
            type: 'STADIUM_UPGRADE',
            priority: 'ALTA',
            clubId: club?.id || fin.clubId,
            clubName: club?.name,
            clubBadge: club?.badge,
            stadiumImage: stadium?.image,
            date: fin.date || '2026-09-08',
            timestamp: `${fin.date || '2026-09-08'}T10:00:00Z`,
            author: 'Departamento de Infraestrutura & Patrimônio',
            readTimeMinutes: 2,
            isRead: false,
          };
          dataStore.addNews(newsItem);
          publishedSourceIds.add(sourceId);
        }
      }
    }

    // -------------------------------------------------------------
    // 5. EVENTOS REAIS DE CLASSIFICAÇÃO / CAMPEONATO
    // -------------------------------------------------------------
    const comps = dataStore.getCompetitions();
    for (const comp of comps) {
      if (comp.standings && comp.standings.length > 0) {
        const leader = comp.standings[0];
        const roundNum = comp.currentRound || 4;
        const sourceId = `comp-lead-${comp.id}-r${roundNum}`;
        if (!publishedSourceIds.has(sourceId)) {
          const leaderClub = getClub(leader.clubId);
          const newsItem: News = {
            id: `news-${sourceId}`,
            sourceEventId: sourceId,
            title: `Liga FM: ${leader.clubName} sustenta a ponta da tabela na Rodada ${roundNum}`,
            summary: `Com ${leader.points} pontos em ${leader.played} jogos, equipe lidera a acirrada disputa pelo título da temporada 2026/2027.`,
            content: `A classificação da Liga FM Universe segue em ritmo acelerado. O ${leader.clubName} desponta na liderança com ${leader.points} pontos conquistados em ${leader.played} compromissos (${leader.won} vitórias, ${leader.drawn} empates e ${leader.lost} derrotas), ostentando saldo de gols de +${leader.goalDifference}.\n\nO G-4 permanece em disputa direta entre os gigantes do universo FM.`,
            category: 'COMPETICAO',
            type: 'STANDINGS_CHANGE',
            priority: 'MEDIA',
            clubId: leaderClub?.id || leader.clubId,
            clubName: leader.clubName,
            clubBadge: leaderClub?.badge,
            date: '2026-09-08',
            timestamp: '2026-09-08T20:00:00Z',
            author: 'Mesa Redonda FM',
            readTimeMinutes: 2,
            isRead: false,
          };
          dataStore.addNews(newsItem);
          publishedSourceIds.add(sourceId);
        }
      }
    }
  },

  async publishOfficialAnnouncement(news: News): Promise<void> {
    dataStore.addNews(news);
    if (isFirebaseConfigured() && firestoreDb) {
      try {
        const docRef = doc(firestoreDb, 'noticias', news.id);
        await setDoc(docRef, news, { merge: true });
      } catch (err) {
        console.warn('Falha ao persistir notícia oficial no Firestore.', err);
      }
    }
  },
};
