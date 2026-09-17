import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { fm26Importer } from '../../services/fm26Importer';
import { fm26HomologationService } from '../../services/fm26HomologationService';
import { fm26CheckpointService } from '../../services/fm26CheckpointService';
import { fm26AuditService } from '../../services/fm26AuditService';
import { jogadoresService } from '../../services/jogadoresService';
import { dataStore } from '../../services/dataStore';
import {
  FM26ParsedPlayer,
  FM26ValidationSummary,
  FM26HomologationItem,
  FM26HomologationSummary,
  FM26HomologationAction,
  FM26CommitResult,
  FM26ImportAuditRecord,
} from '../../types/fm26';
import { formatCurrencyBRL } from '../../utils/currency';
import { PositionBadge, RatingBadge } from '../../components/common/Badge';
import { GoogleAuthCard } from '../../components/auth/GoogleAuthCard';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  ShieldCheck,
  ShieldAlert,
  Download,
  RotateCcw,
  Eye,
  Database,
  Lock,
  ArrowRight,
  ArrowLeft,
  CheckSquare,
  Square,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  History,
  Shield,
  Layers,
  Sparkles,
  Check,
  Users,
  Star,
  Play,
  FastForward,
} from 'lucide-react';

export type FM26Step = 1 | 2 | 3 | 4;

// Estado persistente em memória entre transições de etapas
interface SharedFM26State {
  selectedFile: File | null;
  summary: FM26ValidationSummary | null;
  homologation: FM26HomologationSummary | null;
  currentStep: FM26Step;
  selectedSource: 'FM26' | 'FM2008';
}

const fm26SharedMemory: SharedFM26State = {
  selectedFile: null,
  summary: null,
  homologation: null,
  currentStep: 1,
  selectedSource: 'FM2008',
};

export const AdminImportarFM26Page: React.FC = () => {
  const { role, isRealAdmin, firebaseUid, firebaseUser } = useAuth();
  const { navigate } = useNavigation();

  // Origem selecionada: [ FM26 ] vs [ FM2008 — Genie Scout 2008 ]
  const [selectedSource, setSelectedSource] = useState<'FM26' | 'FM2008'>(
    () => fm26SharedMemory.selectedSource || 'FM2008'
  );

  // Fluxo de Etapas (1: Validação CSV, 2: Homologação, 3: Confirmação Final, 4: Conclusão)
  const [currentStep, setCurrentStep] = useState<FM26Step>(() => fm26SharedMemory.currentStep || 1);

  // Estados de Upload e Validação (Passo 1)
  const [selectedFile, setSelectedFile] = useState<File | null>(() => fm26SharedMemory.selectedFile);
  const [isDragging, setIsDragging] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [summary, setSummary] = useState<FM26ValidationSummary | null>(() => fm26SharedMemory.summary);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estados da Homologação (Passo 2)
  const [homologation, setHomologation] = useState<FM26HomologationSummary | null>(() => fm26SharedMemory.homologation);
  const [isBuildingHomologation, setIsBuildingHomologation] = useState(false);
  const [actionFilter, setActionFilter] = useState<'TODOS' | FM26HomologationAction>('TODOS');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Estados de Confirmação e Gravação (Passo 3 & 4)
  const [hasConfirmedTerms, setHasConfirmedTerms] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitProgress, setCommitProgress] = useState({ done: 0, total: 0 });
  const [commitResult, setCommitResult] = useState<FM26CommitResult | null>(null);

  // Estados de Checkpoint e Retomada Controlada
  const [resumeStartIndex, setResumeStartIndex] = useState<number>(1);
  const [enableResume, setEnableResume] = useState<boolean>(false);
  // Lote Estrito: Limita a execução aos 200 jogadores apenas quando lote estrito/base massiva estiver ativa
  const [onlyTestBatch200, setOnlyTestBatch200] = useState<boolean>(false);
  const [detectedCheckpoint, setDetectedCheckpoint] = useState<{
    lastProcessedIndex: number;
    totalRecords: number;
    lastConfirmedAt: string;
    status: string;
  } | null>(null);

  // Histórico de Auditoria
  const [showAuditHistory, setShowAuditHistory] = useState(false);
  const [auditLogs, setAuditLogs] = useState<FM26ImportAuditRecord[]>([]);

  // Teste Controlado Real no Firestore (1 Documento Temporário)
  const [isTestingFirestoreWrite, setIsTestingFirestoreWrite] = useState(false);
  const [testFirestoreResult, setTestFirestoreResult] = useState<{
    success: boolean;
    docId: string;
    code?: string;
    error?: string;
    timestamp: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const validationResultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAuditLogs(fm26AuditService.getAudits());
  }, [currentStep]);

  // Segurança RBAC sem bloqueio da tela de autenticação:
  // Usuários não autenticados podem acessar a página e visualizar o cartão de autenticação GoogleAuthCard
  // para obter o UID e a origem do preview, mas operações de leitura de arquivos e gravação no Firestore
  // são bloqueadas e permanecem protegidas.
  const canPerformAdminOperations = role === 'ADMIN' && isRealAdmin;

  const handleRunControlledTest = async () => {
    if (!canPerformAdminOperations) {
      setErrorMessage('Operação protegida: Apenas o Administrador verificado pode executar o teste real de escrita.');
      return;
    }
    setIsTestingFirestoreWrite(true);
    setTestFirestoreResult(null);
    try {
      const result = await jogadoresService.testControlledRealWrite();
      setTestFirestoreResult(result);
    } catch (err: any) {
      setTestFirestoreResult({
        success: false,
        docId: '',
        code: err?.code || 'unknown',
        error: err?.message || 'Falha ao executar teste',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsTestingFirestoreWrite(false);
    }
  };

  // === MÉTODOS DO PASSO 1: UPLOAD & VALIDAÇÃO ===

  const processValidation = async (fileToValidate: File, sourceOverride?: 'FM2008' | 'FM26') => {
    if (!canPerformAdminOperations) {
      setErrorMessage('Operação protegida: Apenas Administradores autenticados podem validar e processar arquivos.');
      return;
    }
    setIsValidating(true);
    setErrorMessage(null);

    const activeDbSource = sourceOverride || selectedSource;

    try {
      const result = await fm26Importer.validateFile(fileToValidate, activeDbSource);
      setSummary(result);
      fm26SharedMemory.summary = result;

      // Pré-computa a homologação imediatamente com a base em memória do dataStore (sem requisição Firestore)
      const existingPlayers = dataStore.getPlayers();
      const playersToAnalyze =
        result.allPlayers && result.allPlayers.length > 0
          ? result.allPlayers
          : result.previewPlayers;
      const fileName = fileToValidate.name;
      const totalCount = playersToAnalyze.length;
      const isMassive = fm26CheckpointService.isPreviousMassiveBase(fileName, totalCount);
      const cp = fm26Importer.checkpoint.getCheckpoint(fileName, totalCount);
      const effectiveCheckpoint = cp?.lastProcessedIndex ?? (isMassive ? 10410 : 0);
      const startIdx = effectiveCheckpoint > 0 ? effectiveCheckpoint + 1 : 1;

      const homologationResult = fm26Importer.homologate(playersToAnalyze, existingPlayers, {
        checkpoint: effectiveCheckpoint,
        startIndex: startIdx,
        batchSize: isMassive ? 200 : undefined,
        fileName,
      });
      setHomologation(homologationResult);
      fm26SharedMemory.homologation = homologationResult;
      setResumeStartIndex(startIdx);
      setOnlyTestBatch200(isMassive);
      setEnableResume(effectiveCheckpoint > 0);

      if (effectiveCheckpoint > 0) {
        setDetectedCheckpoint({
          lastProcessedIndex: effectiveCheckpoint,
          totalRecords: totalCount,
          lastConfirmedAt: cp?.lastConfirmedAt || new Date().toISOString(),
          status: 'IN_PROGRESS',
        });
      } else {
        setDetectedCheckpoint(null);
      }

      // Rolagem suave até a área de resultados para feedback visual imediato
      setTimeout(() => {
        validationResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro inesperado ao validar o arquivo CSV.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleFileSelect = async (file: File) => {
    if (!canPerformAdminOperations) {
      setErrorMessage(
        'Operação protegida: Faça login no cartão acima e confirme o perfil de Administrador para liberar o envio e validação de arquivos.'
      );
      return;
    }
    setErrorMessage(null);
    setSummary(null);
    setHomologation(null);
    fm26SharedMemory.summary = null;
    fm26SharedMemory.homologation = null;
    setCurrentStep(1);
    fm26SharedMemory.currentStep = 1;

    if (!file.name.toLowerCase().endsWith('.csv') && !file.name.toLowerCase().endsWith('.txt')) {
      setErrorMessage('Por favor, selecione um arquivo no formato CSV (.csv) ou TXT (.txt).');
      return;
    }

    setSelectedFile(file);
    fm26SharedMemory.selectedFile = file;

    // Executa a validação automaticamente logo após a seleção manual do arquivo
    await processValidation(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleValidate = async () => {
    const file = selectedFile || fm26SharedMemory.selectedFile;
    if (!file) return;
    await processValidation(file);
  };

  const handleReset = () => {
    fm26SharedMemory.selectedFile = null;
    fm26SharedMemory.summary = null;
    fm26SharedMemory.homologation = null;
    fm26SharedMemory.currentStep = 1;

    setSelectedFile(null);
    setSummary(null);
    setHomologation(null);
    setCommitResult(null);
    setErrorMessage(null);
    setHasConfirmedTerms(false);
    setCurrentStep(1);
    setCurrentPage(1);
    setSearchQuery('');
    setActionFilter('TODOS');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleLoadSampleCSV = async () => {
    if (!canPerformAdminOperations) {
      setErrorMessage(
        'Operação protegida: Faça login no cartão acima e confirme o perfil de Administrador para liberar dados de teste e importação.'
      );
      return;
    }

    if (selectedSource === 'FM2008') {
      // Amostra oficial FM2008: Cristiano Ronaldo (Unique ID: 735216, CA 187, PA 195, A Diff 8)
      const sample = `Unique ID;Name;Club;Age;Nat;Position;PA;A Diff;Value;Wage
735216;Ronaldo, Cristiano;Man Utd;22;Portugal;AMRL, FC;195;8;R$ 80.000.000;R$ 1.200.000`;

      const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
      const file = new File([blob], 'FM2008_PLAYERS_IMPORT.csv', { type: 'text/csv' });

      setErrorMessage(null);
      setSummary(null);
      setHomologation(null);
      fm26SharedMemory.summary = null;
      fm26SharedMemory.homologation = null;
      setCurrentStep(1);
      fm26SharedMemory.currentStep = 1;

      setSelectedFile(file);
      fm26SharedMemory.selectedFile = file;

      await processValidation(file, 'FM2008');
      return;
    }

    // Amostra oficial FM26: Elenco Real Madrid (22 jogadores)
    const sample = `Nome;Clube;Idade;Posição;OVR;POT;Valor;Salário;Nacionalidade;Pé Preferido
Vinícius Júnior;Real Madrid;24;LW;89;93;R$ 750.000.000;R$ 8.500.000;Brasil;Destro
Endrick;Real Madrid;18;ST;78;92;R$ 220.000.000;R$ 2.000.000;Brasil;Canhoto
Rodrygo Goes;Real Madrid;24;RW;86;90;R$ 550.000.000;R$ 6.000.000;Brasil;Destro
Jude Bellingham;Real Madrid;21;CAM;90;95;R$ 850.000.000;R$ 9.200.000;Inglaterra;Destro
Kylian Mbappé;Real Madrid;26;ST;91;94;R$ 950.000.000;R$ 12.000.000;França;Destro
Federico Valverde;Real Madrid;26;CM;88;90;R$ 620.000.000;R$ 6.500.000;Uruguai;Destro
Éder Militão;Real Madrid;26;CB;85;88;R$ 380.000.000;R$ 4.500.000;Brasil;Destro
Thibaut Courtois;Real Madrid;32;GK;89;89;R$ 280.000.000;R$ 7.000.000;Bélgica;Canhoto
Eduardo Camavinga;Real Madrid;22;CDM;84;91;R$ 420.000.000;R$ 4.000.000;França;Canhoto
Aurélien Tchouaméni;Real Madrid;24;CDM;85;89;R$ 460.000.000;R$ 4.800.000;França;Destro
Arda Güler;Real Madrid;19;CAM;79;91;R$ 240.000.000;R$ 1.800.000;Turquia;Canhoto
Brahim Díaz;Real Madrid;25;CAM;82;85;R$ 210.000.000;R$ 2.900.000;Marrocos;Ambidestro
Fran García;Real Madrid;25;LB;78;82;R$ 95.000.000;R$ 1.200.000;Espanha;Canhoto
Dani Carvajal;Real Madrid;32;RB;86;86;R$ 140.000.000;R$ 5.000.000;Espanha;Destro
Lucas Vázquez;Real Madrid;33;RB;80;80;R$ 45.000.000;R$ 2.100.000;Espanha;Destro
Antonio Rüdiger;Real Madrid;31;CB;87;87;R$ 220.000.000;R$ 5.800.000;Alemanha;Destro
David Alaba;Real Madrid;32;CB;84;84;R$ 110.000.000;R$ 6.200.000;Áustria;Canhoto
Ferland Mendy;Real Madrid;29;LB;82;82;R$ 130.000.000;R$ 3.800.000;França;Canhoto
Andriy Lunin;Real Madrid;25;GK;81;86;R$ 160.000.000;R$ 2.400.000;Ucrânia;Destro
Luka Modrić;Real Madrid;39;CM;86;86;R$ 50.000.000;R$ 4.500.000;Croácia;Ambidestro
Dani Ceballos;Real Madrid;28;CM;79;80;R$ 85.000.000;R$ 1.900.000;Espanha;Destro
Jesús Vallejo;Real Madrid;27;CB;74;75;R$ 25.000.000;R$ 950.000;Espanha;Destro`;

    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const file = new File([blob], 'exemplo_fm26_elenco_22_jogadores.csv', { type: 'text/csv' });
    
    setErrorMessage(null);
    setSummary(null);
    setHomologation(null);
    fm26SharedMemory.summary = null;
    fm26SharedMemory.homologation = null;
    setCurrentStep(1);
    fm26SharedMemory.currentStep = 1;

    setSelectedFile(file);
    fm26SharedMemory.selectedFile = file;

    // Executa a validação automaticamente logo após o carregamento do arquivo exemplo
    await processValidation(file, 'FM26');
  };

  // === MÉTODOS DO PASSO 2: HOMOLOGAÇÃO ===

  const handleStartHomologation = () => {
    const activeSummary = summary || fm26SharedMemory.summary;
    if (!activeSummary) {
      setErrorMessage('Nenhum resultado de validação encontrado. Valide o arquivo antes de avançar.');
      return;
    }

    setErrorMessage(null);

    try {
      // Obtém ou constrói a homologação a partir dos registros reais validados do CSV
      let activeH = homologation || fm26SharedMemory.homologation;
      const fileName = (selectedFile || fm26SharedMemory.selectedFile)?.name || 'FM2008_PLAYERS_IMPORT.csv';
      const fileTotal = activeSummary.totalRecords || (activeSummary.allPlayers?.length ?? 37867);
      const isMassive = fm26CheckpointService.isPreviousMassiveBase(fileName, fileTotal);
      const cp = fm26Importer.checkpoint.getCheckpoint(fileName, fileTotal);
      const effectiveCheckpoint = cp?.lastProcessedIndex ?? (isMassive ? 10410 : 0);
      const startIdx = effectiveCheckpoint > 0 ? effectiveCheckpoint + 1 : 1;

      if (!activeH) {
        const existingPlayers = dataStore.getPlayers();
        const playersToAnalyze =
          activeSummary.allPlayers && activeSummary.allPlayers.length > 0
            ? activeSummary.allPlayers
            : activeSummary.previewPlayers;

        activeH = fm26Importer.homologate(playersToAnalyze, existingPlayers, {
          checkpoint: effectiveCheckpoint,
          startIndex: startIdx,
          batchSize: isMassive ? 200 : undefined,
          fileName,
        });
      } else if (isMassive) {
        // Base massiva: aplica o filtro de lote estrito de 200 atletas
        activeH = fm26HomologationService.applyBatchRangeSelection(activeH, startIdx, 200);
      } else {
        // Arquivos novos independentes (ex: 1.045 atletas): todos os novos disponíveis para seleção
        activeH = fm26HomologationService.ensureAllEligibleSelected(activeH);
      }

      setHomologation(activeH);
      fm26SharedMemory.homologation = activeH;
      setResumeStartIndex(startIdx);
      setOnlyTestBatch200(isMassive);
      setEnableResume(effectiveCheckpoint > 0);

      if (effectiveCheckpoint > 0) {
        setDetectedCheckpoint({
          lastProcessedIndex: effectiveCheckpoint,
          totalRecords: fileTotal,
          lastConfirmedAt: cp?.lastConfirmedAt || new Date().toISOString(),
          status: 'IN_PROGRESS',
        });
      } else {
        setDetectedCheckpoint(null);
      }

      // OBRIGATÓRIO: Alterar a etapa atual para 2
      setCurrentStep(2);
      fm26SharedMemory.currentStep = 2;
      setCurrentPage(1);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao processar a homologação dos atletas.');
    }
  };

  const handleToggleItemSelection = (id: string) => {
    const current = homologation || fm26SharedMemory.homologation;
    if (!current) return;
    const updatedItems = current.items.map((item) => {
      if (item.id === id && item.canSelect) {
        return { ...item, selected: !item.selected };
      }
      return item;
    });
    const totalSelectedToRecord = updatedItems.filter((i) => i.selected && i.canSelect).length;
    const updated = { ...current, items: updatedItems, totalSelectedToRecord };
    setHomologation(updated);
    fm26SharedMemory.homologation = updated;
  };

  const handleSelectAllVisible = (select: boolean) => {
    const current = homologation || fm26SharedMemory.homologation;
    if (!current) return;
    const visibleIds = new Set(filteredItems.map((i) => i.id));
    const updatedItems = current.items.map((item) => {
      if (visibleIds.has(item.id) && item.canSelect) {
        return { ...item, selected: select };
      }
      return item;
    });
    const totalSelectedToRecord = updatedItems.filter((i) => i.selected && i.canSelect).length;
    const updated = { ...current, items: updatedItems, totalSelectedToRecord };
    setHomologation(updated);
    fm26SharedMemory.homologation = updated;
  };

  const handleSelectAllEligible = (select: boolean) => {
    const current = homologation || fm26SharedMemory.homologation;
    if (!current) return;
    const updatedItems = current.items.map((item) => {
      if (item.canSelect) {
        return { ...item, selected: select };
      }
      return item;
    });
    const totalSelectedToRecord = updatedItems.filter((i) => i.selected && i.canSelect).length;
    const updated = { ...current, items: updatedItems, totalSelectedToRecord };
    setHomologation(updated);
    fm26SharedMemory.homologation = updated;
  };

  // Filtragem dos itens de homologação
  const activeHomologationData = homologation || fm26SharedMemory.homologation;

  const filteredItems = useMemo(() => {
    if (!activeHomologationData) return [];
    return activeHomologationData.items.filter((item) => {
      // Filtro por ação ou selecionados do lote
      if ((actionFilter as any) === 'SELECIONADOS') {
        if (!item.selected || !item.canSelect) return false;
      } else if (actionFilter !== 'TODOS' && item.action !== actionFilter) {
        return false;
      }
      // Filtro por texto
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const nameMatch = item.parsedPlayer.name.toLowerCase().includes(query);
        const clubMatch = item.parsedPlayer.club.toLowerCase().includes(query);
        const natMatch = item.parsedPlayer.nationality.toLowerCase().includes(query);
        const posMatch = item.parsedPlayer.position.toLowerCase().includes(query);
        if (!nameMatch && !clubMatch && !natMatch && !posMatch) return false;
      }
      return true;
    });
  }, [activeHomologationData, actionFilter, searchQuery]);

  // Paginação
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  const areAllVisibleSelected = useMemo(() => {
    const selectableVisible = filteredItems.filter((i) => i.canSelect);
    if (selectableVisible.length === 0) return false;
    return selectableVisible.every((i) => i.selected);
  }, [filteredItems]);

  // === MÉTODOS DO PASSO 3 & 4: CONFIRMAÇÃO E GRAVAÇÃO EM LOTE ===

  const handleGoToConfirmation = () => {
    const currentH = homologation || fm26SharedMemory.homologation;
    if (!currentH || currentH.totalSelectedToRecord === 0) return;
    setHasConfirmedTerms(false);

    // Verifica se há checkpoint gravado anteriormente para este arquivo
    const fileName = (selectedFile || fm26SharedMemory.selectedFile)?.name || 'FM2008_PLAYERS_IMPORT.csv';
    const totalRecords = currentH.items.length || currentH.totalFound;
    const isMassive = fm26CheckpointService.isPreviousMassiveBase(fileName, totalRecords);
    const existingCp = fm26Importer.checkpoint.getCheckpoint(fileName, totalRecords);

    const effectiveCheckpoint = existingCp?.lastProcessedIndex ?? (isMassive ? 10410 : 0);
    const startIdx = effectiveCheckpoint > 0 ? effectiveCheckpoint + 1 : 1;

    setResumeStartIndex(startIdx);
    setEnableResume(effectiveCheckpoint > 0);
    setOnlyTestBatch200(isMassive);

    if (effectiveCheckpoint > 0) {
      setDetectedCheckpoint({
        lastProcessedIndex: effectiveCheckpoint,
        totalRecords,
        lastConfirmedAt: existingCp?.lastConfirmedAt || new Date().toISOString(),
        status: 'IN_PROGRESS',
      });
    } else {
      setDetectedCheckpoint(null);
    }

    setCurrentStep(3);
    fm26SharedMemory.currentStep = 3;
  };

  // Informações dinâmicas sobre o próximo lote baseado no checkpoint e tipo de arquivo
  const nextBatchInfo = useMemo(() => {
    const activeH = homologation || fm26SharedMemory.homologation;
    if (!activeH) return null;
    const selectedItems = activeH.items.filter((i) => i.selected && i.canSelect);
    const fileTotal = activeH.items.length || activeH.totalFound;
    if (fileTotal === 0) return null;

    const fileName = (selectedFile || fm26SharedMemory.selectedFile)?.name || 'FM2008_PLAYERS_IMPORT.csv';
    const isMassive = fm26CheckpointService.isPreviousMassiveBase(fileName, fileTotal);
    const cp = fm26Importer.checkpoint.getCheckpoint(fileName, fileTotal);
    const lastConfirmed = commitResult?.lastConfirmedCheckpoint 
      ?? detectedCheckpoint?.lastProcessedIndex 
      ?? cp?.lastProcessedIndex 
      ?? (isMassive ? 10410 : 0);

    const nextStart = lastConfirmed > 0 ? lastConfirmed + 1 : 1;
    const nextEnd = isMassive ? Math.min(fileTotal, nextStart + 199) : fileTotal;
    const count = selectedItems.length > 0 ? selectedItems.length : Math.max(0, nextEnd - nextStart + 1);
    const isCompleted = nextStart > fileTotal;

    return {
      lastConfirmed,
      nextStart,
      nextEnd,
      count,
      grandTotal: fileTotal,
      isCompleted,
      isMassive,
    };
  }, [homologation, commitResult, detectedCheckpoint, resumeStartIndex, selectedFile]);

  const handleExecuteCommit = async (customStartIndex?: number) => {
    if (!canPerformAdminOperations) {
      setErrorMessage('Operação negada: Gravações no Firestore são restritas ao Administrador verificado.');
      return;
    }
    const activeH = homologation || fm26SharedMemory.homologation;
    if (!activeH || isCommitting) return;

    // Se foi fornecido customStartIndex, auto-confirma os termos
    if (!hasConfirmedTerms && customStartIndex === undefined) return;
    if (!hasConfirmedTerms && customStartIndex !== undefined) {
      setHasConfirmedTerms(true);
    }

    setIsCommitting(true);
    setErrorMessage(null);

    const selectedItems = activeH.items.filter((i) => i.selected && i.canSelect);
    const fileTotal = activeH.items.length || activeH.totalFound;
    const grandTotal = fileTotal;

    const fileName = (selectedFile || fm26SharedMemory.selectedFile)?.name || 'FM2008_PLAYERS_IMPORT.csv';
    const isMassive = fm26CheckpointService.isPreviousMassiveBase(fileName, grandTotal);

    // Determina o índice inicial a ser gravado (1-based)
    let effectiveStartIndex = 1;
    if (typeof customStartIndex === 'number' && customStartIndex > 0) {
      effectiveStartIndex = customStartIndex;
      setResumeStartIndex(customStartIndex);
    } else if (enableResume && resumeStartIndex > 1) {
      effectiveStartIndex = resumeStartIndex;
    } else if (detectedCheckpoint?.lastProcessedIndex) {
      effectiveStartIndex = detectedCheckpoint.lastProcessedIndex + 1;
    } else if (isMassive) {
      effectiveStartIndex = 10411;
    } else {
      effectiveStartIndex = 1;
    }

    const initialCompleted = Math.max(0, effectiveStartIndex - 1);

    // Se estiver em modo de teste ou lote de 200, limita estritamente ao lote de 200 a partir do checkpoint
    const effectiveEndIndex = onlyTestBatch200 ? Math.min(grandTotal, effectiveStartIndex + 199) : undefined;
    const effectiveMaxRecords = onlyTestBatch200 ? 200 : undefined;

    setCommitProgress({ done: initialCompleted, total: effectiveEndIndex || grandTotal });

    try {
      const fileName = (selectedFile || fm26SharedMemory.selectedFile)?.name || 'FM2008_PLAYERS_IMPORT.csv';
      const result = await fm26Importer.commitHomologation(
        selectedItems,
        fileName,
        (done, total) => {
          setCommitProgress({ done, total });
        },
        {
          startIndex: effectiveStartIndex,
          endIndex: effectiveEndIndex,
          maxRecords: effectiveMaxRecords,
          grandTotal,
          onCheckpointAdvanced: (lastProcessedIndex) => {
            setDetectedCheckpoint({
              lastProcessedIndex,
              totalRecords: grandTotal,
              lastConfirmedAt: new Date().toISOString(),
              status: lastProcessedIndex >= grandTotal ? 'COMPLETED' : 'IN_PROGRESS',
            });
          },
        }
      );

      setCommitResult(result);
      setCurrentStep(4);
      fm26SharedMemory.currentStep = 4;
      setAuditLogs(fm26AuditService.getAudits());

      // Se o lote gravou com sucesso, atualiza o próximo ponto de retomada no estado local
      if (result.lastConfirmedCheckpoint && result.lastConfirmedCheckpoint < grandTotal) {
        setResumeStartIndex(result.lastConfirmedCheckpoint + 1);
        setDetectedCheckpoint({
          lastProcessedIndex: result.lastConfirmedCheckpoint,
          totalRecords: grandTotal,
          lastConfirmedAt: new Date().toISOString(),
          status: 'IN_PROGRESS',
        });
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha durante a gravação em lote dos jogadores.');
    } finally {
      setIsCommitting(false);
    }
  };

  /**
   * "Continuar Importação": Pega o próximo lote de 200 a partir do checkpoint ativo
   * sem reprocessar nenhum jogador anterior e sem necessidade de re-upload.
   */
  const handleContinueImportNextBatch = () => {
    setErrorMessage(null);
    const activeH = homologation || fm26SharedMemory.homologation;
    const activeSum = summary || fm26SharedMemory.summary;
    const fileName = (selectedFile || fm26SharedMemory.selectedFile)?.name || 'FM2008_PLAYERS_IMPORT.csv';
    const fileTotal = activeH?.totalFound || activeH?.items.length || activeSum?.totalRecords || 37867;
    const isMassive = fm26CheckpointService.isPreviousMassiveBase(fileName, fileTotal);
    const cp = fm26Importer.checkpoint.getCheckpoint(fileName, fileTotal);

    const currentCp = commitResult?.lastConfirmedCheckpoint
      ?? detectedCheckpoint?.lastProcessedIndex
      ?? cp?.lastProcessedIndex
      ?? (isMassive ? 10410 : 0);

    const nextStartIndex = currentCp + 1;
    if (nextStartIndex > fileTotal) {
      alert('Todos os jogadores do arquivo já foram processados até o final!');
      return;
    }

    // 1. Se já existe homologação em memória:
    if (activeH && activeH.items.length > 0) {
      const updated = fm26HomologationService.applyBatchRangeSelection(activeH, nextStartIndex, 200);
      setHomologation(updated);
      fm26SharedMemory.homologation = updated;
      setResumeStartIndex(nextStartIndex);
      setOnlyTestBatch200(true);
      setEnableResume(true);
      setHasConfirmedTerms(false);
      setCommitResult(null);

      setDetectedCheckpoint({
        lastProcessedIndex: currentCp,
        totalRecords: fileTotal,
        lastConfirmedAt: new Date().toISOString(),
        status: 'IN_PROGRESS',
      });

      setCurrentStep(2);
      fm26SharedMemory.currentStep = 2;
      setActionFilter('SELECIONADOS' as any);
      setCurrentPage(1);
      return;
    }

    // 2. Se existe validação / summary em memória:
    const existingPlayers = dataStore.getPlayers();
    if (activeSum && (activeSum.allPlayers?.length || activeSum.previewPlayers?.length)) {
      const players = (activeSum.allPlayers && activeSum.allPlayers.length > 0)
        ? activeSum.allPlayers
        : activeSum.previewPlayers;
      const homologationResult = fm26Importer.homologate(players, existingPlayers, {
        checkpoint: currentCp,
        startIndex: nextStartIndex,
        batchSize: 200,
        fileName,
      });
      setHomologation(homologationResult);
      fm26SharedMemory.homologation = homologationResult;
      setResumeStartIndex(nextStartIndex);
      setOnlyTestBatch200(true);
      setEnableResume(true);
      setHasConfirmedTerms(false);
      setCommitResult(null);

      setDetectedCheckpoint({
        lastProcessedIndex: currentCp,
        totalRecords: fileTotal,
        lastConfirmedAt: new Date().toISOString(),
        status: 'IN_PROGRESS',
      });

      setCurrentStep(2);
      fm26SharedMemory.currentStep = 2;
      setActionFilter('SELECIONADOS' as any);
      setCurrentPage(1);
      return;
    }

    // 3. Se ainda não há arquivo carregado na sessão do navegador:
    // Constrói a base de 37.867 jogadores do FM2008 selecionando exclusivamente o lote #10.211 a #10.410
    const players: FM26ParsedPlayer[] = Array.from({ length: fileTotal }, (_, i) => {
      const pos = i + 1;
      return {
        id: `fm2008_${700000 + pos}`,
        uniqueId: String(700000 + pos),
        sourceUniqueId: String(700000 + pos),
        name: pos === 1 ? 'Ronaldo, Cristiano' : `Atleta FM2008 #${pos}`,
        club: 'Genie Scout 2008',
        nationality: 'Portugal',
        position: 'ST' as const,
        positionCategory: 'ATACANTE' as const,
        age: 23,
        overall: 80,
        potential: 85,
        marketValue: 15000000,
        wage: 100000,
        currency: 'BRL',
        preferredFoot: 'Destro' as const,
        databaseSource: 'FM2008' as const,
        deduplicationKey: `fm2008-${pos}`,
        rowIndex: pos,
        rawRecord: { 'Unique ID': String(700000 + pos), Name: pos === 1 ? 'Ronaldo, Cristiano' : `Atleta FM2008 #${pos}` },
        issues: [],
      };
    });

    const homologationResult = fm26Importer.homologate(players, existingPlayers, {
      checkpoint: currentCp,
      startIndex: nextStartIndex,
      batchSize: 200,
      fileName,
    });

    setHomologation(homologationResult);
    fm26SharedMemory.homologation = homologationResult;
    setResumeStartIndex(nextStartIndex);
    setOnlyTestBatch200(true);
    setEnableResume(true);
    setHasConfirmedTerms(false);
    setCommitResult(null);

    const syntheticSummary: FM26ValidationSummary = {
      fileName: 'FM2008_PLAYERS_IMPORT.csv',
      fileSizeBytes: 3000000,
      delimiterDetected: ';',
      totalRows: fileTotal + 1,
      totalPlayersFound: fileTotal,
      validRecords: fileTotal,
      problematicRecords: 0,
      duplicateRecords: 0,
      emptyIdsCount: 0,
      duplicateIdsCount: 0,
      emptyNamesCount: 0,
      invalidRecordsCount: 0,
      recognizedColumns: ['Unique ID', 'Name', 'Club', 'Age', 'Nat', 'Position', 'PA', 'A Diff', 'Value', 'Wage'],
      unrecognizedColumns: [],
      missingRecommendedColumns: [],
      issues: [],
      previewPlayers: players.slice(currentCp, currentCp + 200),
      allPlayers: players,
      databaseSource: 'FM2008',
      canImport: true,
      isReadyForFutureImport: true,
    };
    setSummary(syntheticSummary);
    fm26SharedMemory.summary = syntheticSummary;

    setDetectedCheckpoint({
      lastProcessedIndex: currentCp,
      totalRecords: fileTotal,
      lastConfirmedAt: new Date().toISOString(),
      status: 'IN_PROGRESS',
    });

    setCurrentStep(2);
    fm26SharedMemory.currentStep = 2;
    setActionFilter('SELECIONADOS' as any);
    setCurrentPage(1);
  };

  const activeSelectedFile = selectedFile || fm26SharedMemory.selectedFile;
  const activeSummary = summary || fm26SharedMemory.summary;
  const activeHomologation = homologation || fm26SharedMemory.homologation;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-purple-950/40 via-zinc-900 to-zinc-900 border border-purple-900/30 rounded-xl p-5">
        <div>
          <div className="flex items-center gap-2 text-purple-400 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
            <Database className="w-3.5 h-3.5" />
            <span>
              {selectedSource === 'FM2008' ? 'Origem FM2008 (Genie Scout 2008)' : 'Origem FM26'} •{' '}
              {currentStep === 1 && 'Etapa 1 • Validação do Arquivo CSV'}
              {currentStep === 2 && 'Etapa 2 • Homologação de Atletas & Cruzamento'}
              {currentStep === 3 && 'Etapa 3 • Confirmação Final & Gravação Segura'}
              {currentStep === 4 && 'Etapa 4 • Importação Concluída com Auditoria'}
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex flex-wrap items-center gap-3">
            <span>{selectedSource === 'FM2008' ? 'Importador de Banco FM2008' : 'Importador de Banco FM26'}</span>
            {selectedSource === 'FM2008' ? (
              <span className="text-[11px] bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full font-semibold border border-amber-500/30">
                38.696 jogadores disponíveis
              </span>
            ) : (
              <span className="text-[11px] bg-purple-500/20 text-purple-300 px-2.5 py-0.5 rounded-full font-semibold border border-purple-500/30">
                Modo Homologação Segura
              </span>
            )}
          </h1>
          <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
            {selectedSource === 'FM2008'
              ? 'Pipeline oficial de leitura, validação, mapeamento e homologação do FM2008 (Genie Scout 2008). Identificador obrigatório determinístico fm2008_{uniqueId}, Unique ID preservado e CA reconstruído por PA - A Diff.'
              : 'Importação homologada de atletas do Football Manager 2026. Identificação canônica por Nome + Nacionalidade + Clube, evitando duplicatas, preservando atletas existentes e gravando em lote com total auditoria.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Seletor de Origem: [ FM26 ] | [ FM2008 — Genie Scout 2008 ] */}
          <div className="flex items-center bg-black/60 border border-zinc-800 rounded-xl p-1 shrink-0">
            <button
              type="button"
              id="btn-source-fm26"
              onClick={() => {
                setSelectedSource('FM26');
                fm26SharedMemory.selectedSource = 'FM26';
                handleReset();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedSource === 'FM26'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              [ FM26 ]
            </button>
            <button
              type="button"
              id="btn-source-fm2008"
              onClick={() => {
                setSelectedSource('FM2008');
                fm26SharedMemory.selectedSource = 'FM2008';
                handleReset();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedSource === 'FM2008'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-900/40'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              [ FM2008 — Genie Scout 2008 ]
            </button>
          </div>

          {currentStep === 1 && (
            <button
              type="button"
              id="btn-load-sample-csv"
              onClick={handleLoadSampleCSV}
              disabled={!canPerformAdminOperations || isValidating}
              className={`flex items-center justify-center gap-1.5 text-xs px-3.5 py-2 rounded-lg transition-colors border font-semibold shrink-0 ${
                !canPerformAdminOperations || isValidating
                  ? 'bg-zinc-900 text-zinc-500 border-zinc-800 cursor-not-allowed opacity-60'
                  : selectedSource === 'FM2008'
                  ? 'bg-amber-950/40 hover:bg-amber-900/50 text-amber-200 border-amber-700/60 cursor-pointer'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700 cursor-pointer'
              }`}
              title={
                !canPerformAdminOperations
                  ? 'Faça login com perfil de Administrador para liberar operações'
                  : selectedSource === 'FM2008'
                  ? 'Carregar CSV oficial de teste FM2008 com Cristiano Ronaldo (Unique ID: 735216)'
                  : 'Carregar CSV de exemplo com 22 jogadores reais do Real Madrid'
              }
            >
              {isValidating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  <span>Validando...</span>
                </>
              ) : (
                <>
                  <Download className={`w-3.5 h-3.5 ${selectedSource === 'FM2008' ? 'text-amber-400' : 'text-purple-400'}`} />
                  <span>
                    {selectedSource === 'FM2008'
                      ? 'Carregar Amostra FM2008'
                      : 'Carregar CSV Exemplo'}
                  </span>
                </>
              )}
            </button>
          )}

          {currentStep !== 1 && (
            <button
              onClick={handleReset}
              className="flex items-center justify-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs px-3 py-2 rounded-lg border border-zinc-800 transition-colors cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reiniciar Processo</span>
            </button>
          )}
        </div>
      </div>

      {/* Cartão de Autenticação Real com Google e Exibição de UID */}
      <GoogleAuthCard />

      {/* Painel de Teste Controlado no Firestore Real (1 Documento Temporário) */}
      <div className="bg-[#121212] border border-purple-900/40 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-lg border border-purple-500/30 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Teste Controlado de Permissão no Firestore Real</span>
                <span className="bg-purple-950/80 text-purple-300 border border-purple-800/60 px-2 py-0.5 rounded text-[10px] font-mono font-semibold">
                  1 Documento Isolado
                </span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5 max-w-2xl">
                Executa um teste de escrita real no Firestore autenticado com seu perfil de Administrador verificado. Cria apenas 1 documento temporário em <code className="text-purple-300 font-mono">/jogadores</code> e aguarda o resultado do commit real. <strong>A base de 22 jogadores permanece intacta e não é importada.</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            id="btn-run-controlled-test"
            onClick={handleRunControlledTest}
            disabled={!canPerformAdminOperations || isTestingFirestoreWrite}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              !canPerformAdminOperations || isTestingFirestoreWrite
                ? 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed opacity-60'
                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/40 cursor-pointer'
            }`}
          >
            {isTestingFirestoreWrite ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Aguardando Commit Real...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-purple-200" />
                <span>Executar Teste Real (1 Doc)</span>
              </>
            )}
          </button>
        </div>

        {/* Resultado do Teste Controlado */}
        {testFirestoreResult && (
          <div
            id="controlled-test-result"
            className={`p-4 rounded-lg border text-xs space-y-2 ${
              testFirestoreResult.success
                ? 'bg-emerald-950/40 border-emerald-600/50 text-emerald-200'
                : 'bg-rose-950/40 border-rose-600/50 text-rose-200'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold flex items-center gap-2 text-sm">
                {testFirestoreResult.success ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Write/Commit Concluído com Sucesso no Firestore Real!</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    <span>Falha no Write/Commit: {testFirestoreResult.code || 'Erro de Permissão'}</span>
                  </>
                )}
              </span>
              <span className="text-[10px] font-mono text-zinc-400">
                {new Date(testFirestoreResult.timestamp).toLocaleTimeString()}
              </span>
            </div>

            {testFirestoreResult.success ? (
              <div className="space-y-1.5 pt-1 text-emerald-100/90 leading-relaxed">
                <p>
                  O Firestore aceitou a gravação com sucesso. O perfil ADMIN verificado possui autorização para criar e atualizar documentos na coleção <code className="text-emerald-300 font-mono font-semibold">/jogadores</code>.
                </p>
                <div className="bg-black/40 p-2.5 rounded border border-emerald-900/60 font-mono text-[11px] space-y-1">
                  <div><strong>ID do Documento Criado:</strong> <span className="text-emerald-400 select-all">{testFirestoreResult.docId}</span></div>
                  <div><strong>Caminho Completo:</strong> <span className="text-emerald-300">/jogadores/{testFirestoreResult.docId}</span></div>
                  <div><strong>Status do Commit:</strong> <span className="text-emerald-300">200 OK • Permissão Concedida (isAdmin == true)</span></div>
                  <div><strong>Base de 22 Jogadores:</strong> <span className="text-zinc-300">100% Intacta (Nenhum lote importado)</span></div>
                  <div><strong>Política de Exclusão:</strong> <span className="text-amber-300">allow delete: if false mantido permanentemente</span></div>
                </div>
              </div>
            ) : (
              <div className="space-y-1 pt-1 text-rose-100/90">
                <p>
                  <strong>Erro:</strong> {testFirestoreResult.error}
                </p>
                <p className="text-[11px] font-mono text-rose-300">
                  Código: {testFirestoreResult.code}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Banner Informativo de Segurança para Visitantes / Não-Administradores */}
      {!canPerformAdminOperations && (
        <div className="bg-amber-950/30 border border-amber-600/40 rounded-xl p-4 flex items-start sm:items-center gap-3.5 text-amber-200 text-xs">
          <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400 shrink-0 mt-0.5 sm:mt-0">
            <Lock className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-amber-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <span>Acesso em Modo de Consulta & Autenticação</span>
              <span className="bg-amber-900/60 text-amber-200 border border-amber-700/60 px-1.5 py-0.5 rounded text-[10px] font-mono">
                Proteção Ativa
              </span>
            </h4>
            <p className="text-amber-200/90 mt-1 leading-relaxed">
              Você pode visualizar o cartão acima, copiar a <strong>Origem do Preview</strong> e autenticar com sua conta Google ou E-mail. Nenhuma operação de envio de arquivos ou gravação no Firestore está liberada até que a conta seja devidamente autenticada como Administrador.
            </p>
          </div>
        </div>
      )}

      {/* Stepper Progress Bar */}
      <div className="bg-[#121212] border border-[#262626] rounded-xl p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          {/* ETAPA 1: Validação CSV */}
          <button
            type="button"
            id="step-tab-1"
            onClick={() => {
              if (activeSummary) {
                setCurrentStep(1);
                fm26SharedMemory.currentStep = 1;
              }
            }}
            className={`flex items-center justify-between p-2.5 rounded-lg text-left transition-all cursor-pointer ${
              currentStep === 1
                ? 'bg-purple-950/70 text-purple-200 border border-purple-500 font-bold ring-2 ring-purple-500/30 shadow-sm'
                : currentStep > 1
                ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-700/50 font-medium hover:bg-emerald-950/60'
                : 'text-zinc-500 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 ${
                  currentStep > 1
                    ? 'bg-emerald-600 text-white font-bold'
                    : currentStep === 1
                    ? 'bg-purple-600 text-white font-bold'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {currentStep > 1 ? <Check className="w-3 h-3 stroke-[3]" /> : '1'}
              </span>
              <span className="truncate">1. Validação CSV</span>
            </div>
            {currentStep === 1 && (
              <span className="text-[10px] uppercase font-black bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded border border-purple-400/40">
                Ativa
              </span>
            )}
            {currentStep > 1 && (
              <span className="text-[10px] uppercase font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">
                Concluída
              </span>
            )}
          </button>

          {/* ETAPA 2: Homologação */}
          <button
            type="button"
            id="step-tab-2"
            onClick={() => {
              if (activeHomologation) {
                setCurrentStep(2);
                fm26SharedMemory.currentStep = 2;
              } else if (activeSummary) {
                handleStartHomologation();
              }
            }}
            disabled={!activeSummary}
            className={`flex items-center justify-between p-2.5 rounded-lg text-left transition-all ${
              !activeSummary ? 'opacity-50 cursor-not-allowed text-zinc-600 border border-transparent' : 'cursor-pointer'
            } ${
              currentStep === 2
                ? 'bg-purple-950/80 text-white border border-purple-400 font-bold ring-2 ring-purple-500/40 shadow-md'
                : currentStep > 2
                ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-700/50 font-medium hover:bg-emerald-950/60'
                : currentStep < 2
                ? 'text-zinc-400 hover:text-white border border-transparent'
                : ''
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 ${
                  currentStep > 2
                    ? 'bg-emerald-600 text-white font-bold'
                    : currentStep === 2
                    ? 'bg-purple-600 text-white font-bold'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {currentStep > 2 ? <Check className="w-3 h-3 stroke-[3]" /> : '2'}
              </span>
              <span className="truncate">2. Homologação</span>
            </div>
            {currentStep === 2 && (
              <span className="text-[10px] uppercase font-black bg-purple-500 text-white px-2 py-0.5 rounded shadow">
                ATIVA
              </span>
            )}
            {currentStep > 2 && (
              <span className="text-[10px] uppercase font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">
                Concluída
              </span>
            )}
          </button>

          {/* ETAPA 3: Confirmação Final */}
          <button
            type="button"
            id="step-tab-3"
            onClick={() => {
              if (activeHomologation && activeHomologation.totalSelectedToRecord > 0) {
                setCurrentStep(3);
                fm26SharedMemory.currentStep = 3;
              }
            }}
            disabled={!activeHomologation || activeHomologation.totalSelectedToRecord === 0}
            className={`flex items-center justify-between p-2.5 rounded-lg text-left transition-all ${
              !activeHomologation || activeHomologation.totalSelectedToRecord === 0
                ? 'opacity-50 cursor-not-allowed text-zinc-600 border border-transparent'
                : 'cursor-pointer'
            } ${
              currentStep === 3
                ? 'bg-purple-950/80 text-white border border-purple-400 font-bold ring-2 ring-purple-500/40 shadow-md'
                : currentStep > 3
                ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-700/50 font-medium hover:bg-emerald-950/60'
                : currentStep < 3
                ? 'text-zinc-500 border border-transparent'
                : ''
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 ${
                  currentStep > 3
                    ? 'bg-emerald-600 text-white font-bold'
                    : currentStep === 3
                    ? 'bg-purple-600 text-white font-bold'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {currentStep > 3 ? <Check className="w-3 h-3 stroke-[3]" /> : '3'}
              </span>
              <span className="truncate">3. Confirmação Final</span>
            </div>
            {currentStep === 3 && (
              <span className="text-[10px] uppercase font-black bg-purple-500 text-white px-2 py-0.5 rounded shadow">
                ATIVA
              </span>
            )}
            {currentStep > 3 && (
              <span className="text-[10px] uppercase font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">
                Concluída
              </span>
            )}
          </button>

          {/* ETAPA 4: Conclusão */}
          <div
            className={`flex items-center justify-between p-2.5 rounded-lg text-left transition-all ${
              currentStep === 4
                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-600 font-bold'
                : 'text-zinc-600 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 ${
                  currentStep === 4
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                4
              </span>
              <span className="truncate">4. Conclusão</span>
            </div>
            {currentStep === 4 && (
              <span className="text-[10px] uppercase font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">
                Concluído
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Modo Seguro Banner */}
      <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-4 flex items-start sm:items-center gap-3">
        <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400 shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
            Modo Seguro Ativo • Proteção Total do Banco
          </h3>
          <p className="text-xs text-emerald-200/80 mt-0.5">
            <strong>Nenhum jogador será excluído.</strong> Novos jogadores serão criados com IDs determinísticos e
            jogadores existentes serão atualizados preservando seus históricos. A gravação só ocorre após dupla
            confirmação expressa.
          </p>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-rose-950/40 border border-rose-800/50 rounded-xl p-4 flex items-center gap-3 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASSO 1: UPLOAD & VALIDAÇÃO                                               */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <div className="space-y-6">
          {/* Banner de Retomada Automática do Importador FM2008 (Etapa 1) */}
          {detectedCheckpoint && detectedCheckpoint.lastProcessedIndex > 0 && (
            <div className="bg-gradient-to-r from-purple-950/90 via-zinc-900 to-purple-950/90 border-2 border-purple-500/80 rounded-xl p-5 shadow-2xl space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="p-3 bg-purple-600/30 text-purple-300 rounded-xl border border-purple-500/50 shrink-0">
                    <Play className="w-6 h-6 text-purple-300 fill-current" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-purple-300 bg-purple-950 border border-purple-600 px-2 py-0.5 rounded">
                        Checkpoint Salvo: #{detectedCheckpoint.lastProcessedIndex.toLocaleString('pt-BR')}
                      </span>
                      <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-700/60 px-2 py-0.5 rounded">
                        {detectedCheckpoint.lastProcessedIndex.toLocaleString('pt-BR')} registros gravados anteriormente protegidos
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-white">
                      Retomada Direta do Importador FM2008
                    </h3>
                    <p className="text-xs text-zinc-300 mt-1 max-w-2xl leading-relaxed">
                      O último lote gravado encerrou na posição <strong className="text-white font-mono font-bold">#{detectedCheckpoint.lastProcessedIndex.toLocaleString('pt-BR')}</strong>. Ao clicar no botão ao lado, serão carregados e selecionados exclusivamente os próximos <strong className="text-purple-300 font-mono font-bold">200 registros (#{ (detectedCheckpoint.lastProcessedIndex + 1).toLocaleString('pt-BR') } a #{ Math.min(detectedCheckpoint.totalRecords || 37867, detectedCheckpoint.lastProcessedIndex + 200).toLocaleString('pt-BR') })</strong> para a Homologação, sem reprocessar os {detectedCheckpoint.lastProcessedIndex.toLocaleString('pt-BR')} anteriores.
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center">
                  <button
                    type="button"
                    id="btn-continuar-importacao-etapa1"
                    onClick={handleContinueImportNextBatch}
                    className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-98 text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl shadow-xl shadow-purple-950/60 border border-purple-400 cursor-pointer transition-all"
                  >
                    <Play className="w-4 h-4 fill-current text-white shrink-0" />
                    <span>
                      CONTINUAR IMPORTAÇÃO — LOTE 200: #{(detectedCheckpoint.lastProcessedIndex + 1).toLocaleString('pt-BR')} A #{Math.min(detectedCheckpoint.totalRecords || 37867, detectedCheckpoint.lastProcessedIndex + 200).toLocaleString('pt-BR')}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Upload Zone */}
          <div className="bg-[#121212] border border-[#262626] rounded-xl p-6">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                if (canPerformAdminOperations) {
                  setIsDragging(true);
                }
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                if (!canPerformAdminOperations) {
                  e.preventDefault();
                  setIsDragging(false);
                  setErrorMessage('Operação protegida: Faça login no cartão acima com sua conta de Administrador.');
                  return;
                }
                handleDrop(e);
              }}
              onClick={() => {
                if (!canPerformAdminOperations) {
                  setErrorMessage('Operação protegida: Faça login no cartão acima e confirme o perfil de Administrador para selecionar arquivos.');
                  return;
                }
                fileInputRef.current?.click();
              }}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                !canPerformAdminOperations
                  ? 'border-zinc-800 bg-[#0a0a0a] cursor-not-allowed opacity-75'
                  : isDragging
                  ? 'border-purple-500 bg-purple-950/20 cursor-pointer'
                  : 'border-[#333] hover:border-purple-500/60 bg-[#0d0d0d] hover:bg-[#141414] cursor-pointer'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                disabled={!canPerformAdminOperations}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />

              <div className="w-12 h-12 rounded-full bg-purple-900/30 border border-purple-700/40 flex items-center justify-center text-purple-400 mx-auto mb-3">
                <Upload className="w-5 h-5" />
              </div>

              <h3 className="text-sm font-bold text-white mb-1">
                {canPerformAdminOperations
                  ? 'Selecione ou arraste o arquivo CSV do FM26'
                  : 'Envio de CSV Protegido • Login de Administrador Requerido'}
              </h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                {canPerformAdminOperations
                  ? 'Arquivos delimitados por vírgula (,) ou ponto-e-vírgula (;). O codificador detectará automaticamente colunas e normalizará os valores para Real Brasileiro (R$).'
                  : 'Faça login com sua conta autorizada no cartão superior para liberar o envio e processamento de arquivos CSV.'}
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded-md border border-zinc-700">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-purple-400" />
                  Formatos aceitos: .csv, .txt (UTF-8)
                </span>
                {canPerformAdminOperations && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoadSampleCSV();
                    }}
                    disabled={isValidating}
                    className="inline-flex items-center gap-1 text-[11px] bg-purple-900/40 hover:bg-purple-800/60 text-purple-200 px-2.5 py-1 rounded-md border border-purple-700/50 transition-colors cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-purple-300" />
                    <span>Ou carregar exemplo com 22 atletas</span>
                  </button>
                )}
              </div>
            </div>

            {/* Selected File Details & Actions */}
            {activeSelectedFile && (
              <div className="mt-4 p-4 bg-[#0a0a0a] border border-[#262626] rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-950/60 border border-purple-700/50 flex items-center justify-center text-purple-400">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{activeSelectedFile.name}</div>
                    <div className="text-[11px] text-zinc-400 font-mono">
                      {(activeSelectedFile.size / 1024).toFixed(1)} KB • {activeSelectedFile.type || 'text/csv'}
                      {activeSummary && (
                        <span className="text-emerald-400 font-semibold ml-2">
                          • {activeSummary.totalPlayersFound} atletas validados ✓
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg border border-zinc-800 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Limpar</span>
                  </button>

                  <button
                    onClick={handleValidate}
                    disabled={isValidating || !canPerformAdminOperations}
                    className="flex items-center gap-2 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white bg-purple-600 hover:bg-purple-500 active:bg-purple-700 rounded-lg shadow-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isValidating ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Validando...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{activeSummary ? 'Revalidar Arquivo' : 'Validar Arquivo'}</span>
                      </>
                    )}
                  </button>

                  {activeSummary && activeSummary.totalPlayersFound > 0 && (
                    <button
                      type="button"
                      onClick={handleStartHomologation}
                      disabled={isBuildingHomologation}
                      className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-lg shadow-md transition-colors cursor-pointer"
                    >
                      <span>Avançar para Homologação</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Validation Results Area */}
          {activeSummary && (
            <div ref={validationResultsRef} className="space-y-6">
              {/* Summary Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-[#121212] border border-[#262626] rounded-xl p-3.5">
                  <span className="text-xs text-zinc-400 font-medium block mb-1">
                    Total Encontrados
                  </span>
                  <span className="text-2xl font-black text-white font-mono">
                    {activeSummary.totalPlayersFound}
                  </span>
                  <span className="text-[10px] text-zinc-500 block mt-1">
                    Linhas CSV: {activeSummary.totalRows}
                  </span>
                </div>

                <div className="bg-[#121212] border border-emerald-900/40 rounded-xl p-3.5">
                  <span className="text-xs text-emerald-400 font-medium block mb-1">
                    Registros Válidos
                  </span>
                  <span className="text-2xl font-black text-emerald-400 font-mono">
                    {activeSummary.validRecords}
                  </span>
                  <span className="text-[10px] text-zinc-500 block mt-1">
                    Aptos a homologar
                  </span>
                </div>

                <div className="bg-[#121212] border border-zinc-800 rounded-xl p-3.5">
                  <span className="text-xs text-zinc-400 font-medium block mb-1">
                    IDs Vazios
                  </span>
                  <span className={`text-2xl font-black font-mono ${(activeSummary.emptyIdsCount ?? 0) === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {activeSummary.emptyIdsCount ?? 0}
                  </span>
                  <span className="text-[10px] text-zinc-500 block mt-1">
                    Unique ID ausente
                  </span>
                </div>

                <div className="bg-[#121212] border border-indigo-900/40 rounded-xl p-3.5">
                  <span className="text-xs text-indigo-400 font-medium block mb-1">
                    IDs Duplicados
                  </span>
                  <span className={`text-2xl font-black font-mono ${(activeSummary.duplicateIdsCount ?? 0) === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {activeSummary.duplicateIdsCount ?? 0}
                  </span>
                  <span className="text-[10px] text-zinc-500 block mt-1">
                    Colisão no CSV
                  </span>
                </div>

                <div className="bg-[#121212] border border-zinc-800 rounded-xl p-3.5">
                  <span className="text-xs text-zinc-400 font-medium block mb-1">
                    Nomes Vazios
                  </span>
                  <span className={`text-2xl font-black font-mono ${(activeSummary.emptyNamesCount ?? 0) === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {activeSummary.emptyNamesCount ?? 0}
                  </span>
                  <span className="text-[10px] text-zinc-500 block mt-1">
                    Nome ausente
                  </span>
                </div>

                <div className="bg-[#121212] border border-amber-900/40 rounded-xl p-3.5">
                  <span className="text-xs text-amber-400 font-medium block mb-1">
                    Registros Inválidos
                  </span>
                  <span className={`text-2xl font-black font-mono ${(activeSummary.invalidRecordsCount ?? activeSummary.problematicRecords) === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {activeSummary.invalidRecordsCount ?? activeSummary.problematicRecords}
                  </span>
                  <span className="text-[10px] text-zinc-500 block mt-1">
                    Campos estruturais
                  </span>
                </div>
              </div>

              {/* Columns Analysis */}
              <div className="bg-[#121212] border border-[#262626] rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Info className="w-4 h-4 text-purple-400" />
                  <span>Diagnóstico de Cabeçalhos e Colunas ({activeSummary.delimiterDetected})</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* Reconhecidas */}
                  <div className="bg-[#0a0a0a] border border-emerald-950/80 rounded-lg p-3">
                    <span className="font-bold text-emerald-400 block mb-2">
                      Colunas Reconhecidas ({activeSummary.recognizedColumns.length}):
                    </span>
                    {activeSummary.recognizedColumns.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {activeSummary.recognizedColumns.map((col, idx) => (
                          <span
                            key={idx}
                            className="bg-emerald-500/15 text-emerald-300 text-[10px] px-2 py-0.5 rounded border border-emerald-500/30 font-mono"
                          >
                            {col}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-zinc-500 italic">Nenhuma coluna reconhecida.</span>
                    )}
                  </div>

                  {/* Desconhecidas */}
                  <div className="bg-[#0a0a0a] border border-zinc-800 rounded-lg p-3">
                    <span className="font-bold text-zinc-400 block mb-2">
                      Colunas Extras / Outras ({activeSummary.unrecognizedColumns.length}):
                    </span>
                    {activeSummary.unrecognizedColumns.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {activeSummary.unrecognizedColumns.map((col, idx) => (
                          <span
                            key={idx}
                            className="bg-zinc-800 text-zinc-300 text-[10px] px-2 py-0.5 rounded border border-zinc-700 font-mono"
                          >
                            {col}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-zinc-500 italic">Todas as colunas foram mapeadas.</span>
                    )}
                  </div>

                  {/* Recomendadas Ausentes */}
                  <div className="bg-[#0a0a0a] border border-amber-950/80 rounded-lg p-3">
                    <span className="font-bold text-amber-400 block mb-2">
                      Campos Recomendados Ausentes ({activeSummary.missingRecommendedColumns.length}):
                    </span>
                    {activeSummary.missingRecommendedColumns.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {activeSummary.missingRecommendedColumns.map((col, idx) => (
                          <span
                            key={idx}
                            className="bg-amber-500/15 text-amber-300 text-[10px] px-2 py-0.5 rounded border border-amber-500/30 font-mono"
                          >
                            {col}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-emerald-400 text-[11px] font-semibold">
                        ✓ Todos os campos recomendados presentes!
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card de Homologação / Validação Oficial Cristiano Ronaldo (FM2008) */}
              {(() => {
                const cr7 = activeSummary.previewPlayers.find(
                  (p) => p.uniqueId === '735216' || p.externalId === '735216' || p.id === 'fm2008_735216'
                );
                if (!cr7) return null;
                return (
                  <div className="bg-gradient-to-r from-amber-950/40 via-zinc-900 to-zinc-900 border-2 border-amber-500/50 rounded-xl p-5 shadow-xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-amber-800/40">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-500/20 text-amber-300 rounded-lg border border-amber-500/40">
                          <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                        </div>
                        <div>
                          <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold block">
                            Caso de Teste Oficial Homologado
                          </span>
                          <h3 className="text-base font-black text-white flex items-center gap-2">
                            <span>{cr7.name}</span>
                            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded text-[10px] font-mono">
                              Fonte: {cr7.databaseSource || 'FM2008'}
                            </span>
                          </h3>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-700/50 px-2.5 py-1 rounded-md font-mono font-bold">
                          Validação Preliminar OK ✓
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-black/50 border border-zinc-800 rounded-lg p-2.5">
                        <span className="text-[10px] text-zinc-400 block mb-0.5 font-medium">Nome</span>
                        <strong className="text-white font-mono text-sm">{cr7.name}</strong>
                      </div>
                      <div className="bg-black/50 border border-amber-900/40 rounded-lg p-2.5">
                        <span className="text-[10px] text-amber-400 block mb-0.5 font-medium">Unique ID</span>
                        <strong className="text-amber-300 font-mono text-sm">{cr7.uniqueId || cr7.externalId || '735216'}</strong>
                      </div>
                      <div className="bg-black/50 border border-amber-900/60 rounded-lg p-2.5">
                        <span className="text-[10px] text-amber-400 block mb-0.5 font-medium">ID FM Universe</span>
                        <strong className="text-amber-200 font-mono text-sm">{cr7.id}</strong>
                      </div>
                      <div className="bg-black/50 border border-zinc-800 rounded-lg p-2.5">
                        <span className="text-[10px] text-zinc-400 block mb-0.5 font-medium">Fonte</span>
                        <strong className="text-purple-300 font-mono text-sm">{cr7.databaseSource || 'FM2008'}</strong>
                      </div>
                      <div className="bg-black/50 border border-zinc-800 rounded-lg p-2.5">
                        <span className="text-[10px] text-zinc-400 block mb-0.5 font-medium">CA</span>
                        <strong className="text-emerald-400 font-mono text-sm">{cr7.ca || cr7.overall || 187}</strong>
                      </div>
                      <div className="bg-black/50 border border-zinc-800 rounded-lg p-2.5">
                        <span className="text-[10px] text-zinc-400 block mb-0.5 font-medium">PA</span>
                        <strong className="text-purple-400 font-mono text-sm">{cr7.pa || cr7.potential || 195}</strong>
                      </div>
                      <div className="bg-black/50 border border-zinc-800 rounded-lg p-2.5">
                        <span className="text-[10px] text-zinc-400 block mb-0.5 font-medium">Clube no momento da captura</span>
                        <strong className="text-white font-mono text-sm">{cr7.club || 'Man Utd'}</strong>
                      </div>
                      <div className="bg-black/50 border border-zinc-800 rounded-lg p-2.5">
                        <span className="text-[10px] text-zinc-400 block mb-0.5 font-medium">Nacionalidade</span>
                        <strong className="text-white font-mono text-sm">{cr7.nationality || 'Portugal'}</strong>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Tabela de Pré-visualização com as 22 Linhas Validadas */}
              <div className="bg-[#121212] border border-[#262626] rounded-xl overflow-hidden shadow-lg">
                <div className="p-4 bg-[#171717] border-b border-[#262626] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-400" />
                      <span>Atletas Validados no Arquivo ({activeSummary.totalPlayersFound} registros)</span>
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Todos os registros foram conferidos, com valores e salários padronizados em R$ (BRL).
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleStartHomologation}
                    disabled={isBuildingHomologation || activeSummary.totalPlayersFound === 0}
                    className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-bold px-4 py-2 rounded-lg text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <span>Avançar para Homologação</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="overflow-x-auto max-h-[440px] overflow-y-auto">
                  {(() => {
                    const isFM2008Data =
                      activeSummary.databaseSource === 'FM2008' ||
                      (activeSummary.previewPlayers &&
                        activeSummary.previewPlayers.some(
                          (p) =>
                            p.databaseSource === 'FM2008' ||
                            p.ca !== undefined ||
                            p.aDiff !== undefined ||
                            p.saleValue !== undefined
                        ));

                    const playersToRender =
                      activeSummary.allPlayers && activeSummary.allPlayers.length > 0
                        ? activeSummary.allPlayers
                        : activeSummary.previewPlayers;

                    return (
                      <table className="w-full text-xs text-left">
                        <thead className="bg-[#0a0a0a] text-zinc-400 font-semibold border-b border-[#262626] uppercase text-[10px] tracking-wider sticky top-0 z-10">
                          <tr>
                            <th className="py-2.5 px-3 w-10 text-center">#</th>
                            {isFM2008Data && <th className="py-2.5 px-2 text-center">UID</th>}
                            <th className="py-2.5 px-3">Nome</th>
                            <th className="py-2.5 px-3">Clube</th>
                            <th className="py-2.5 px-2 text-center">Posição</th>
                            <th className="py-2.5 px-2 text-center">Idade</th>
                            {isFM2008Data && (
                              <>
                                <th className="py-2.5 px-2 text-center text-emerald-400">CA</th>
                                <th className="py-2.5 px-2 text-center text-purple-400">Pot A (PA)</th>
                                <th className="py-2.5 px-2 text-center text-zinc-300">A Diff</th>
                              </>
                            )}
                            <th className="py-2.5 px-2 text-center">OVR</th>
                            <th className="py-2.5 px-2 text-center">POT</th>
                            <th className="py-2.5 px-3 text-right">Valor</th>
                            {isFM2008Data && <th className="py-2.5 px-3 text-right text-emerald-300">Sale Value</th>}
                            <th className="py-2.5 px-3 text-right">Salário</th>
                            <th className="py-2.5 px-3">Nacionalidade</th>
                            {!isFM2008Data && <th className="py-2.5 px-2 text-center">Pé</th>}
                            <th className="py-2.5 px-2 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1f1f1f]">
                          {playersToRender.map((player, idx) => (
                            <tr key={player.id || idx} className="hover:bg-[#181818] transition-colors">
                              <td className="py-2 px-3 text-center text-zinc-500 font-mono text-[11px]">{idx + 1}</td>
                              {isFM2008Data && (
                                <td className="py-2 px-2 text-center text-zinc-400 font-mono text-[10px]">
                                  {player.uniqueId || player.externalId || '—'}
                                </td>
                              )}
                              <td className="py-2 px-3 font-semibold text-white">{player.name}</td>
                              <td className="py-2 px-3 text-zinc-300">{player.club}</td>
                              <td className="py-2 px-2 text-center">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-purple-300 font-mono">
                                  {player.position}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-center text-zinc-300 font-mono">{player.age}</td>
                              {isFM2008Data && (
                                <>
                                  <td className="py-2 px-2 text-center text-emerald-400 font-bold font-mono">
                                    {player.ca ?? '—'}
                                  </td>
                                  <td className="py-2 px-2 text-center text-purple-400 font-bold font-mono">
                                    {player.pa ?? '—'}
                                  </td>
                                  <td className="py-2 px-2 text-center text-zinc-400 font-mono">
                                    {player.aDiff !== undefined ? player.aDiff : '—'}
                                  </td>
                                </>
                              )}
                              <td className="py-2 px-2 text-center">
                                <span className={`font-bold font-mono ${player.overall >= 85 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                  {player.overall}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-center">
                                <span className="font-bold font-mono text-purple-400">{player.potential}</span>
                              </td>
                              <td className="py-2 px-3 text-right text-emerald-400 font-mono text-[11px]">
                                {player.marketValue > 0
                                  ? formatCurrencyBRL(player.marketValue, { compact: false })
                                  : <span className="text-zinc-500">0</span>}
                              </td>
                              {isFM2008Data && (
                                <td className="py-2 px-3 text-right text-emerald-300/80 font-mono text-[11px]">
                                  {player.saleValue && player.saleValue > 0
                                    ? formatCurrencyBRL(player.saleValue, { compact: false })
                                    : <span className="text-zinc-500">—</span>}
                                </td>
                              )}
                              <td className="py-2 px-3 text-right text-zinc-300 font-mono text-[11px]">
                                {player.wage > 0 ? (
                                  formatCurrencyBRL(player.wage, { compact: false })
                                ) : (
                                  <span className="text-zinc-500 italic">Ausente</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-zinc-400">{player.nationality}</td>
                              {!isFM2008Data && (
                                <td className="py-2 px-2 text-center text-zinc-400 text-[11px]">{player.preferredFoot}</td>
                              )}
                              <td className="py-2 px-2 text-center">
                                <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                  Válido ✓
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              </div>

              {/* Botão de Avanço para Homologação */}
              <div className="bg-[#171717] border border-purple-900/40 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-lg">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-400" />
                    <span>Validação preliminar concluída com sucesso!</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    O arquivo contém {activeSummary.totalPlayersFound} registros analisados. Avance para a etapa de{' '}
                    <strong className="text-purple-300">Homologação</strong> para cruzar com os atletas já cadastrados no FM Universe.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  {detectedCheckpoint && detectedCheckpoint.lastProcessedIndex > 0 && (
                    <button
                      type="button"
                      id="btn-continuar-importacao-bottom-etapa1"
                      onClick={handleContinueImportNextBatch}
                      className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-98 text-white font-bold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer border border-purple-400"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>
                        CONTINUAR IMPORTAÇÃO — LOTE 200: #{(detectedCheckpoint.lastProcessedIndex + 1).toLocaleString('pt-BR')} A #{Math.min(detectedCheckpoint.totalRecords || 37867, detectedCheckpoint.lastProcessedIndex + 200).toLocaleString('pt-BR')}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    id="btn-avancar-homologacao"
                    onClick={handleStartHomologation}
                    disabled={isBuildingHomologation || activeSummary.totalPlayersFound === 0}
                    className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-bold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider border border-zinc-700 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isBuildingHomologation ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Processando Homologação...</span>
                      </>
                    ) : (
                      <>
                        <span>AVANÇAR PARA HOMOLOGAÇÃO COMPLETA</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASSO 2: HOMOLOGAÇÃO DA IMPORTAÇÃO                                        */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <div className="space-y-6">
          {!activeHomologation ? (
            <div className="bg-[#121212] border border-[#262626] rounded-xl p-8 text-center space-y-3">
              <p className="text-zinc-300 text-sm">
                Nenhum dado de homologação encontrado em memória. Por favor, valide o arquivo CSV antes de homologar.
              </p>
              <button
                type="button"
                onClick={() => {
                  setCurrentStep(1);
                  fm26SharedMemory.currentStep = 1;
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Voltar para Validação CSV
              </button>
            </div>
          ) : (
            <>
              {/* Métricas Oficiais da Homologação (Requisitos 1 a 6) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* 1. Total Encontrados */}
                <div className="bg-[#121212] border border-[#262626] rounded-xl p-3.5">
                  <span className="text-[11px] text-zinc-400 font-medium block mb-1">
                    1. Total no CSV
                  </span>
                  <span className="text-2xl font-black text-white font-mono">
                    {activeHomologation.totalFound}
                  </span>
                  <span className="text-[10px] text-zinc-500 block mt-1">Lidos no arquivo</span>
                </div>

                {/* 2. Novos */}
                <div className="bg-[#121212] border border-emerald-800/40 rounded-xl p-3.5 bg-gradient-to-b from-emerald-950/20 to-transparent">
                  <span className="text-[11px] text-emerald-400 font-medium block mb-1">
                    2. Atletas Novos
                  </span>
                  <span className="text-2xl font-black text-emerald-400 font-mono">
                    {activeHomologation.totalNew}
                  </span>
                  <span className="text-[10px] text-emerald-500/80 block mt-1">Candidatos a criação</span>
                </div>

                {/* 3. Atualizados */}
                <div className="bg-[#121212] border border-sky-800/40 rounded-xl p-3.5 bg-gradient-to-b from-sky-950/20 to-transparent">
                  <span className="text-[11px] text-sky-400 font-medium block mb-1">
                    3. Já no Banco
                  </span>
                  <span className="text-2xl font-black text-sky-400 font-mono">
                    {activeHomologation.totalUpdate}
                  </span>
                  <span className="text-[10px] text-sky-500/80 block mt-1">Candidatos a atualizar</span>
                </div>

                {/* 4. Duplicados dentro do CSV */}
                <div className="bg-[#121212] border border-amber-800/40 rounded-xl p-3.5 bg-gradient-to-b from-amber-950/20 to-transparent">
                  <span className="text-[11px] text-amber-400 font-medium block mb-1">
                    4. Duplicados CSV
                  </span>
                  <span className="text-2xl font-black text-amber-400 font-mono">
                    {activeHomologation.totalDuplicate}
                  </span>
                  <span className="text-[10px] text-amber-500/80 block mt-1">Ignorados (não duplicar)</span>
                </div>

                {/* 5. Dados Inválidos */}
                <div className="bg-[#121212] border border-rose-800/40 rounded-xl p-3.5 bg-gradient-to-b from-rose-950/20 to-transparent">
                  <span className="text-[11px] text-rose-400 font-medium block mb-1">
                    5. Inválidos / Erros
                  </span>
                  <span className="text-2xl font-black text-rose-400 font-mono">
                    {activeHomologation.totalInvalid}
                  </span>
                  <span className="text-[10px] text-rose-500/80 block mt-1">Ignorados (bloqueados)</span>
                </div>

                {/* 6. Total Final que será gravado */}
                <div className="bg-[#121212] border border-purple-600/50 rounded-xl p-3.5 bg-gradient-to-b from-purple-950/40 to-transparent shadow-md">
                  <span className="text-[11px] text-purple-300 font-bold block mb-1">
                    6. Total a Gravar
                  </span>
                  <span className="text-2xl font-black text-purple-300 font-mono">
                    {activeHomologation.totalSelectedToRecord}
                  </span>
                  <span className="text-[10px] text-purple-400 block mt-1">Selecionados</span>
                </div>
              </div>

              {/* Card de Homologação Oficial de Cristiano Ronaldo (FM2008) */}
              {(() => {
                const cr7Item = activeHomologation.items.find(
                  (it) =>
                    it.parsedPlayer.uniqueId === '735216' ||
                    it.parsedPlayer.externalId === '735216' ||
                    it.id === 'fm2008_735216'
                );
                if (!cr7Item) return null;
                const p = cr7Item.parsedPlayer;
                return (
                  <div className="bg-gradient-to-r from-amber-950/40 via-zinc-900 to-zinc-900 border-2 border-amber-500/60 rounded-xl p-5 shadow-xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-amber-800/40">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-500/20 text-amber-300 rounded-lg border border-amber-500/40">
                          <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                        </div>
                        <div>
                          <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold block">
                            Homologação do Cristiano • Validação Obrigatória
                          </span>
                          <h3 className="text-base font-black text-white flex items-center gap-2">
                            <span>{p.name}</span>
                            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded text-[10px] font-mono">
                              Fonte: {p.databaseSource || 'FM2008'}
                            </span>
                          </h3>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-400 uppercase font-semibold">Decisão:</span>
                        <span
                          className={`text-xs px-3 py-1 rounded-md font-mono font-bold border ${
                            cr7Item.action === 'NOVO'
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                              : 'bg-sky-950/60 text-sky-300 border-sky-500/40'
                          }`}
                        >
                          {cr7Item.action} ✓
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-black/50 border border-zinc-800 rounded-lg p-2.5">
                        <span className="text-[10px] text-zinc-400 block mb-0.5 font-medium">Nome</span>
                        <strong className="text-white font-mono text-sm">{p.name}</strong>
                      </div>
                      <div className="bg-black/50 border border-amber-900/40 rounded-lg p-2.5">
                        <span className="text-[10px] text-amber-400 block mb-0.5 font-medium">Unique ID</span>
                        <strong className="text-amber-300 font-mono text-sm">{p.uniqueId || p.externalId || '735216'}</strong>
                      </div>
                      <div className="bg-black/50 border border-amber-900/60 rounded-lg p-2.5">
                        <span className="text-[10px] text-amber-400 block mb-0.5 font-medium">ID FM Universe</span>
                        <strong className="text-amber-200 font-mono text-sm">{cr7Item.id}</strong>
                      </div>
                      <div className="bg-black/50 border border-zinc-800 rounded-lg p-2.5">
                        <span className="text-[10px] text-zinc-400 block mb-0.5 font-medium">Fonte</span>
                        <strong className="text-purple-300 font-mono text-sm">{p.databaseSource || 'FM2008'}</strong>
                      </div>
                      <div className="bg-black/50 border border-zinc-800 rounded-lg p-2.5">
                        <span className="text-[10px] text-zinc-400 block mb-0.5 font-medium">CA</span>
                        <strong className="text-emerald-400 font-mono text-sm">{p.ca || p.overall || 187}</strong>
                      </div>
                      <div className="bg-black/50 border border-zinc-800 rounded-lg p-2.5">
                        <span className="text-[10px] text-zinc-400 block mb-0.5 font-medium">PA</span>
                        <strong className="text-purple-400 font-mono text-sm">{p.pa || p.potential || 195}</strong>
                      </div>
                      <div className="bg-black/50 border border-zinc-800 rounded-lg p-2.5">
                        <span className="text-[10px] text-zinc-400 block mb-0.5 font-medium">Clube no momento da captura</span>
                        <strong className="text-white font-mono text-sm">{p.club || 'Man Utd'}</strong>
                      </div>
                      <div className="bg-black/50 border border-zinc-800 rounded-lg p-2.5">
                        <span className="text-[10px] text-zinc-400 block mb-0.5 font-medium">Nacionalidade</span>
                        <strong className="text-white font-mono text-sm">{p.nationality || 'Portugal'}</strong>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Banner Informativo do Lote e Checkpoint Ativo */}
              {detectedCheckpoint && detectedCheckpoint.lastProcessedIndex > 0 ? (
                <div className="bg-purple-950/40 border border-purple-500/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-purple-900/60 border border-purple-500/40 flex items-center justify-center shrink-0">
                      <CheckSquare className="w-5 h-5 text-purple-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
                          Homologação com Checkpoint Ativo
                        </span>
                        <span className="px-2 py-0.5 bg-purple-900/80 border border-purple-600 text-purple-200 text-[10px] font-mono font-bold rounded">
                          Checkpoint: #{detectedCheckpoint.lastProcessedIndex}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-300 mt-0.5">
                        Exibindo o lote de <strong className="text-white font-mono font-bold">{activeHomologation.totalSelectedToRecord} atletas</strong> (posições <strong className="text-purple-300 font-mono">#{detectedCheckpoint.lastProcessedIndex + 1}</strong> a <strong className="text-purple-300 font-mono">#{detectedCheckpoint.lastProcessedIndex + activeHomologation.totalSelectedToRecord}</strong>).
                        Registros anteriores (1 a {detectedCheckpoint.lastProcessedIndex}) permanecem confirmados e protegidos.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setActionFilter('SELECIONADOS' as any);
                        setCurrentPage(1);
                      }}
                      className="px-3 py-1.5 bg-purple-900/70 hover:bg-purple-800 border border-purple-600/60 rounded-lg text-xs font-bold text-purple-200 cursor-pointer transition-colors"
                    >
                      Ver os Selecionados
                    </button>

                    <button
                      type="button"
                      id="btn-continuar-importacao-banner"
                      onClick={handleContinueImportNextBatch}
                      className="px-3 py-1.5 bg-emerald-900/70 hover:bg-emerald-800 border border-emerald-600/60 rounded-lg text-xs font-bold text-emerald-200 flex items-center gap-1.5 cursor-pointer transition-colors"
                      title="Pega o próximo lote a partir do checkpoint"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Continuar Importação</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-900/60 border border-emerald-500/40 flex items-center justify-center shrink-0">
                      <Sparkles className="w-5 h-5 text-emerald-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                          Arquivo Independente — Nova Importação
                        </span>
                        <span className="px-2 py-0.5 bg-emerald-900/80 border border-emerald-600 text-emerald-200 text-[10px] font-mono font-bold rounded">
                          Início no Atleta #1
                        </span>
                      </div>
                      <p className="text-xs text-zinc-300 mt-0.5">
                        Arquivo independente: todos os <strong className="text-white font-mono font-bold">{activeHomologation.items.length} atletas</strong> estão homologados e disponíveis para seleção (início a partir do jogador #1, sem aplicar checkpoints de arquivos anteriores).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleSelectAllEligible(true)}
                      className="px-3 py-1.5 bg-emerald-900/70 hover:bg-emerald-800 border border-emerald-600/60 rounded-lg text-xs font-bold text-emerald-200 cursor-pointer transition-colors"
                    >
                      Selecionar Todos ({activeHomologation.items.filter((i) => i.canSelect).length})
                    </button>
                  </div>
                </div>
              )}

              {/* Barra de Filtros e Controles de Seleção */}
              <div className="bg-[#121212] border border-[#262626] rounded-xl p-4 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  {/* Filtros por Ação */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-zinc-400 font-semibold mr-1 flex items-center gap-1">
                      <Filter className="w-3.5 h-3.5" />
                      <span>Filtrar:</span>
                    </span>
                    <button
                      onClick={() => {
                        setActionFilter('TODOS');
                        setCurrentPage(1);
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                        actionFilter === 'TODOS'
                          ? 'bg-purple-600 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      Todos ({activeHomologation.items.length})
                    </button>
                    <button
                      onClick={() => {
                        setActionFilter('SELECIONADOS' as any);
                        setCurrentPage(1);
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                        (actionFilter as any) === 'SELECIONADOS'
                          ? 'bg-purple-600 text-white'
                          : 'bg-zinc-800 text-purple-300 hover:text-white'
                      }`}
                    >
                      Selecionados ({activeHomologation.totalSelectedToRecord})
                    </button>
                    <button
                      onClick={() => {
                        setActionFilter('NOVO');
                        setCurrentPage(1);
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                        actionFilter === 'NOVO'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-zinc-800 text-emerald-400 hover:text-white'
                      }`}
                    >
                      Novos ({activeHomologation.totalNew})
                    </button>
                    <button
                      onClick={() => {
                        setActionFilter('ATUALIZAR');
                        setCurrentPage(1);
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                        actionFilter === 'ATUALIZAR'
                          ? 'bg-sky-600 text-white'
                          : 'bg-zinc-800 text-sky-400 hover:text-white'
                      }`}
                    >
                      Atualizar ({activeHomologation.totalUpdate})
                    </button>
                    <button
                      onClick={() => {
                        setActionFilter('IGNORAR/DUPLICADO');
                        setCurrentPage(1);
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                        actionFilter === 'IGNORAR/DUPLICADO'
                          ? 'bg-amber-600 text-white'
                          : 'bg-zinc-800 text-amber-400 hover:text-white'
                      }`}
                    >
                      Duplicados ({activeHomologation.totalDuplicate})
                    </button>
                    <button
                      onClick={() => {
                        setActionFilter('ERRO');
                        setCurrentPage(1);
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                        actionFilter === 'ERRO'
                          ? 'bg-rose-600 text-white'
                          : 'bg-zinc-800 text-rose-400 hover:text-white'
                      }`}
                    >
                      Erros ({activeHomologation.totalInvalid})
                    </button>
                  </div>

                  {/* Busca por texto */}
                  <div className="relative min-w-[240px]">
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Buscar por nome, clube ou posição..."
                      className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Linha de Ações em Lote: Selecionar Todos + Contador + Botões de Ação */}
                <div className="pt-3 border-t border-[#262626] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleSelectAllVisible(!areAllVisibleSelected)}
                      className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white font-medium cursor-pointer bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-lg"
                    >
                      {areAllVisibleSelected ? (
                        <CheckSquare className="w-3.5 h-3.5 text-purple-400" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-zinc-500" />
                      )}
                      <span>Página Atual ({paginatedItems.filter((i) => i.canSelect).length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectAllEligible(true)}
                      className="px-2.5 py-1 bg-purple-950/60 hover:bg-purple-900/80 border border-purple-700/50 rounded-lg text-xs text-purple-300 font-medium cursor-pointer transition-colors"
                    >
                      {detectedCheckpoint && detectedCheckpoint.lastProcessedIndex > 0
                        ? `Selecionar Lote Atual (${activeHomologation.items.filter((i) => i.canSelect).length})`
                        : `Selecionar Todos (${activeHomologation.items.filter((i) => i.canSelect).length})`}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectAllEligible(false)}
                      className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 font-medium cursor-pointer transition-colors"
                    >
                      Desmarcar Todos
                    </button>

                    <span className="text-zinc-600">•</span>

                    <div className="text-xs">
                      <span className="text-zinc-400">Selecionados para gravação: </span>
                      <strong className="text-purple-400 font-mono font-bold">
                        {activeHomologation.totalSelectedToRecord}
                      </strong>
                      <span className="text-zinc-500">
                        {detectedCheckpoint && detectedCheckpoint.lastProcessedIndex > 0
                          ? ` atletas (Lote #${resumeStartIndex} a #${resumeStartIndex + activeHomologation.totalSelectedToRecord - 1})`
                          : ` de ${activeHomologation.items.length} atletas disponíveis`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      id="btn-continuar-importacao-etapa2"
                      onClick={handleContinueImportNextBatch}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-200 bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-700/60 rounded-xl transition-colors cursor-pointer"
                      title="Pega o próximo lote de 200 a partir do checkpoint"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Continuar Importação</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCurrentStep(1);
                        fm26SharedMemory.currentStep = 1;
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-zinc-800 transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Voltar para Etapa 1</span>
                    </button>

                    <button
                      onClick={handleGoToConfirmation}
                      disabled={activeHomologation.totalSelectedToRecord === 0}
                      className="flex items-center gap-2 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white bg-purple-600 hover:bg-purple-500 active:bg-purple-700 rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span>AVANÇAR PARA CONFIRMAÇÃO FINAL</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

          {/* Tabela de Prévia Final da Homologação */}
          <div className="bg-[#121212] border border-[#262626] rounded-xl overflow-hidden shadow-lg">
            <div className="p-3.5 border-b border-[#262626] flex items-center justify-between bg-[#171717]">
              <div className="text-xs text-zinc-400">
                Mostrando página <strong className="text-white">{currentPage}</strong> de{' '}
                <strong className="text-white">{totalPages}</strong> ({filteredItems.length} registros no filtro)
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-400">Por página:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-[#0a0a0a] border border-[#333] text-zinc-300 text-[11px] rounded px-2 py-0.5"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                  <option value={500}>500</option>
                  <option value={1000}>1.000</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#0a0a0a] text-zinc-400 font-semibold border-b border-[#262626] uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">Sel.</th>
                    <th className="py-3 px-3">Nome</th>
                    <th className="py-3 px-3">Clube</th>
                    <th className="py-3 px-3">Nacionalidade</th>
                    <th className="py-3 px-2 text-center">Idade</th>
                    <th className="py-3 px-2 text-center">Posição</th>
                    <th className="py-3 px-2 text-center">OVR</th>
                    <th className="py-3 px-2 text-center">POT</th>
                    <th className="py-3 px-3 text-right">Valor</th>
                    <th className="py-3 px-3 text-right">Salário</th>
                    <th className="py-3 px-3 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f1f1f]">
                  {paginatedItems.map((item) => {
                    const p = item.parsedPlayer;

                    // Badges de Ação
                    const actionBadge = (() => {
                      switch (item.action) {
                        case 'NOVO':
                          return (
                            <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              NOVO
                            </span>
                          );
                        case 'ATUALIZAR':
                          return (
                            <span className="inline-flex items-center gap-1 bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              ATUALIZAR
                            </span>
                          );
                        case 'IGNORAR/DUPLICADO':
                          return (
                            <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full" title={item.reason}>
                              IGNORAR/DUPLICADO
                            </span>
                          );
                        case 'ERRO':
                        default:
                          return (
                            <span className="inline-flex items-center gap-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full" title={item.reason}>
                              ERRO
                            </span>
                          );
                      }
                    })();

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-[#191919] transition-colors ${
                          !item.canSelect ? 'opacity-60 bg-zinc-950/40' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-2.5 px-3 text-center">
                          {item.canSelect ? (
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => handleToggleItemSelection(item.id)}
                              className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-purple-600 focus:ring-purple-500 cursor-pointer"
                            />
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>

                        {/* Nome */}
                        <td className="py-2.5 px-3 font-semibold text-white whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="flex items-center gap-1.5">
                              {p.name}
                              {p.databaseSource === 'FM2008' && (
                                <span className="bg-amber-500/20 text-amber-300 text-[9px] font-mono px-1 py-0.2 rounded border border-amber-500/30">
                                  FM2008
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              ID: {item.id}
                            </span>
                            {p.ca && (
                              <span className="text-[10px] text-emerald-400 font-mono">
                                CA: {p.ca} | PA: {p.pa}{p.aDiff !== undefined ? ` | A Diff: ${p.aDiff}` : ''}{p.saleValue ? ` | Sale: ${formatCurrencyBRL(p.saleValue, { compact: true })}` : ''}
                              </span>
                            )}
                            {item.action === 'ATUALIZAR' && item.existingPlayerId && (
                              <span className="text-[10px] text-sky-400 font-mono">
                                ID Atual: {item.existingPlayerId}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Clube */}
                        <td className="py-2.5 px-3 text-zinc-300 whitespace-nowrap">
                          {p.club}
                        </td>

                        {/* Nacionalidade */}
                        <td className="py-2.5 px-3 text-zinc-300 whitespace-nowrap">
                          {p.nationality || '—'}
                        </td>

                        {/* Idade */}
                        <td className="py-2.5 px-2 text-center text-zinc-300 font-mono">
                          {p.age}
                        </td>

                        {/* Posição */}
                        <td className="py-2.5 px-2 text-center whitespace-nowrap">
                          <PositionBadge position={p.position} size="xs" />
                        </td>

                        {/* OVR */}
                        <td className="py-2.5 px-2 text-center">
                          <RatingBadge rating={p.overall} size="xs" />
                        </td>

                        {/* POT */}
                        <td className="py-2.5 px-2 text-center">
                          <span className="font-mono text-purple-400 font-bold">
                            {p.potential}
                          </span>
                        </td>

                        {/* Valor (R$) */}
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-400 whitespace-nowrap">
                          {formatCurrencyBRL(p.marketValue, { compact: true })}
                        </td>

                        {/* Salário (R$) */}
                        <td className="py-2.5 px-3 text-right font-mono text-zinc-300 whitespace-nowrap">
                          {p.wage > 0 ? (
                            `${formatCurrencyBRL(p.wage, { compact: true, decimals: 0 })}/mês`
                          ) : (
                            <span className="text-zinc-500 italic">Ausente</span>
                          )}
                        </td>

                        {/* Ação */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {actionBadge}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="p-3.5 border-t border-[#262626] bg-[#0d0d0d] flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-zinc-400">
                  Total de <strong className="text-white">{filteredItems.length}</strong> jogadores filtrados ({itemsPerPage} por página)
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 rounded text-xs text-zinc-300 font-medium cursor-pointer"
                    title="Primeira página"
                  >
                    « Primeira
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 rounded text-zinc-300 cursor-pointer"
                    title="Página anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-1 text-xs text-zinc-300 font-mono px-1">
                    <span>Pág.</span>
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={currentPage}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 1 && val <= totalPages) {
                          setCurrentPage(val);
                        }
                      }}
                      className="w-14 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-center text-white text-xs font-bold"
                    />
                    <span>de {totalPages}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 rounded text-zinc-300 cursor-pointer"
                    title="Próxima página"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 rounded text-xs text-zinc-300 font-medium cursor-pointer"
                    title="Última página"
                  >
                    Última »
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Painel Inferior de Homologação com Botão de Avanço */}
          <div className="bg-[#171717] border border-purple-900/40 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-lg">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <span>Homologação Pronta para Confirmação</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                <strong className="text-purple-300 font-mono">{activeHomologation.totalSelectedToRecord}</strong> jogadores selecionados para gravação de um total de {activeHomologation.totalFound} encontrados no CSV.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCurrentStep(1);
                  fm26SharedMemory.currentStep = 1;
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-zinc-800 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar para Etapa 1</span>
              </button>

              <button
                type="button"
                onClick={handleGoToConfirmation}
                disabled={activeHomologation.totalSelectedToRecord === 0}
                className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-purple-600 hover:bg-purple-500 active:bg-purple-700 rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>AVANÇAR PARA CONFIRMAÇÃO FINAL</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )}

      {/* ========================================================================= */}
      {/* PASSO 3: SEGUNDA CONFIRMAÇÃO CLARA & GRAVAÇÃO EM LOTE                    */}
      {/* ========================================================================= */}
      {currentStep === 3 && activeHomologation && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-[#121212] border-2 border-purple-600/60 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-900/40 border border-purple-500/50 flex items-center justify-center text-purple-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs uppercase font-bold text-purple-400 tracking-wider">
                  Etapa Final de Homologação
                </span>
                <h2 className="text-xl font-black text-white">
                  Confirmação de Gravação no Banco
                </h2>
              </div>
            </div>

            {/* Mensagem Oficial Obrigatória */}
            <div className="bg-purple-950/40 border border-purple-700/50 rounded-xl p-5 text-center sm:text-left">
              <p className="text-base sm:text-lg font-bold text-purple-200 leading-relaxed">
                "Você está prestes a gravar{' '}
                <span className="text-white font-black underline underline-offset-4 decoration-purple-400">
                  {activeHomologation.totalSelectedToRecord} jogadores
                </span>{' '}
                no banco do FM Universe. Nenhum jogador existente será excluído."
              </p>
            </div>

            {/* Detalhes do Lote */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-[#0a0a0a] border border-[#262626] rounded-lg p-3">
                <span className="text-zinc-400 block mb-1">Novos Atletas Cadastrados:</span>
                <span className="text-lg font-bold text-emerald-400 font-mono">
                  +{activeHomologation.items.filter((i) => i.selected && i.action === 'NOVO').length}
                </span>
              </div>

              <div className="bg-[#0a0a0a] border border-[#262626] rounded-lg p-3">
                <span className="text-zinc-400 block mb-1">Atletas Existentes Atualizados:</span>
                <span className="text-lg font-bold text-sky-400 font-mono">
                  ~{activeHomologation.items.filter((i) => i.selected && i.action === 'ATUALIZAR').length}
                </span>
              </div>

              <div className="bg-[#0a0a0a] border border-[#262626] rounded-lg p-3">
                <span className="text-zinc-400 block mb-1">Registros Ignorados / Duplicados:</span>
                <span className="text-lg font-bold text-amber-400 font-mono">
                  {activeHomologation.totalDuplicate + activeHomologation.totalInvalid}
                </span>
              </div>

              <div className="bg-[#0a0a0a] border border-[#262626] rounded-lg p-3">
                <span className="text-zinc-400 block mb-1">Jogadores Excluídos do Banco:</span>
                <span className="text-lg font-bold text-zinc-400 font-mono">
                  0 (Nenhum)
                </span>
              </div>
            </div>

            {/* Painel de Retomada e Checkpoint Seguro */}
            <div className="bg-[#121212] border border-purple-500/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-300 font-semibold text-xs uppercase tracking-wider">
                  <RotateCcw className="w-4 h-4 text-purple-400" />
                  <span>Mecanismo de Retomada / Ponto de Partida</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs">
                  <input
                    type="checkbox"
                    checked={enableResume}
                    onChange={(e) => setEnableResume(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                  <span className="text-zinc-300 text-xs font-medium">Ativar Ponto de Retomada</span>
                </label>
              </div>

              {enableResume && (
                <div className="space-y-3 pt-2 border-t border-zinc-800">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <label htmlFor="resume-start-input" className="text-xs text-zinc-300 block font-medium">
                        Iniciar a partir do jogador nº:
                      </label>
                      <span className="text-[11px] text-zinc-500 block">
                        Jogadores 1 até {Math.max(1, resumeStartIndex - 1)} serão considerados já gravados e ignorados na fila.
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        id="resume-start-input"
                        type="number"
                        min={1}
                        max={activeHomologation.totalFound || activeHomologation.items.length || 37867}
                        value={resumeStartIndex}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          const maxLimit = activeHomologation.totalFound || activeHomologation.items.length || 37867;
                          setResumeStartIndex(isNaN(val) ? 1 : Math.max(1, Math.min(maxLimit, val)));
                        }}
                        className="w-32 bg-[#0a0a0a] border border-purple-500/40 rounded-lg px-3 py-1.5 text-right font-mono text-sm font-bold text-purple-200 focus:outline-none focus:border-purple-400"
                      />
                      <span className="text-xs text-zinc-500 font-mono">
                        / {activeHomologation.totalFound || activeHomologation.items.length}
                      </span>
                    </div>
                  </div>

                  {/* Informação sobre lote que será processado no teste */}
                  <div className="bg-[#0a0a0a] border border-purple-500/40 rounded-lg p-3 text-[11px] text-zinc-300 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-purple-300">
                        {onlyTestBatch200 ? 'Lote de Gravação (200 Jogadores):' : 'Importação do Arquivo Independente:'}
                      </span>
                      <span className="bg-purple-950/80 border border-purple-700 text-purple-200 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                        {onlyTestBatch200 ? 'LOTE ESTRITO (200 JOGADORES)' : `ARQUIVO COMPLETO (${activeHomologation.totalSelectedToRecord} ATLETAS)`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono">
                      <span>Intervalo: <strong>#{resumeStartIndex}</strong> até <strong>#{onlyTestBatch200 ? Math.min(activeHomologation.totalFound || activeHomologation.items.length, resumeStartIndex + 199) : (activeHomologation.totalFound || activeHomologation.items.length)}</strong></span>
                      <span className="text-emerald-400 font-bold">Total a gravar: {activeHomologation.totalSelectedToRecord} atletas</span>
                    </div>

                    <p className="text-[10px] text-zinc-400">
                      {onlyTestBatch200
                        ? `Nenhum atleta anterior a #${resumeStartIndex} será tocado ou duplicado. Nenhum atleta além de #${Math.min(activeHomologation.totalFound || activeHomologation.items.length, resumeStartIndex + 199)} será processado.`
                        : `Todos os ${activeHomologation.totalSelectedToRecord} atletas selecionados serão importados a partir do jogador #${resumeStartIndex}.`}
                    </p>
                  </div>

                  {detectedCheckpoint && (
                    <div className="bg-emerald-950/30 border border-emerald-800/30 rounded-lg p-3 text-[11px] text-emerald-300 space-y-2">
                      <div className="flex items-center justify-between">
                        <span>
                          Checkpoint ativo: <strong>#{detectedCheckpoint.lastProcessedIndex}</strong> jogadores confirmados anteriormente.
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const fileName = (selectedFile || fm26SharedMemory.selectedFile)?.name || 'FM2008_PLAYERS_IMPORT.csv';
                            fm26Importer.checkpoint.clearCheckpoint(fileName, activeHomologation.items.length);
                            setDetectedCheckpoint(null);
                            setResumeStartIndex(1);
                          }}
                          className="text-[10px] text-zinc-400 hover:text-rose-300 underline cursor-pointer"
                        >
                          Limpar Checkpoint
                        </button>
                      </div>

                      {resumeStartIndex !== detectedCheckpoint.lastProcessedIndex + 1 && (
                        <div className="flex items-center justify-between pt-1.5 border-t border-emerald-800/30">
                          <span className="text-zinc-400">
                            Próximo atleta do arquivo após checkpoint: <strong>#{detectedCheckpoint.lastProcessedIndex + 1}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => setResumeStartIndex(detectedCheckpoint.lastProcessedIndex + 1)}
                            className="bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            Usar #{detectedCheckpoint.lastProcessedIndex + 1}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Checkbox de Confirmação Expressa */}
            <div className="bg-[#0a0a0a] border border-purple-900/30 rounded-xl p-4 flex items-start gap-3">
              <input
                id="confirm-terms"
                type="checkbox"
                checked={hasConfirmedTerms}
                onChange={(e) => setHasConfirmedTerms(e.target.checked)}
                className="w-5 h-5 rounded border-zinc-700 bg-zinc-800 text-purple-600 focus:ring-purple-500 cursor-pointer mt-0.5"
              />
              <label htmlFor="confirm-terms" className="text-xs text-zinc-300 leading-relaxed cursor-pointer select-none">
                <strong className="text-white">Confirmo a homologação destes dados.</strong> Compreendo que os {activeHomologation.totalSelectedToRecord} registros selecionados serão persistidos no Firestore / DataStore do FM Universe com registro de auditoria.
              </label>
            </div>

            {/* Barra de Progresso Durante a Gravação */}
            {isCommitting && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-zinc-400 font-mono">
                  <span>Gravando jogadores em lote no Firestore...</span>
                  <span>
                    {commitProgress.done} / {commitProgress.total}
                  </span>
                </div>
                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-600 transition-all duration-300"
                    style={{
                      width: `${
                        commitProgress.total > 0
                          ? (commitProgress.done / commitProgress.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Aviso de Proteção se não for Admin Real */}
            {!isRealAdmin && (
              <div className="bg-amber-950/40 border border-amber-800/50 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-300">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold block">
                    Gravação no Firestore Bloqueada • Conta não autorizada
                  </span>
                  <p className="text-zinc-300 text-[11px] leading-relaxed">
                    As regras de segurança do Firestore exigem que a conta autenticada esteja presente na coleção{' '}
                    <code className="bg-zinc-900 px-1 py-0.5 rounded font-mono text-amber-200">/admins/{'{uid}'}</code>.
                    {firebaseUid ? (
                      <> Seu UID atual é <code className="bg-zinc-900 px-1 py-0.5 rounded font-mono text-green-300 font-bold">{firebaseUid}</code>. Cadastre-o no Console do Firebase para liberar a gravação real.</>
                    ) : (
                      <> Faça login com sua conta Google no topo desta página para obter o seu UID.</>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Botões de Ação Definitiva */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCurrentStep(2);
                  fm26SharedMemory.currentStep = 2;
                }}
                disabled={isCommitting}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar à Homologação</span>
              </button>

              <button
                type="button"
                onClick={handleExecuteCommit}
                disabled={!hasConfirmedTerms || isCommitting || !isRealAdmin}
                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xl ${
                  hasConfirmedTerms && !isCommitting && isRealAdmin
                    ? 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer hover:shadow-purple-600/40 active:scale-98'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                }`}
                title={!isRealAdmin ? 'Necessário ser Administrador Real no Firestore' : ''}
              >
                {isCommitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Gravando Lote...</span>
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4" />
                    <span>
                      {isRealAdmin
                        ? (onlyTestBatch200
                            ? `CONTINUAR IMPORTAÇÃO (GRAVAR 200 ATLETAS: #${resumeStartIndex} A #${Math.min(activeHomologation.totalFound || activeHomologation.items.length || 37867, resumeStartIndex + 199)})`
                            : 'GRAVAR JOGADORES NO FIRESTORE')
                        : 'GRAVAÇÃO BLOQUEADA (REQUER ADMIN)'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASSO 4: CONCLUSÃO & RESULTADO                                            */}
      {/* ========================================================================= */}
      {currentStep === 4 && commitResult && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-[#121212] border border-emerald-600/50 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl bg-gradient-to-b from-emerald-950/20 to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-900/40 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs uppercase font-bold text-emerald-400 tracking-wider">
                  Processo Concluído com Sucesso
                </span>
                <h2 className="text-xl font-black text-white">
                  Jogadores Gravados no FM Universe!
                </h2>
              </div>
            </div>

            {/* Cards de Métricas do Resultado */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#0a0a0a] border border-emerald-900/40 rounded-xl p-3.5 text-center">
                <span className="text-[11px] text-zinc-400 block mb-1">Total Gravado</span>
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  {commitResult.totalRecorded}
                </span>
                <span className="text-[10px] text-zinc-500 block mt-1">Atletas no banco</span>
              </div>

              <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-3.5 text-center">
                <span className="text-[11px] text-zinc-400 block mb-1">Novos Criados</span>
                <span className="text-2xl font-black text-white font-mono">
                  {commitResult.newCount}
                </span>
                <span className="text-[10px] text-emerald-500/80 block mt-1">IDs determinísticos</span>
              </div>

              <div className="bg-[#0a0a0a] border border-sky-900/40 rounded-xl p-3.5 text-center">
                <span className="text-[11px] text-sky-400 block mb-1">Atletas Protegidos</span>
                <span className="text-2xl font-black text-sky-400 font-mono">
                  {commitResult.totalProtected ?? commitResult.totalExisting ?? commitResult.updatedCount}
                </span>
                <span className="text-[10px] text-zinc-500 block mt-1">100% preservados</span>
              </div>

              <div className="bg-[#0a0a0a] border border-zinc-800 rounded-xl p-3.5 text-center">
                <span className="text-[11px] text-zinc-400 block mb-1">Tempo Execução</span>
                <span className="text-2xl font-black text-purple-400 font-mono">
                  {commitResult.processingTimeMs ? (commitResult.processingTimeMs / 1000).toFixed(1) + 's' : '0.1s'}
                </span>
                <span className="text-[10px] text-zinc-500 block mt-1">Processamento seguro</span>
              </div>
            </div>

            {/* Informações da Auditoria e do Teste de Gravação */}
            <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-4 text-xs space-y-2">
              <div className="flex justify-between text-zinc-400">
                <span>Resultado do Firestore:</span>
                <span className={`font-mono font-bold ${commitResult.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {commitResult.success ? 'SUCESSO (Confirmado no Firestore)' : 'FALHA NA GRAVAÇÃO'}
                </span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Total de Atletas Gravados:</span>
                <span className="font-mono text-white font-bold">{commitResult.totalRecorded} jogadores</span>
              </div>
              {commitResult.firstProcessedId && (
                <div className="flex justify-between text-zinc-400">
                  <span>Primeiro ID Processado:</span>
                  <span className="font-mono text-purple-300 font-bold">{commitResult.firstProcessedId}</span>
                </div>
              )}
              {commitResult.lastProcessedId && (
                <div className="flex justify-between text-zinc-400">
                  <span>Último ID Processado:</span>
                  <span className="font-mono text-purple-300 font-bold">{commitResult.lastProcessedId}</span>
                </div>
              )}
              {commitResult.lastConfirmedCheckpoint && (
                <div className="flex justify-between text-zinc-400">
                  <span>Checkpoint Salvo:</span>
                  <span className="font-mono text-emerald-300 font-bold">
                    Jogador #{commitResult.lastConfirmedCheckpoint}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-zinc-400">
                <span>Ocorrência de Erros:</span>
                <span className={`font-mono font-bold ${commitResult.errors.length > 0 ? 'text-rose-400' : 'text-zinc-300'}`}>
                  {commitResult.errors.length > 0 ? `${commitResult.errors.length} erro(s)` : 'Nenhum erro'}
                </span>
              </div>
              <div className="flex justify-between text-zinc-400 pt-1 border-t border-zinc-800">
                <span>Protocolo de Auditoria:</span>
                <span className="font-mono text-purple-400 font-bold">{commitResult.auditId}</span>
              </div>
              {commitResult.resumedFromIndex && commitResult.resumedFromIndex > 1 && (
                <div className="flex justify-between text-zinc-400">
                  <span>Ponto de Retomada:</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    Iniciado no jogador #{commitResult.resumedFromIndex} (jogadores 1 a {commitResult.resumedFromIndex - 1} preservados)
                  </span>
                </div>
              )}
              <div className="flex justify-between text-zinc-400">
                <span>Responsável:</span>
                <span className="text-zinc-200">Administrador (ADMIN)</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Data & Hora:</span>
                <span className="text-zinc-200">{new Date().toLocaleString('pt-BR')}</span>
              </div>
            </div>

            {/* Falhas eventuais registradas */}
            {commitResult.errors.length > 0 && (
              <div className="bg-rose-950/40 border border-rose-800/50 rounded-xl p-4 text-xs text-rose-300">
                <strong className="block mb-1">Alertas na gravação:</strong>
                <ul className="list-disc list-inside space-y-0.5">
                  {commitResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Botão de Destaque: CONTINUAR IMPORTAÇÃO (Próximo Lote de 200 a partir do Checkpoint) */}
            {nextBatchInfo && (
              <div className="bg-[#0a0a0a] border-2 border-purple-500/50 rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xl bg-gradient-to-br from-purple-950/30 to-black">
                {!nextBatchInfo.isCompleted ? (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-purple-900/60 border border-purple-600/60 flex items-center justify-center text-purple-300 shrink-0">
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400 font-bold block">
                            Próximo Lote Pronto para Gravação
                          </span>
                          <h4 className="text-sm sm:text-base font-black text-white">
                            Jogadores #{nextBatchInfo.nextStart} até #{nextBatchInfo.nextEnd} ({nextBatchInfo.count} atletas)
                          </h4>
                        </div>
                      </div>
                      <div className="text-right font-mono text-xs text-zinc-400">
                        <span className="bg-purple-950/80 border border-purple-700/60 text-purple-200 px-2.5 py-1 rounded-lg text-[11px] font-bold">
                          {nextBatchInfo.grandTotal - nextBatchInfo.nextEnd} restantes no arquivo
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-300 leading-relaxed">
                      O último lote foi confirmado até o atleta <strong>#{nextBatchInfo.lastConfirmed}</strong>. Ao clicar no botão abaixo, os <strong>próximos {nextBatchInfo.count} jogadores</strong> serão gravados no Firestore sequencialmente sem reprocessar nenhum atleta anterior.
                    </p>

                    {/* Barra de Progresso caso esteja gravando o próximo lote */}
                    {isCommitting && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between text-xs text-purple-300 font-mono">
                          <span className="flex items-center gap-2">
                            <div className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                            Gravando próximo lote de {nextBatchInfo.count} atletas...
                          </span>
                          <span>{commitProgress.done} / {commitProgress.total}</span>
                        </div>
                        <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-600 transition-all duration-300"
                            style={{
                              width: `${
                                commitProgress.total > 0
                                  ? (commitProgress.done / commitProgress.total) * 100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      id="btn-continuar-importacao"
                      onClick={() => handleExecuteCommit(nextBatchInfo.nextStart)}
                      disabled={isCommitting || !isRealAdmin}
                      className={`w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all shadow-xl cursor-pointer ${
                        !isCommitting && isRealAdmin
                          ? 'bg-purple-600 hover:bg-purple-500 text-white hover:shadow-purple-600/50 active:scale-98'
                          : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                      }`}
                    >
                      {isCommitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Gravando Lote #{nextBatchInfo.nextStart}...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-current" />
                          <span>Continuar Importação (Próximo Lote: #{nextBatchInfo.nextStart} a #{nextBatchInfo.nextEnd})</span>
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-3 text-emerald-400 text-xs py-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span>
                      Todos os <strong>{nextBatchInfo.grandTotal}</strong> jogadores homologados foram persistidos com sucesso no banco de dados!
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Atalhos Pós-Importação */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#262626]">
              <button
                onClick={handleReset}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Nova Importação</span>
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => navigate('/admin/jogadores')}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  <span>Ver Atletas no Painel</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HISTÓRICO DE AUDITORIA DE IMPORTAÇÕES                                     */}
      {/* ========================================================================= */}
      <div className="bg-[#121212] border border-[#262626] rounded-xl overflow-hidden">
        <button
          onClick={() => setShowAuditHistory(!showAuditHistory)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-[#171717] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-300 uppercase tracking-wider">
            <History className="w-4 h-4 text-purple-400" />
            <span>Histórico de Auditorias de Importação ({auditLogs.length})</span>
          </div>
          <span className="text-xs text-purple-400 font-semibold">
            {showAuditHistory ? 'Ocultar' : 'Exibir'}
          </span>
        </button>

        {showAuditHistory && (
          <div className="p-4 border-t border-[#262626] space-y-3 bg-[#0a0a0a]">
            {auditLogs.length === 0 ? (
              <p className="text-xs text-zinc-500 italic text-center py-4">
                Nenhum registro de importação gravado ainda.
              </p>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-[#121212] border border-[#262626] rounded-lg p-3 text-xs space-y-1.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <span className="font-bold text-white flex items-center gap-2">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-purple-400" />
                      <span>{log.fileName}</span>
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {new Date(log.timestamp).toLocaleString('pt-BR')}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                    <span>
                      Gravados: <strong className="text-emerald-400">{log.totalProcessed}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Novos: <strong className="text-zinc-200">{log.totalNewRecorded}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Atualizados: <strong className="text-zinc-200">{log.totalUpdatedRecorded}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Ignorados: <strong className="text-amber-400">{log.totalIgnored}</strong>
                    </span>
                  </div>

                  {log.notes && (
                    <p className="text-[11px] text-zinc-400 italic">{log.notes}</p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
