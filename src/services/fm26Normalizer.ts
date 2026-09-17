import {
  PlayerPosition,
  PositionCategory,
  PlayerTechnicalAttributes,
  PlayerMentalAttributes,
  PlayerPhysicalAttributes,
  PlayerGoalkeeperAttributes,
  PlayerStats,
} from '../types';
import { FM26ParsedPlayer } from '../types/fm26';
import { generateDeterministicPlayerId } from './fm26ProtectionLayer';

/**
 * Normaliza um cabeçalho bruto removendo acentos, caracteres especiais,
 * espaços duplicados e convertendo para minúsculas.
 */
export function normalizeHeaderKey(header: string): string {
  if (!header) return '';
  return header
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Dicionário canônico abrangente de apelidos/variações de cabeçalhos do FM26 (Português e Inglês).
 */
const HEADER_MAPPING: Record<string, string> = {
  // --- IDENTIFICAÇÃO BÁSICA & UNIQUE ID ---
  name: 'name',
  playername: 'name',
  nome: 'name',
  nomedojogador: 'name',
  jogador: 'name',
  atleta: 'name',

  fullname: 'fullName',
  nomecompleto: 'fullName',
  nomecivil: 'fullName',

  uid: 'externalId',
  id: 'externalId',
  uniqueid: 'externalId',
  idunico: 'externalId',
  externalid: 'externalId',
  personid: 'externalId',
  playerid: 'externalId',
  idjogador: 'externalId',
  idatleta: 'externalId',
  fmid: 'externalId',
  fm26id: 'externalId',
  fmuid: 'externalId',
  fmuniqueid: 'externalId',

  age: 'age',
  idade: 'age',

  dob: 'birthDate',
  dateofbirth: 'birthDate',
  datadenascimento: 'birthDate',
  datanasc: 'birthDate',
  datanascimento: 'birthDate',
  nascimento: 'birthDate',
  birthdate: 'birthDate',

  nat: 'nationality',
  nation: 'nationality',
  nationality: 'nationality',
  nacionalidade: 'nationality',
  pais: 'nationality',

  secondnat: 'secondNationality',
  '2ndnat': 'secondNationality',
  secondnationality: 'secondNationality',
  segundanacionalidade: 'secondNationality',
  duplacidadania: 'secondNationality',
  outranacionalidade: 'secondNationality',

  foot: 'preferredFoot',
  preferredfoot: 'preferredFoot',
  pepreferido: 'preferredFoot',
  pe: 'preferredFoot',
  pemaisforte: 'preferredFoot',
  pepreferencial: 'preferredFoot',

  weakfoot: 'weakFoot',
  pefraco: 'weakFoot',
  pernafraca: 'weakFoot',
  pepior: 'weakFoot',

  height: 'height',
  altura: 'height',
  alt: 'height',

  weight: 'weight',
  peso: 'weight',

  jerseynumber: 'jerseyNumber',
  squadnumber: 'jerseyNumber',
  camisa: 'jerseyNumber',
  numero: 'jerseyNumber',
  numerodacamisa: 'jerseyNumber',
  no: 'jerseyNumber',

  // --- CLUBE E POSIÇÃO ---
  club: 'club',
  clube: 'club',
  team: 'club',
  equipe: 'club',
  time: 'club',
  equipa: 'club',
  based: 'club',
  clubbased: 'club',

  position: 'position',
  posicao: 'position',
  pos: 'position',
  bestpos: 'position',
  bestposition: 'position',
  selectedposition: 'position',
  positionselected: 'position',

  // --- CAPACIDADES E PERSONALIDADE ---
  ca: 'ca',
  cura: 'ca',
  curability: 'ca',
  currenta: 'ca',
  currentability: 'ca',
  habilidadeatual: 'ca',
  ovr: 'overall',
  overall: 'overall',
  over: 'overall',
  nota: 'overall',
  notageral: 'overall',
  overallrating: 'overall',
  overallscore: 'overall',
  overallability: 'overall',
  ovral: 'overall',
  rating: 'overall',
  bestposrating: 'overall',
  bestrating: 'overall',
  gerrating: 'overall',
  geral: 'overall',

  pa: 'pa',
  pota: 'pa',
  potentiala: 'pa',
  potability: 'pa',
  potentialability: 'pa',
  habilidadepotencial: 'pa',
  pot: 'potential',
  potential: 'potential',
  potencial: 'potential',

  adiff: 'aDiff',
  paadiff: 'aDiff',
  padiff: 'aDiff',
  paca: 'aDiff',
  abilitydiff: 'aDiff',
  diff: 'aDiff',
  diferenca: 'aDiff',
  diferencapa: 'aDiff',

  personality: 'personality',
  personalidade: 'personality',
  personalidadedoatleta: 'personality',

  squadstatus: 'squadStatus',
  agreedplayingtime: 'squadStatus',
  statusnoelenco: 'squadStatus',
  statusequipa: 'squadStatus',
  tempojogocombinado: 'squadStatus',
  papelnoelenco: 'squadStatus',

  condition: 'condition',
  condicao: 'condition',
  con: 'condition',
  morale: 'morale',
  moral: 'morale',
  mor: 'morale',

  // --- FINANÇAS E CONTRATO ---
  value: 'marketValue',
  marketvalue: 'marketValue',
  valor: 'marketValue',
  valordemercado: 'marketValue',
  valordecompra: 'marketValue',
  transfervalue: 'marketValue',
  askingprice: 'marketValue',
  estimatedvalue: 'marketValue',

  salevalue: 'saleValue',
  saleval: 'saleValue',
  valordevenda: 'saleValue',
  precodevenda: 'saleValue',

  salary: 'wage',
  salaries: 'wage',
  wage: 'wage',
  wages: 'wage',
  salario: 'wage',
  salarios: 'wage',
  salariomes: 'wage',
  salariomensal: 'wage',
  salariom: 'wage',
  salariopm: 'wage',
  salariopormes: 'wage',
  salariobase: 'wage',
  salarioatual: 'wage',
  salarioliquido: 'wage',
  salariobruto: 'wage',
  salariodojogador: 'wage',
  salarioestimado: 'wage',
  vencimento: 'wage',
  vencimentos: 'wage',
  vencimentomes: 'wage',
  vencimentomensal: 'wage',
  vencimentom: 'wage',
  vencimentopm: 'wage',
  vencimentopormes: 'wage',
  vencimentobase: 'wage',
  ordenado: 'wage',
  ordenados: 'wage',
  ordenadomes: 'wage',
  ordenadomensal: 'wage',
  ordenadom: 'wage',
  ordenadopm: 'wage',
  ordenadopormes: 'wage',
  ordenadobase: 'wage',
  remuneracao: 'wage',
  remuneracoes: 'wage',
  remuneracaomes: 'wage',
  remuneracaomensal: 'wage',
  remuneracaom: 'wage',
  remuneracaopm: 'wage',
  remuneracaobase: 'wage',
  folhasalarial: 'wage',
  wagepm: 'wage',
  wagem: 'wage',
  wagemonth: 'wage',
  wagemonthly: 'wage',
  monthlywage: 'wage',
  salarypm: 'wage',
  salarym: 'wage',
  salarymonth: 'wage',
  salarymonthly: 'wage',
  monthlysalary: 'wage',
  basicwage: 'wage',
  basicsalary: 'wage',
  playerwage: 'wage',
  playersalary: 'wage',
  currentwage: 'wage',
  currentsalary: 'wage',
  grosswage: 'wage',
  netwage: 'wage',
  pay: 'wage',
  monthlypay: 'wage',
  playerpay: 'wage',

  // Abreviações típicas do FM (PT-BR, PT-PT e EN)
  sal: 'wage',
  salm: 'wage',
  salmes: 'wage',
  salpm: 'wage',
  ord: 'wage',
  ordm: 'wage',
  ordmes: 'wage',
  ordpm: 'wage',
  venc: 'wage',
  vencm: 'wage',
  vencmes: 'wage',
  vencpm: 'wage',

  // Semanal
  wagepw: 'wageWeekly',
  wagew: 'wageWeekly',
  wageweek: 'wageWeekly',
  wageweekly: 'wageWeekly',
  weeklywage: 'wageWeekly',
  wageperweek: 'wageWeekly',
  salarypw: 'wageWeekly',
  salaryw: 'wageWeekly',
  salaryweek: 'wageWeekly',
  salaryweekly: 'wageWeekly',
  weeklysalary: 'wageWeekly',
  salariosemana: 'wageWeekly',
  salariosemanal: 'wageWeekly',
  salarioporsemana: 'wageWeekly',
  salariops: 'wageWeekly',
  salariopw: 'wageWeekly',
  salariosem: 'wageWeekly',
  salsem: 'wageWeekly',
  salps: 'wageWeekly',
  salpw: 'wageWeekly',
  salw: 'wageWeekly',
  vencimentosemana: 'wageWeekly',
  vencimentosemanal: 'wageWeekly',
  vencimentosem: 'wageWeekly',
  vencimentops: 'wageWeekly',
  vencimentopw: 'wageWeekly',
  ordenadosemana: 'wageWeekly',
  ordenadosemanal: 'wageWeekly',
  ordenadosem: 'wageWeekly',
  ordenadops: 'wageWeekly',
  ordenadopw: 'wageWeekly',
  weeklypay: 'wageWeekly',

  // Anual
  wagepa: 'wageAnnual',
  wageyr: 'wageAnnual',
  wageyear: 'wageAnnual',
  annualwage: 'wageAnnual',
  wageperannum: 'wageAnnual',
  wageperyear: 'wageAnnual',
  salarypa: 'wageAnnual',
  salaryyr: 'wageAnnual',
  salaryyear: 'wageAnnual',
  annualsalary: 'wageAnnual',
  salaryperannum: 'wageAnnual',
  salaryperyear: 'wageAnnual',
  salarioano: 'wageAnnual',
  salarioanual: 'wageAnnual',
  salarioporano: 'wageAnnual',
  salariopa: 'wageAnnual',
  salano: 'wageAnnual',
  salpa: 'wageAnnual',
  vencimentoano: 'wageAnnual',
  vencimentoanual: 'wageAnnual',
  ordenadoano: 'wageAnnual',
  ordenadoanual: 'wageAnnual',
  annualpay: 'wageAnnual',

  contract: 'contractUntil',
  contractexpires: 'contractUntil',
  contrato: 'contractUntil',
  expiraem: 'contractUntil',
  fimdocontrato: 'contractUntil',
  terminocontrato: 'contractUntil',
  expires: 'contractUntil',

  releaseclause: 'releaseClause',
  minfeerelease: 'releaseClause',
  minfeereleaseclause: 'releaseClause',
  minimumfeereleaseclause: 'releaseClause',
  multarescisoria: 'releaseClause',
  clausuladerescisao: 'releaseClause',
  clausula: 'releaseClause',
  multa: 'releaseClause',

  // --- PÉS E SELEÇÃO ---
  leftfoot: 'leftFoot',
  peesquerdo: 'leftFoot',
  rightfoot: 'rightFoot',
  pedireito: 'rightFoot',
  caps: 'internationalCaps',
  intcaps: 'internationalCaps',
  internacionalizacoes: 'internationalCaps',
  intgoals: 'internationalGoals',
  golsselecao: 'internationalGoals',

  // --- ATRIBUTOS OCULTOS / FM EXTRA ---
  adaptability: 'attr_adaptability',
  adaptabilidade: 'attr_adaptability',
  ambition: 'attr_ambition',
  ambicao: 'attr_ambition',
  loyalty: 'attr_loyalty',
  lealdade: 'attr_loyalty',
  pressure: 'attr_pressure',
  pressao: 'attr_pressure',
  professionalism: 'attr_professionalism',
  profissionalismo: 'attr_professionalism',
  sportsmanship: 'attr_sportsmanship',
  espiritodesportivo: 'attr_sportsmanship',
  temperament: 'attr_temperament',
  temperamento: 'attr_temperament',
  controversy: 'attr_controversy',
  controversia: 'attr_controversy',
  consistency: 'attr_consistency',
  consistencia: 'attr_consistency',
  dirtiness: 'attr_dirtiness',
  importantmatches: 'attr_importantMatches',
  jogosimportantes: 'attr_importantMatches',
  injuryproneness: 'attr_injuryProneness',
  propensaoalesoes: 'attr_injuryProneness',
  versatility: 'attr_versatility',
  versatilidade: 'attr_versatility',
  influence: 'attr_leadership',
  creativity: 'attr_vision',

  // --- ATRIBUTOS TÉCNICOS (FM 1-20) ---
  corners: 'attr_corners',
  cor: 'attr_corners',
  cantos: 'attr_corners',
  escanteios: 'attr_corners',

  crossing: 'attr_crossing',
  cro: 'attr_crossing',
  cruzamentos: 'attr_crossing',
  cruzamento: 'attr_crossing',

  dribbling: 'attr_dribbling',
  dri: 'attr_dribbling',
  drible: 'attr_dribbling',
  fintas: 'attr_dribbling',

  finishing: 'attr_finishing',
  fin: 'attr_finishing',
  finalizacao: 'attr_finishing',
  remate: 'attr_finishing',

  firsttouch: 'attr_firstTouch',
  fir: 'attr_firstTouch',
  primeirotoque: 'attr_firstTouch',
  toqueprimeiro: 'attr_firstTouch',
  recepcao: 'attr_firstTouch',

  freekicks: 'attr_freeKicks',
  freekicktaking: 'attr_freeKicks',
  fre: 'attr_freeKicks',
  faltas: 'attr_freeKicks',
  livres: 'attr_freeKicks',

  heading: 'attr_heading',
  hea: 'attr_heading',
  cabeceamento: 'attr_heading',
  jogoaereo: 'attr_heading',

  longshots: 'attr_longShots',
  lon: 'attr_longShots',
  remateslonge: 'attr_longShots',
  chuteslonge: 'attr_longShots',
  chutedelonge: 'attr_longShots',

  longthrows: 'attr_longThrows',
  lth: 'attr_longThrows',
  lancamentoslongos: 'attr_longThrows',
  laterais: 'attr_longThrows',
  lancamentos: 'attr_longThrows',

  marking: 'attr_marking',
  mar: 'attr_marking',
  marcacao: 'attr_marking',

  passing: 'attr_passing',
  pas: 'attr_passing',
  passe: 'attr_passing',
  passes: 'attr_passing',

  penaltytaking: 'attr_penaltyTaking',
  pen: 'attr_penaltyTaking',
  penaltis: 'attr_penaltyTaking',
  penalties: 'attr_penaltyTaking',

  tackling: 'attr_tackling',
  tck: 'attr_tackling',
  desarme: 'attr_tackling',
  desarmes: 'attr_tackling',

  technique: 'attr_technique',
  tec: 'attr_technique',
  tecnica: 'attr_technique',

  // --- ATRIBUTOS MENTAIS (FM 1-20) ---
  aggression: 'attr_aggression',
  agg: 'attr_aggression',
  agressividade: 'attr_aggression',

  anticipation: 'attr_anticipation',
  ant: 'attr_anticipation',
  antecipacao: 'attr_anticipation',

  bravery: 'attr_bravery',
  bra: 'attr_bravery',
  bravura: 'attr_bravery',
  coragem: 'attr_bravery',

  composure: 'attr_composure',
  cmp: 'attr_composure',
  compostura: 'attr_composure',
  tranquilidade: 'attr_composure',

  concentration: 'attr_concentration',
  cnt: 'attr_concentration',
  concentracao: 'attr_concentration',

  decisions: 'attr_decisions',
  dec: 'attr_decisions',
  decisoes: 'attr_decisions',

  determination: 'attr_determination',
  det: 'attr_determination',
  determinacao: 'attr_determination',

  flair: 'attr_flair',
  fla: 'attr_flair',
  talento: 'attr_flair',
  imprevisibilidade: 'attr_flair',

  leadership: 'attr_leadership',
  ldr: 'attr_leadership',
  lideranca: 'attr_leadership',

  offtheball: 'attr_offTheBall',
  otb: 'attr_offTheBall',
  desmarcacao: 'attr_offTheBall',
  sembola: 'attr_offTheBall',

  positioning: 'attr_positioning',
  posi: 'attr_positioning',
  posicionamento: 'attr_positioning',

  teamwork: 'attr_teamwork',
  tea: 'attr_teamwork',
  trabalhoemequipe: 'attr_teamwork',
  trabalhodeequipa: 'attr_teamwork',
  coletividade: 'attr_teamwork',

  vision: 'attr_vision',
  vis: 'attr_vision',
  visao: 'attr_vision',
  visaodejogo: 'attr_vision',

  workrate: 'attr_workRate',
  wor: 'attr_workRate',
  indicedetrabalho: 'attr_workRate',
  trabalho: 'attr_workRate',

  // --- ATRIBUTOS FÍSICOS (FM 1-20) ---
  acceleration: 'attr_acceleration',
  acc: 'attr_acceleration',
  aceleracao: 'attr_acceleration',

  agility: 'attr_agility',
  agi: 'attr_agility',
  agilidade: 'attr_agility',

  balance: 'attr_balance',
  bal: 'attr_balance',
  equilibrio: 'attr_balance',

  jumpingreach: 'attr_jumpingReach',
  jum: 'attr_jumpingReach',
  impulsao: 'attr_jumpingReach',
  alcancevertical: 'attr_jumpingReach',

  naturalfitness: 'attr_naturalFitness',
  natfit: 'attr_naturalFitness',
  aptidaofisica: 'attr_naturalFitness',
  aptidao: 'attr_naturalFitness',

  pace: 'attr_pace',
  pac: 'attr_pace',
  velocidade: 'attr_pace',

  stamina: 'attr_stamina',
  sta: 'attr_stamina',
  resistencia: 'attr_stamina',

  strength: 'attr_strength',
  str: 'attr_strength',
  forca: 'attr_strength',

  // --- ATRIBUTOS DE GOLEIRO (FM 1-20) ---
  aerialreach: 'attr_aerialReach',
  aer: 'attr_aerialReach',
  alcanceaereo: 'attr_aerialReach',

  commandofarea: 'attr_commandOfArea',
  cmd: 'attr_commandOfArea',
  comandodearea: 'attr_commandOfArea',

  communication: 'attr_communication',
  com: 'attr_communication',
  comunicacao: 'attr_communication',

  eccentricity: 'attr_eccentricity',
  ecc: 'attr_eccentricity',
  excentricidade: 'attr_eccentricity',

  handling: 'attr_handling',
  han: 'attr_handling',
  jogodemaos: 'attr_handling',
  firmeza: 'attr_handling',

  kicking: 'attr_kicking',
  kic: 'attr_kicking',
  pontapes: 'attr_kicking',
  tirodemeta: 'attr_kicking',

  oneonones: 'attr_oneOnOnes',
  '1v1': 'attr_oneOnOnes',
  umcontraum: 'attr_oneOnOnes',

  reflexes: 'attr_reflexes',
  ref: 'attr_reflexes',
  reflexos: 'attr_reflexes',

  rushingout: 'attr_rushingOut',
  tro: 'attr_rushingOut',
  saidadogol: 'attr_rushingOut',
  saidas: 'attr_rushingOut',

  punching: 'attr_punching',
  tendencytopunch: 'attr_punching',
  pun: 'attr_punching',
  desviopunhos: 'attr_punching',
  socos: 'attr_punching',

  throwing: 'attr_throwing',
  thr: 'attr_throwing',
  reposicao: 'attr_throwing',
  lancamentosmao: 'attr_throwing',

  // --- ESTATÍSTICAS DA TEMPORADA ---
  apps: 'stat_matches',
  partidas: 'stat_matches',
  jogos: 'stat_matches',
  appearances: 'stat_matches',

  goals: 'stat_goals',
  gls: 'stat_goals',
  gols: 'stat_goals',

  assists: 'stat_assists',
  ast: 'stat_assists',
  assistencias: 'stat_assists',

  avrat: 'stat_averageRating',
  averagerating: 'stat_averageRating',
  notamedia: 'stat_averageRating',
  classificacaomedia: 'stat_averageRating',

  yellowcards: 'stat_yellowCards',
  yel: 'stat_yellowCards',
  cartoesamarelos: 'stat_yellowCards',
  amarelos: 'stat_yellowCards',

  redcards: 'stat_redCards',
  red: 'stat_redCards',
  cartoesvermelhos: 'stat_redCards',
  vermelhos: 'stat_redCards',

  cleansheets: 'stat_cleanSheets',
  cln: 'stat_cleanSheets',
  jogossemsofrergol: 'stat_cleanSheets',
  semgolos: 'stat_cleanSheets',

  minutes: 'stat_minutesPlayed',
  mins: 'stat_minutesPlayed',
  minutos: 'stat_minutesPlayed',
  minutosjogados: 'stat_minutesPlayed',
};

/**
 * Converte um cabeçalho bruto no nome canônico do campo, se reconhecido.
 */
export function mapCanonicalField(rawHeader: string): string | null {
  const normalized = normalizeHeaderKey(rawHeader);
  if (HEADER_MAPPING[normalized]) {
    return HEADER_MAPPING[normalized];
  }

  // Fallback inteligente abrangente para colunas de salário / wage (FM2008 e FM26)
  if (
    normalized.includes('wage') ||
    normalized.includes('salary') ||
    normalized.includes('salario') ||
    normalized.includes('ordenado') ||
    normalized.includes('vencimento') ||
    normalized.includes('remuneracao') ||
    normalized === 'sal' ||
    normalized.startsWith('salm') ||
    normalized.startsWith('salpm') ||
    normalized.startsWith('salmes') ||
    normalized.startsWith('salsem') ||
    normalized.startsWith('salpw') ||
    normalized.startsWith('salps') ||
    normalized.startsWith('salw') ||
    normalized === 'ord' ||
    normalized.startsWith('ordm') ||
    normalized.startsWith('ordpm') ||
    normalized.startsWith('ordmes') ||
    normalized.startsWith('ordsem') ||
    normalized.startsWith('ordpw') ||
    normalized.startsWith('ordps') ||
    normalized.startsWith('ordw') ||
    normalized === 'venc' ||
    normalized.startsWith('vencm') ||
    normalized.startsWith('vencpm') ||
    normalized.startsWith('vencmes') ||
    normalized.startsWith('vencsem') ||
    normalized.startsWith('vencpw') ||
    normalized.startsWith('vencps') ||
    normalized.startsWith('vencw')
  ) {
    if (
      normalized.includes('week') ||
      normalized.includes('seman') ||
      normalized.includes('sem') ||
      normalized.includes('pw') ||
      normalized.includes('ps')
    ) {
      return 'wageWeekly';
    }
    if (
      normalized.includes('annu') ||
      normalized.includes('year') ||
      normalized.includes('ano') ||
      normalized.includes('pa')
    ) {
      return 'wageAnnual';
    }
    return 'wage';
  }

  return null;
}

/**
 * Normaliza uma string mantendo acentos e limpando espaços extras e caracteres vazios como '-'.
 */
export function cleanText(str?: unknown): string {
  if (str === null || str === undefined) return '';
  const text = String(str).trim().replace(/\s+/g, ' ');
  if (text === '-' || text === '—' || text === 'N/D' || text === 'N/A' || text.toLowerCase() === 'null') {
    return '';
  }
  return text;
}

/**
 * Converte com segurança uma string em número. Retorna fallback para vazios, '-' ou NaN.
 */
export function parseNumeric(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const str = cleanText(value);
  if (!str) return fallback;
  const cleaned = str.replace(/\s/g, '').replace(/%/g, '');
  const parsed = Number(cleaned.replace(',', '.'));
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Trata valores monetários em texto para números BRL puros.
 */
export function parseMonetaryBRL(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const str = cleanText(value);
  if (!str || str === '-' || str === 'N/A' || str === 'n/a') return fallback;

  if (typeof value === 'number' && !isNaN(value)) return Math.round(value);

  // Suporte a intervalos de valores do FM (ex: "€50M - €70M" ou "£10M - £15M")
  if (str.includes(' - ')) {
    const parts = str.split(' - ');
    if (parts.length === 2) {
      const v1 = parseMonetaryBRL(parts[0], fallback);
      const v2 = parseMonetaryBRL(parts[1], fallback);
      if (v1 > 0 && v2 > 0) {
        return Math.round((v1 + v2) / 2);
      }
      return v2 > 0 ? v2 : v1;
    }
  }

  const lower = str.toLowerCase();
  let multiplier = 1;

  // Remove sufixos como p/w, p/m, /w, /m, /mês, /mes antes de checar por multiplicadores (k, mi, bi)
  const cleanMultiplierStr = lower
    .replace(/p\/[wmya]/g, '')
    .replace(/\/[wmya]/g, '')
    .replace(/\/mês|\/mes|\/semana|\/ano/g, '')
    .replace(/per\s+(week|month|year|annum)/g, '');

  if (cleanMultiplierStr.includes('bi')) {
    multiplier = 1_000_000_000;
  } else if (cleanMultiplierStr.includes('mil') || cleanMultiplierStr.includes('k')) {
    multiplier = 1_000;
  } else if (cleanMultiplierStr.includes('mi') || /\b\d+\s*m\b/.test(cleanMultiplierStr) || cleanMultiplierStr.includes('m')) {
    multiplier = 1_000_000;
  }

  const numStr = str
    .replace(/[rR]\$/g, '')
    .replace(/[€$£¥]/g, '')
    .replace(/[a-zA-Z]/g, '')
    .trim();

  if (!numStr || numStr === '-') return fallback;

  let normalizedNum = numStr;
  if (multiplier > 1) {
    normalizedNum = normalizedNum.replace(/\./g, '').replace(',', '.');
  } else {
    if (normalizedNum.includes('.') && normalizedNum.includes(',')) {
      normalizedNum = normalizedNum.replace(/\./g, '').replace(',', '.');
    } else if (normalizedNum.includes('.') && !normalizedNum.includes(',')) {
      const parts = normalizedNum.split('.');
      if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
        normalizedNum = normalizedNum.replace(/\./g, '');
      }
    } else if (normalizedNum.includes(',')) {
      normalizedNum = normalizedNum.replace(',', '.');
    }
  }

  const base = parseFloat(normalizedNum);
  return isNaN(base) ? fallback : Math.round(base * multiplier);
}

/**
 * Normaliza datas para o formato ISO YYYY-MM-DD.
 */
export function parseDateISO(value?: unknown, defaultDate = '2028-12-31'): string {
  const str = cleanText(value);
  if (!str) return defaultDate;

  // DD/MM/YYYY ou DD-MM-YYYY ou DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // MM/YYYY
  const myMatch = str.match(/^(\d{1,2})[\/\-\.](\d{4})$/);
  if (myMatch) {
    const month = myMatch[1].padStart(2, '0');
    const year = myMatch[2];
    return `${year}-${month}-30`;
  }

  // Se tiver só ano (ex: 2027)
  const yearMatch = str.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    return `${yearMatch[1]}-12-31`;
  }

  return defaultDate;
}

/**
 * Normaliza altura para centímetros (inteiro).
 * Ex: "185 cm" -> 185; "1.85 m" -> 185; "6'1\"" -> 185
 */
export function parseHeightCm(value?: unknown): number | undefined {
  const str = cleanText(value);
  if (!str) return undefined;

  // Formato imperial: 6'1"
  if (str.includes("'")) {
    const parts = str.replace(/"/g, '').split("'");
    const feet = parseNumeric(parts[0], 0);
    const inches = parseNumeric(parts[1], 0);
    if (feet > 0) {
      return Math.round(feet * 30.48 + inches * 2.54);
    }
  }

  // Formato "1.85 m" ou "1,85 m"
  if (str.toLowerCase().includes('m') && (str.includes('.') || str.includes(','))) {
    const num = parseFloat(str.replace(',', '.').replace(/[^0-9.]/g, ''));
    if (!isNaN(num) && num < 3) {
      return Math.round(num * 100);
    }
  }

  const num = parseNumeric(str.replace(/[^0-9]/g, ''), 0);
  if (num >= 120 && num <= 230) {
    return Math.round(num);
  }
  return undefined;
}

/**
 * Normaliza peso para quilogramas (inteiro).
 * Ex: "78 kg" -> 78; "172 lbs" -> 78
 */
export function parseWeightKg(value?: unknown): number | undefined {
  const str = cleanText(value);
  if (!str) return undefined;

  // Libras
  if (str.toLowerCase().includes('lb')) {
    const lbs = parseNumeric(str.replace(/[^0-9]/g, ''), 0);
    if (lbs > 0) {
      return Math.round(lbs * 0.453592);
    }
  }

  const num = parseNumeric(str.replace(/[^0-9]/g, ''), 0);
  if (num >= 40 && num <= 160) {
    return Math.round(num);
  }
  return undefined;
}

/**
 * Normaliza pé preferido para 'Destro', 'Canhoto' ou 'Ambidestro'.
 */
export function normalizeFoot(val?: string): 'Destro' | 'Canhoto' | 'Ambidestro' {
  if (!val) return 'Destro';
  const v = val.toLowerCase().trim();
  if (v.includes('canhoto') || v.includes('left') || v.includes('esquerdo')) return 'Canhoto';
  if (v.includes('ambidestro') || v.includes('both') || v.includes('ambos') || v.includes('either')) {
    return 'Ambidestro';
  }
  return 'Destro';
}

/**
 * Converte escala FM (1 a 200 de CA ou 1 a 20) para a escala FM Universe (1 a 99).
 */
export function normalizeRating(rawVal: unknown, defaultVal = 0): number {
  const num = parseNumeric(rawVal, defaultVal);
  if (num <= 0) return defaultVal;

  // Escala 1-200 (CA/PA oficial do FM)
  if (num > 99) {
    return Math.min(99, Math.max(1, Math.round((num / 200) * 99)));
  }

  // Escala 1-20
  if (num <= 20) {
    return Math.min(99, Math.max(1, Math.round(((num - 1) / 19) * 79 + 20)));
  }

  // Já na escala 1-99
  return Math.min(99, Math.max(1, Math.round(num)));
}

/**
 * Normaliza atributo individual do FM26 (escala 1 a 20).
 */
export function parseAttribute20(value?: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const str = cleanText(value);
  if (!str) return undefined;
  const num = parseNumeric(str, -1);
  if (num < 1) return undefined;
  if (num > 20) {
    // Se vier em escala 1-99, converte de volta para 1-20
    return Math.min(20, Math.max(1, Math.round(((num - 20) / 79) * 19 + 1)));
  }
  return Math.min(20, Math.max(1, Math.round(num)));
}

/**
 * Mapeia uma sigla de posição única do FM para PlayerPosition.
 */
function mapSinglePosition(token: string): PlayerPosition | null {
  const clean = token.toUpperCase().trim();
  if (!clean) return null;

  if (clean.includes('GK') || clean.includes('GOL') || clean.includes('GR')) return 'GK';
  if (clean.includes('CB') || clean.includes('DC') || clean.includes('ZAG')) return 'CB';
  if (clean.includes('LB') || clean.includes('DL') || clean.includes('LE')) return 'LB';
  if (clean.includes('RB') || clean.includes('DR') || clean.includes('LD')) return 'RB';
  if (clean.includes('LWB') || clean.includes('WBL') || clean.includes('AL')) return 'LWB';
  if (clean.includes('RWB') || clean.includes('WBR') || clean.includes('AD')) return 'RWB';
  if (clean.includes('CDM') || clean.includes('DM') || clean.includes('VOL')) return 'CDM';
  if (clean.includes('CAM') || clean.includes('AMC') || clean.includes('MEI')) return 'CAM';
  if (clean.includes('LM') || clean.includes('ML')) return 'LM';
  if (clean.includes('RM') || clean.includes('MR')) return 'RM';
  if (clean.includes('LW') || clean.includes('AML') || clean.includes('PE')) return 'LW';
  if (clean.includes('RW') || clean.includes('AMR') || clean.includes('PD')) return 'RW';
  if (clean.includes('ST') || clean.includes('CF') || clean.includes('ATA') || clean.includes('CA')) return 'ST';
  if (clean.includes('CM') || clean.includes('MC') || clean.includes('M (C)')) return 'CM';

  return null;
}

/**
 * Determina a categoria de posição a partir de PlayerPosition.
 */
function getCategoryFromPosition(pos: PlayerPosition): PositionCategory {
  if (pos === 'GK') return 'GOLEIRO';
  if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos)) return 'DEFENSOR';
  if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(pos)) return 'MEIO-CAMPISTA';
  return 'ATACANTE';
}

/**
 * Decompõe a string de posições do FM26 (ex: "D (C), DM, M (C)" ou "ST (C), AM (RL)")
 * separando a posição natural (primeira) e posições secundárias (subsequentes).
 */
export function parsePositionsString(posString?: string): {
  position: PlayerPosition;
  positionCategory: PositionCategory;
  secondaryPositions: PlayerPosition[];
} {
  if (!posString) {
    return { position: 'CM', positionCategory: 'MEIO-CAMPISTA', secondaryPositions: [] };
  }

  const raw = String(posString).trim();
  // Divide por vírgula, barra ou ponto-e-vírgula
  const rawParts = raw.split(/[,;\/]+/).map((p) => p.trim()).filter(Boolean);

  if (rawParts.length === 0) {
    return { position: 'CM', positionCategory: 'MEIO-CAMPISTA', secondaryPositions: [] };
  }

  // Posição primária/natural
  const primaryMapped = mapSinglePosition(rawParts[0]) || 'CM';
  const positionCategory = getCategoryFromPosition(primaryMapped);

  // Posições secundárias
  const secondarySet = new Set<PlayerPosition>();

  for (let i = 1; i < rawParts.length; i++) {
    const part = rawParts[i];
    // Trata posições múltiplas com parênteses do FM (ex: "AM (RL)" -> AML e AMR)
    if (part.includes('(RL)') || part.includes('(RLC)')) {
      secondarySet.add('LW');
      secondarySet.add('RW');
      if (part.includes('C')) secondarySet.add('CAM');
    } else {
      const mapped = mapSinglePosition(part);
      if (mapped && mapped !== primaryMapped) {
        secondarySet.add(mapped);
      }
    }
  }

  secondarySet.delete(primaryMapped);

  return {
    position: primaryMapped,
    positionCategory,
    secondaryPositions: Array.from(secondarySet),
  };
}

/**
 * Compatibilidade legada com normalizePosition.
 */
export function normalizePosition(posString?: string): {
  position: PlayerPosition;
  positionCategory: PositionCategory;
} {
  const res = parsePositionsString(posString);
  return { position: res.position, positionCategory: res.positionCategory };
}

/**
 * Converte uma nota de 1-20 para escala 1-99 de forma não linear.
 */
function scale20To99(val20?: number, fallback = 70): number {
  if (!val20 || val20 < 1) return fallback;
  return Math.min(99, Math.max(1, Math.round(((val20 - 1) / 19) * 79 + 20)));
}

/**
 * Deriva os 6 atributos sintéticos (1-99) a partir dos atributos reais 1-20 do FM26.
 */
export function deriveAttributesFromFM20(
  tech: Partial<PlayerTechnicalAttributes>,
  mental: Partial<PlayerMentalAttributes>,
  phys: Partial<PlayerPhysicalAttributes>,
  gk: Partial<PlayerGoalkeeperAttributes>,
  isGK: boolean,
  overall: number
): { pace: number; shooting: number; passing: number; dribbling: number; defending: number; physical: number } {
  const hasRealAttributes =
    Object.keys(tech).length > 0 ||
    Object.keys(mental).length > 0 ||
    Object.keys(phys).length > 0 ||
    Object.keys(gk).length > 0;

  if (!hasRealAttributes) {
    // Fallback derivado diretamente do overall
    return {
      pace: overall,
      shooting: Math.max(40, overall - 5),
      passing: Math.max(40, overall - 3),
      dribbling: Math.max(40, overall - 4),
      defending: Math.max(30, overall - 10),
      physical: Math.max(40, overall - 2),
    };
  }

  if (isGK) {
    const pace = scale20To99(phys.acceleration ?? phys.pace, overall - 15);
    const shooting = scale20To99(gk.kicking, 50);
    const passing = scale20To99(gk.throwing ?? tech.passing, 55);
    const dribbling = scale20To99(tech.firstTouch, 45);
    const defending = Math.round(
      scale20To99(gk.reflexes, overall) * 0.4 +
      scale20To99(gk.handling, overall) * 0.3 +
      scale20To99(gk.oneOnOnes, overall) * 0.3
    );
    const physical = Math.round(
      scale20To99(phys.strength, overall) * 0.5 +
      scale20To99(phys.jumpingReach, overall) * 0.5
    );
    return { pace, shooting, passing, dribbling, defending, physical };
  }

  const pace = Math.round(
    scale20To99(phys.acceleration, overall) * 0.5 +
    scale20To99(phys.pace, overall) * 0.5
  );

  const shooting = Math.round(
    scale20To99(tech.finishing, overall - 5) * 0.45 +
    scale20To99(tech.longShots, overall - 5) * 0.25 +
    scale20To99(tech.heading, overall - 5) * 0.15 +
    scale20To99(mental.composure, overall) * 0.15
  );

  const passing = Math.round(
    scale20To99(tech.passing, overall) * 0.4 +
    scale20To99(tech.technique, overall) * 0.25 +
    scale20To99(mental.vision, overall) * 0.25 +
    scale20To99(tech.crossing, overall) * 0.1
  );

  const dribbling = Math.round(
    scale20To99(tech.dribbling, overall) * 0.4 +
    scale20To99(tech.firstTouch, overall) * 0.3 +
    scale20To99(phys.agility, overall) * 0.15 +
    scale20To99(mental.flair, overall) * 0.15
  );

  const defending = Math.round(
    scale20To99(tech.tackling, overall - 10) * 0.4 +
    scale20To99(tech.marking, overall - 10) * 0.3 +
    scale20To99(mental.positioning, overall) * 0.2 +
    scale20To99(mental.anticipation, overall) * 0.1
  );

  const physical = Math.round(
    scale20To99(phys.strength, overall) * 0.35 +
    scale20To99(phys.stamina, overall) * 0.35 +
    scale20To99(phys.balance, overall) * 0.15 +
    scale20To99(phys.jumpingReach, overall) * 0.15
  );

  return {
    pace: Math.min(99, Math.max(1, pace)),
    shooting: Math.min(99, Math.max(1, shooting)),
    passing: Math.min(99, Math.max(1, passing)),
    dribbling: Math.min(99, Math.max(1, dribbling)),
    defending: Math.min(99, Math.max(1, defending)),
    physical: Math.min(99, Math.max(1, physical)),
  };
}

/**
 * Normaliza um registro individual linha a linha.
 */
export function normalizePlayerRow(
  rawRecord: Record<string, string>,
  rowIndex: number,
  databaseSource?: 'FM2008' | 'FM26'
): { player: FM26ParsedPlayer; issues: string[] } {
  const issues: string[] = [];

  // Mapeia os campos da linha bruta usando os nomes canônicos
  const mapped: Record<string, string> = {};
  for (const [rawKey, val] of Object.entries(rawRecord)) {
    const canonicalKey = mapCanonicalField(rawKey);
    if (canonicalKey && val !== undefined && val !== null) {
      mapped[canonicalKey] = cleanText(val);
    }
  }

  // 1. Nome
  const rawName = mapped.name || mapped.fullName || '';
  const cleanName = cleanText(rawName);
  if (!cleanName) {
    issues.push(`Linha ${rowIndex}: Nome do jogador está vazio.`);
  }

  // 2. Idade
  let age = parseNumeric(mapped.age, 0);
  if (age <= 0 || age > 55) {
    if (mapped.birthDate) {
      const yearMatch = mapped.birthDate.match(/\d{4}/);
      if (yearMatch) {
        const birthYear = parseInt(yearMatch[0], 10);
        age = Math.max(15, 2026 - birthYear);
      } else {
        issues.push(`Linha ${rowIndex}: Idade inválida (${mapped.age || 'vazia'}). Atribuída idade padrão 24.`);
        age = 24;
      }
    } else {
      issues.push(`Linha ${rowIndex}: Idade inválida (${mapped.age || 'vazia'}). Atribuída idade padrão 24.`);
      age = 24;
    }
  }

  // 3. Clube
  const clubName = cleanText(mapped.club) || 'Sem Clube';

  // 4. Nacionalidade
  const nationality = cleanText(mapped.nationality) || 'Brasil';

  // 5. Posição (natural e secundárias)
  const { position, positionCategory, secondaryPositions } = parsePositionsString(mapped.position);

  // Determina antecipadamente se o registro pertence ao FM2008 (Genie Scout)
  const isFM2008 =
    databaseSource === 'FM2008' ||
    (databaseSource !== 'FM26' && (
      'A Diff' in rawRecord ||
      'a diff' in rawRecord ||
      'A diff' in rawRecord ||
      'Pot A' in rawRecord ||
      'pot a' in rawRecord ||
      'Unique ID' in rawRecord ||
      'unique id' in rawRecord ||
      'Sale Value' in rawRecord ||
      'sale value' in rawRecord ||
      Boolean(mapped.aDiff) ||
      Boolean(mapped.saleValue) ||
      Object.keys(rawRecord).some((k) => {
        const nk = normalizeHeaderKey(k);
        return nk === 'pota' || nk === 'adiff' || nk === 'salevalue' || nk === 'uniqueid';
      })
    ));

  // 6. Ratings: CA, PA, A Diff e OVR / POT
  // O campo Pot A deve ser usado como PA (escala oficial FM 1-200).
  const rawPa = parseNumeric(mapped.pa, 0);

  // O campo A Diff representa a diferença PA-CA
  const rawADiff = mapped.aDiff !== undefined && mapped.aDiff !== '' ? parseNumeric(mapped.aDiff, NaN) : NaN;
  let rawCa = parseNumeric(mapped.ca, 0);

  // Portanto CA deve ser calculada como Pot A - A Diff (Ex: Pot A 195 - A Diff 8 = CA 187)
  if ((rawCa <= 0 || isNaN(rawCa)) && rawPa > 0 && !isNaN(rawADiff)) {
    rawCa = Math.max(1, rawPa - rawADiff);
  }

  // Se ainda não temos CA, mas temos overall em escala oficial FM (100-200)
  const rawOverall = parseNumeric(mapped.overall, 0);
  if ((rawCa <= 0 || isNaN(rawCa)) && rawOverall > 99) {
    rawCa = rawOverall;
  }

  const ca = rawCa > 0 ? rawCa : undefined;
  const pa = rawPa > 0 ? rawPa : undefined;
  const aDiff = !isNaN(rawADiff) ? rawADiff : (pa && ca && pa >= ca ? pa - ca : undefined);

  // O OVR exibido na prévia deve ser calculado a partir da CA, e NÃO usar fallback 70.
  // Se houver coluna Overall explícita em escala 1-99, preserva-a diretamente.
  let overall = 0;
  if (rawOverall > 0 && rawOverall <= 99) {
    overall = rawOverall;
  } else if (ca && ca > 0) {
    overall = Math.min(99, Math.max(1, Math.round((ca / 200) * 99)));
  } else if (rawOverall > 99) {
    overall = Math.min(99, Math.max(1, Math.round((rawOverall / 200) * 99)));
  }

  // POT: se houver valor explícito 1-99 na coluna potential/POT, preserva-o;
  // se houver PA (Pot A) em escala FM (1-200), calcula em escala 1-99;
  const rawPotVal = mapped.potential ? parseNumeric(mapped.potential, 0) : 0;
  let potential = 0;
  if (rawPotVal > 0 && rawPotVal <= 99) {
    potential = rawPotVal;
  } else if (pa && pa > 0) {
    potential = Math.min(99, Math.max(1, Math.round((pa / 200) * 99)));
  } else if (rawPotVal > 99) {
    potential = Math.min(99, Math.max(1, Math.round((rawPotVal / 200) * 99)));
  }

  // Sincroniza se potential menor que overall ou se não foi informado
  if (potential === 0 && overall > 0) {
    potential = overall;
  } else if (potential > 0 && overall > 0 && potential < overall) {
    potential = overall;
  }

  // 7. Finanças: Value, Sale Value e Salário
  const saleValue = mapped.saleValue ? parseMonetaryBRL(mapped.saleValue, 0) : undefined;
  let marketValue = mapped.marketValue ? parseMonetaryBRL(mapped.marketValue, 0) : 0;
  if (marketValue === 0 && saleValue && saleValue > 0) {
    marketValue = saleValue;
  }
  // Se for FM26 e não tiver marketValue nem saleValue, atribui fallback padrão, mas para FM2008 preserva o valor real ou 0
  if (marketValue === 0 && !isFM2008) {
    marketValue = 1_000_000;
  }

  // O salário não existe no CSV atual; não atribua R$50.000 a todos os jogadores.
  // Deixe salário como 0/ausente até termos uma fonte real.
  const rawWageStr = mapped.wage || '';
  let wage = parseMonetaryBRL(rawWageStr, 0);

  // Reconhece formato semanal (p/w, /w, weekly) ou anual na própria coluna Wage se informada
  const isWeeklyWage =
    Boolean(mapped.wageWeekly) ||
    /p\/w|\/w|per week|semanal|p\.w/i.test(rawWageStr);
  const isAnnualWage =
    Boolean(mapped.wageAnnual) ||
    /p\/a|\/a|per year|per annum|anual|p\.a/i.test(rawWageStr);

  if (wage > 0) {
    if (isWeeklyWage) {
      wage = Math.round(wage * 4.33);
    } else if (isAnnualWage) {
      wage = Math.round(wage / 12);
    }
  } else {
    if (mapped.wageWeekly) {
      wage = Math.round(parseMonetaryBRL(mapped.wageWeekly, 0) * 4.33);
    } else if (mapped.wageAnnual) {
      wage = Math.round(parseMonetaryBRL(mapped.wageAnnual, 0) / 12);
    }
  }

  // Fallback de R$ 50.000 APENAS para FM26 se for 0. Para FM2008 permanece 0 (ausente).
  if (wage === 0 && !isFM2008) {
    wage = 50_000;
  }
  const releaseClause = mapped.releaseClause ? parseMonetaryBRL(mapped.releaseClause) : undefined;

  // 8. Atributos Técnicos 1-20
  const technicalAttributes: PlayerTechnicalAttributes = {};
  if (mapped.attr_corners) technicalAttributes.corners = parseAttribute20(mapped.attr_corners);
  if (mapped.attr_crossing) technicalAttributes.crossing = parseAttribute20(mapped.attr_crossing);
  if (mapped.attr_dribbling) technicalAttributes.dribbling = parseAttribute20(mapped.attr_dribbling);
  if (mapped.attr_finishing) technicalAttributes.finishing = parseAttribute20(mapped.attr_finishing);
  if (mapped.attr_firstTouch) technicalAttributes.firstTouch = parseAttribute20(mapped.attr_firstTouch);
  if (mapped.attr_freeKicks) technicalAttributes.freeKicks = parseAttribute20(mapped.attr_freeKicks);
  if (mapped.attr_heading) technicalAttributes.heading = parseAttribute20(mapped.attr_heading);
  if (mapped.attr_longShots) technicalAttributes.longShots = parseAttribute20(mapped.attr_longShots);
  if (mapped.attr_longThrows) technicalAttributes.longThrows = parseAttribute20(mapped.attr_longThrows);
  if (mapped.attr_marking) technicalAttributes.marking = parseAttribute20(mapped.attr_marking);
  if (mapped.attr_passing) technicalAttributes.passing = parseAttribute20(mapped.attr_passing);
  if (mapped.attr_penaltyTaking) technicalAttributes.penaltyTaking = parseAttribute20(mapped.attr_penaltyTaking);
  if (mapped.attr_tackling) technicalAttributes.tackling = parseAttribute20(mapped.attr_tackling);
  if (mapped.attr_technique) technicalAttributes.technique = parseAttribute20(mapped.attr_technique);

  // 9. Atributos Mentais 1-20
  const mentalAttributes: PlayerMentalAttributes = {};
  if (mapped.attr_aggression) mentalAttributes.aggression = parseAttribute20(mapped.attr_aggression);
  if (mapped.attr_anticipation) mentalAttributes.anticipation = parseAttribute20(mapped.attr_anticipation);
  if (mapped.attr_bravery) mentalAttributes.bravery = parseAttribute20(mapped.attr_bravery);
  if (mapped.attr_composure) mentalAttributes.composure = parseAttribute20(mapped.attr_composure);
  if (mapped.attr_concentration) mentalAttributes.concentration = parseAttribute20(mapped.attr_concentration);
  if (mapped.attr_decisions) mentalAttributes.decisions = parseAttribute20(mapped.attr_decisions);
  if (mapped.attr_determination) mentalAttributes.determination = parseAttribute20(mapped.attr_determination);
  if (mapped.attr_flair) mentalAttributes.flair = parseAttribute20(mapped.attr_flair);
  if (mapped.attr_leadership) mentalAttributes.leadership = parseAttribute20(mapped.attr_leadership);
  if (mapped.attr_offTheBall) mentalAttributes.offTheBall = parseAttribute20(mapped.attr_offTheBall);
  if (mapped.attr_positioning) mentalAttributes.positioning = parseAttribute20(mapped.attr_positioning);
  if (mapped.attr_teamwork) mentalAttributes.teamwork = parseAttribute20(mapped.attr_teamwork);
  if (mapped.attr_vision) mentalAttributes.vision = parseAttribute20(mapped.attr_vision);
  if (mapped.attr_workRate) mentalAttributes.workRate = parseAttribute20(mapped.attr_workRate);

  // 10. Atributos Físicos 1-20
  const physicalAttributes: PlayerPhysicalAttributes = {};
  if (mapped.attr_acceleration) physicalAttributes.acceleration = parseAttribute20(mapped.attr_acceleration);
  if (mapped.attr_agility) physicalAttributes.agility = parseAttribute20(mapped.attr_agility);
  if (mapped.attr_balance) physicalAttributes.balance = parseAttribute20(mapped.attr_balance);
  if (mapped.attr_jumpingReach) physicalAttributes.jumpingReach = parseAttribute20(mapped.attr_jumpingReach);
  if (mapped.attr_naturalFitness) physicalAttributes.naturalFitness = parseAttribute20(mapped.attr_naturalFitness);
  if (mapped.attr_pace) physicalAttributes.pace = parseAttribute20(mapped.attr_pace);
  if (mapped.attr_stamina) physicalAttributes.stamina = parseAttribute20(mapped.attr_stamina);
  if (mapped.attr_strength) physicalAttributes.strength = parseAttribute20(mapped.attr_strength);

  // 11. Atributos de Goleiro 1-20
  const goalkeeperAttributes: PlayerGoalkeeperAttributes = {};
  if (mapped.attr_aerialReach) goalkeeperAttributes.aerialReach = parseAttribute20(mapped.attr_aerialReach);
  if (mapped.attr_commandOfArea) goalkeeperAttributes.commandOfArea = parseAttribute20(mapped.attr_commandOfArea);
  if (mapped.attr_communication) goalkeeperAttributes.communication = parseAttribute20(mapped.attr_communication);
  if (mapped.attr_eccentricity) goalkeeperAttributes.eccentricity = parseAttribute20(mapped.attr_eccentricity);
  if (mapped.attr_handling) goalkeeperAttributes.handling = parseAttribute20(mapped.attr_handling);
  if (mapped.attr_kicking) goalkeeperAttributes.kicking = parseAttribute20(mapped.attr_kicking);
  if (mapped.attr_oneOnOnes) goalkeeperAttributes.oneOnOnes = parseAttribute20(mapped.attr_oneOnOnes);
  if (mapped.attr_reflexes) goalkeeperAttributes.reflexes = parseAttribute20(mapped.attr_reflexes);
  if (mapped.attr_rushingOut) goalkeeperAttributes.rushingOut = parseAttribute20(mapped.attr_rushingOut);
  if (mapped.attr_punching) goalkeeperAttributes.punching = parseAttribute20(mapped.attr_punching);
  if (mapped.attr_throwing) goalkeeperAttributes.throwing = parseAttribute20(mapped.attr_throwing);

  // 12. Atributos sintéticos 1-99
  const attributes = deriveAttributesFromFM20(
    technicalAttributes,
    mentalAttributes,
    physicalAttributes,
    goalkeeperAttributes,
    position === 'GK',
    overall
  );

  // 13. Estatísticas da temporada
  const hasStats =
    mapped.stat_matches !== undefined ||
    mapped.stat_goals !== undefined ||
    mapped.stat_assists !== undefined ||
    mapped.stat_averageRating !== undefined;

  const defaultMatches = 0;
  const defaultGoals = 0;
  const defaultAssists = 0;
  const defaultRating = 6.5;

  const stats: PlayerStats = {
    matches: parseNumeric(mapped.stat_matches, defaultMatches),
    goals: parseNumeric(mapped.stat_goals, defaultGoals),
    assists: parseNumeric(mapped.stat_assists, defaultAssists),
    averageRating: parseNumeric(mapped.stat_averageRating, defaultRating),
    yellowCards: parseNumeric(mapped.stat_yellowCards, 0),
    redCards: parseNumeric(mapped.stat_redCards, 0),
    cleanSheets: parseNumeric(mapped.stat_cleanSheets, 0),
    minutesPlayed: parseNumeric(mapped.stat_minutesPlayed, 0),
  };

  // 14. Chave canônica determinística de deduplicação
  const normName = cleanName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
  const normClub = clubName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
  const normNat = nationality
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

  const resolvedSource: 'FM2008' | 'FM26' = isFM2008 ? 'FM2008' : 'FM26';

  const rawExtId = mapped.externalId ? String(mapped.externalId).trim() : undefined;

  const deterministicId = generateDeterministicPlayerId(
    cleanName,
    nationality,
    clubName,
    rawExtId,
    resolvedSource
  );

  const deduplicationKey = rawExtId
    ? (resolvedSource === 'FM2008' ? `fm2008_uid_${rawExtId.toLowerCase()}` : `fm26_uid_${rawExtId.toLowerCase()}`)
    : `${resolvedSource.toLowerCase()}_comp_${normName}_${mapped.birthDate || age}_${normNat}_${normClub}`;

  // Dedução de pé preferido a partir de Left Foot / Right Foot se não especificado
  let preferredFoot = normalizeFoot(mapped.preferredFoot);
  if (!mapped.preferredFoot && (mapped.leftFoot || mapped.rightFoot)) {
    const leftVal = parseNumeric(mapped.leftFoot, 0);
    const rightVal = parseNumeric(mapped.rightFoot, 0);
    if (leftVal >= 15 && rightVal >= 15) {
      preferredFoot = 'Ambidestro';
    } else if (leftVal > rightVal) {
      preferredFoot = 'Canhoto';
    } else if (rightVal > leftVal) {
      preferredFoot = 'Destro';
    }
  }

  const player: FM26ParsedPlayer = {
    id: deterministicId,
    externalId: rawExtId,
    uniqueId: rawExtId,
    sourceUniqueId: rawExtId,
    databaseSource: resolvedSource,
    name: cleanName || `Jogador Linha ${rowIndex}`,
    fullName: mapped.fullName || cleanName,
    age,
    birthDate: mapped.birthDate ? parseDateISO(mapped.birthDate) : undefined,
    nationality,
    secondNationality: mapped.secondNationality || undefined,
    club: clubName,
    position,
    positionCategory,
    secondaryPositions,
    preferredFoot,
    weakFoot: mapped.weakFoot ? parseNumeric(mapped.weakFoot) : undefined,
    overall,
    potential,
    ca,
    pa,
    aDiff,
    marketValue,
    saleValue,
    wage,
    currency: 'BRL',
    contractUntil: parseDateISO(mapped.contractUntil, '2028-12-31'),
    releaseClause,
    squadStatus: mapped.squadStatus || undefined,
    personality: mapped.personality || undefined,
    height: parseHeightCm(mapped.height),
    weight: parseWeightKg(mapped.weight),
    jerseyNumber: mapped.jerseyNumber ? parseNumeric(mapped.jerseyNumber) : undefined,
    internationalCaps: mapped.internationalCaps ? parseNumeric(mapped.internationalCaps) : undefined,
    internationalGoals: mapped.internationalGoals ? parseNumeric(mapped.internationalGoals) : undefined,
    condition: mapped.condition ? parseNumeric(mapped.condition) : undefined,
    morale: mapped.morale || undefined,
    attributes,
    technicalAttributes: Object.keys(technicalAttributes).length > 0 ? technicalAttributes : undefined,
    mentalAttributes: Object.keys(mentalAttributes).length > 0 ? mentalAttributes : undefined,
    physicalAttributes: Object.keys(physicalAttributes).length > 0 ? physicalAttributes : undefined,
    goalkeeperAttributes: Object.keys(goalkeeperAttributes).length > 0 ? goalkeeperAttributes : undefined,
    stats: hasStats ? stats : undefined,
    deduplicationKey,
    rowIndex,
    rawRecord,
    issues,
  };

  return { player, issues };
}
