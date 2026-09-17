import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  Upload,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Trophy,
  Sparkles,
  Building,
  Shirt,
  Image as ImageIcon,
  Activity,
  Palette,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { validateImageFile, uploadClubAsset } from '../../services/storageService';
import { clubesService } from '../../services/clubesService';
import { managersService } from '../../services/managersService';

export const ManagerSetupPage: React.FC = () => {
  const {
    firebaseUser,
    managerProfile,
    refreshManagerProfile,
    refreshClubData,
    setManagedClubId,
  } = useAuth();
  const { navigate } = useNavigation();

  // Se já tiver onboardingCompleted, redireciona para o painel do clube
  useEffect(() => {
    if (managerProfile?.onboardingCompleted && managerProfile.clubId) {
      navigate('/manager');
    }
  }, [managerProfile, navigate]);

  // Se não estiver autenticado, redireciona para /login
  useEffect(() => {
    if (!firebaseUser) {
      navigate('/login');
    }
  }, [firebaseUser, navigate]);

  // Estados do Stepper (1 a 5)
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Etapa 1: Dados Básicos
  const [clubName, setClubName] = useState('Atlético Universe');
  const [clubCode, setClubCode] = useState('ATU');
  const [primaryColor, setPrimaryColor] = useState('#10b981'); // Verde FM
  const [secondaryColor, setSecondaryColor] = useState('#8b5cf6'); // Roxo FM

  // Etapa 2: Logo
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Etapa 3: Uniformes
  const [homeKitFile, setHomeKitFile] = useState<File | null>(null);
  const [homeKitPreview, setHomeKitPreview] = useState<string | null>(null);
  const [awayKitFile, setAwayKitFile] = useState<File | null>(null);
  const [awayKitPreview, setAwayKitPreview] = useState<string | null>(null);

  // Etapa 4: Estádio
  const [stadiumName, setStadiumName] = useState('Arena Universe');
  const [stadiumCapacity, setStadiumCapacity] = useState<number>(45000);
  const [stadiumFile, setStadiumFile] = useState<File | null>(null);
  const [stadiumPreview, setStadiumPreview] = useState<string | null>(null);

  // Estados de Processamento e Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgressStatus, setUploadProgressStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Handlers de Arquivo com Validação
  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setterFile: (f: File | null) => void,
    setterPreview: (p: string | null) => void
  ) => {
    setErrorMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Arquivo inválido.');
      return;
    }

    setterFile(file);
    setterPreview(URL.createObjectURL(file));
  };

  // Navegação entre etapas
  const handleNextStep = () => {
    setErrorMessage(null);

    if (step === 1) {
      if (!clubName.trim() || clubName.trim().length < 3) {
        setErrorMessage('Por favor, informe um nome para o clube com no mínimo 3 caracteres.');
        return;
      }
      if (!clubCode.trim()) {
        setErrorMessage('Por favor, informe a sigla do clube.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      if (!stadiumName.trim() || stadiumName.trim().length < 3) {
        setErrorMessage('Por favor, informe o nome do estádio.');
        return;
      }
      setStep(5);
    }
  };

  const handlePrevStep = () => {
    setErrorMessage(null);
    if (step > 1) {
      setStep((step - 1) as 1 | 2 | 3 | 4 | 5);
    }
  };

  // Criação Definitiva do Clube
  const handleCreateClub = async () => {
    if (!firebaseUser) return;
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const uid = firebaseUser.uid;
      const managerName = managerProfile?.name || firebaseUser.displayName || 'Treinador';

      // 1. Processamento e upload de assets visuais
      let logoUrl = '';
      let homeKitUrl = '';
      let awayKitUrl = '';
      let stadiumImageUrl = '';

      if (logoFile) {
        setUploadProgressStatus('Processando e enviando escudo do clube...');
        logoUrl = await uploadClubAsset(uid, logoFile, 'logo');
      }

      if (homeKitFile) {
        setUploadProgressStatus('Processando e enviando uniforme titular...');
        homeKitUrl = await uploadClubAsset(uid, homeKitFile, 'kit-home');
      }

      if (awayKitFile) {
        setUploadProgressStatus('Processando e enviando uniforme visitante...');
        awayKitUrl = await uploadClubAsset(uid, awayKitFile, 'kit-away');
      }

      if (stadiumFile) {
        setUploadProgressStatus('Processando e enviando imagem do estádio...');
        stadiumImageUrl = await uploadClubAsset(uid, stadiumFile, 'stadium');
      }

      // 2. Criação do documento /clubes/{clubId}
      setUploadProgressStatus('Registrando dados oficiais do clube no Firestore...');
      const createdClub = await clubesService.createManagerClub(uid, managerName, {
        name: clubName.trim(),
        code: clubCode.trim().toUpperCase(),
        logoUrl: logoUrl || logoPreview || '',
        homeKitUrl: homeKitUrl || homeKitPreview || '',
        awayKitUrl: awayKitUrl || awayKitPreview || '',
        stadiumName: stadiumName.trim(),
        stadiumImageUrl: stadiumImageUrl || stadiumPreview || '',
        primaryColor,
        secondaryColor,
        capacity: stadiumCapacity,
      });

      // 3. Vinculação atômica consistente: manager.clubId = clubId & onboardingCompleted = true
      setUploadProgressStatus('Concluindo vinculação do treinador ao clube...');
      await managersService.completeOnboarding(uid, createdClub.id);

      // 4. Sincroniza AuthContext
      setUploadProgressStatus('Sincronizando perfil e vestiário...');
      await refreshManagerProfile();
      await refreshClubData();
      setManagedClubId(createdClub.id);

      setIsSuccess(true);
      setUploadProgressStatus('Clube fundado com sucesso! Redirecionando para o vestiário...');

      setTimeout(() => {
        navigate('/manager');
      }, 1000);
    } catch (err: unknown) {
      console.error('Erro ao criar clube do manager:', err);
      const msg = err instanceof Error ? err.message : 'Falha ao criar clube. Tente novamente.';
      setErrorMessage(msg);
      setUploadProgressStatus('');
      setIsSubmitting(false);
    }
  };

  const stepsList = [
    { num: 1, title: 'Conta & Básico', icon: Building },
    { num: 2, title: 'Identidade', icon: Trophy },
    { num: 3, title: 'Uniformes', icon: Shirt },
    { num: 4, title: 'Estádio', icon: ImageIcon },
    { num: 5, title: 'Finalizar', icon: Sparkles },
  ];

  return (
    <div className="min-h-[88vh] flex flex-col items-center justify-center p-4 py-8">
      <div className="w-full max-w-3xl bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-10 shadow-2xl backdrop-blur-md">
        {/* Cabeçalho Principal */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Primeiro Acesso de Treinador</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">
            Vamos criar o seu clube
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
            Defina a identidade visual, uniformes e o estádio oficial da sua nova equipe no FM Universe.
          </p>
        </div>

        {/* Barra de Progresso / Stepper */}
        <div className="grid grid-cols-5 gap-2 mb-8">
          {stepsList.map((s) => {
            const Icon = s.icon;
            const isActive = step === s.num;
            const isDone = step > s.num;

            return (
              <div key={s.num} className="flex flex-col items-center text-center">
                <div
                  className={`w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center transition-all ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/60 ring-2 ring-emerald-400'
                      : isDone
                      ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-400'
                      : 'bg-slate-950 border border-slate-800 text-slate-500'
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Icon className="w-4 h-4 md:w-5 md:h-5" />
                  )}
                </div>
                <span
                  className={`text-[10px] md:text-xs font-semibold mt-1.5 line-clamp-1 ${
                    isActive ? 'text-emerald-400' : isDone ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  {s.title}
                </span>
              </div>
            );
          })}
        </div>

        {/* Mensagem de Erro */}
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </motion.div>
        )}

        {/* Conteúdo da Etapa */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6 md:p-8 mb-8">
          <AnimatePresence mode="wait">
            {/* ETAPA 1: CONTA & BÁSICO */}
            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-5"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Building className="w-4 h-4 text-emerald-400" />
                    <span>1. Informações Básicas do Clube</span>
                  </h2>
                  <span className="text-xs text-slate-400 font-mono">
                    Manager: {managerProfile?.name || firebaseUser?.displayName || 'Treinador'}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                    Nome do Clube
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Atlético Universe, FC Nova Era, Sporting Club..."
                    value={clubName}
                    onChange={(e) => {
                      setClubName(e.target.value);
                      if (!clubCode || clubCode.length <= 3) {
                        const autoCode = e.target.value
                          .replace(/[^A-Za-z]/g, '')
                          .slice(0, 3)
                          .toUpperCase();
                        if (autoCode) setClubCode(autoCode);
                      }
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Este será o nome exibido na tabela, elenco, partidas e troféus.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                      Sigla / Código (3 letras)
                    </label>
                    <input
                      type="text"
                      maxLength={3}
                      value={clubCode}
                      onChange={(e) => setClubCode(e.target.value.toUpperCase())}
                      className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono uppercase text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Cor Primária</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-10 h-11 rounded-lg bg-transparent border-0 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono text-xs uppercase"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-purple-400" />
                      <span>Cor Secundária</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        className="w-10 h-11 rounded-lg bg-transparent border-0 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono text-xs uppercase"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ETAPA 2: IDENTIDADE DO CLUBE (ESCUDO / LOGO) */}
            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-5"
              >
                <div className="pb-3 border-b border-slate-800">
                  <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-emerald-400" />
                    <span>2. Identidade Visual do Clube</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Envie o escudo oficial do seu time (PNG, JPG, JPEG ou WEBP até 5MB).
                  </p>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-6 p-4 rounded-xl bg-slate-900 border border-slate-800">
                  {/* Visualizador do Preview */}
                  <div className="w-32 h-32 rounded-2xl bg-slate-950 border-2 border-dashed border-slate-700 flex flex-col items-center justify-center overflow-hidden shrink-0 relative group">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Escudo do Clube"
                        className="w-full h-full object-contain p-2"
                      />
                    ) : (
                      <div className="text-center p-3 text-slate-500">
                        <Shield className="w-8 h-8 mx-auto mb-1 opacity-50" />
                        <span className="text-[10px] uppercase font-bold">Sem Escudo</span>
                      </div>
                    )}
                  </div>

                  {/* Input de Upload */}
                  <div className="flex-1 space-y-3 text-center md:text-left">
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                        Upload do Escudo
                      </h3>
                      <p className="text-xs text-slate-400">
                        Recomendado: imagem quadrada com fundo transparente para melhor destaque na UI do jogo.
                      </p>
                    </div>

                    <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider cursor-pointer transition-all shadow-md">
                      <Upload className="w-4 h-4" />
                      <span>Selecionar Arquivo</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={(e) => handleFileChange(e, setLogoFile, setLogoPreview)}
                        className="hidden"
                      />
                    </label>

                    {logoFile && (
                      <p className="text-xs text-emerald-400 font-mono">
                        ✓ {logoFile.name} ({(logoFile.size / 1024).toFixed(0)} KB)
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ETAPA 3: UNIFORMES */}
            {step === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-5"
              >
                <div className="pb-3 border-b border-slate-800">
                  <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Shirt className="w-4 h-4 text-emerald-400" />
                    <span>3. Uniformes do Clube</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Personalize os kits oficiais titular (mandante) e visitante da sua temporada.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Uniforme Mandante */}
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                        Uniforme Mandante (Home)
                      </span>
                    </div>

                    <div className="h-36 rounded-xl bg-slate-950 border border-dashed border-slate-800 flex items-center justify-center overflow-hidden">
                      {homeKitPreview ? (
                        <img
                          src={homeKitPreview}
                          alt="Uniforme Mandante"
                          className="h-full object-contain p-2"
                        />
                      ) : (
                        <div className="text-center text-slate-500">
                          <Shirt className="w-8 h-8 mx-auto mb-1 opacity-40" />
                          <span className="text-[10px] uppercase">Kit Mandante</span>
                        </div>
                      )}
                    </div>

                    <label className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold uppercase tracking-wider cursor-pointer transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{homeKitFile ? 'Alterar Kit Titular' : 'Enviar Kit Titular'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={(e) => handleFileChange(e, setHomeKitFile, setHomeKitPreview)}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Uniforme Visitante */}
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                        Uniforme Visitante (Away)
                      </span>
                    </div>

                    <div className="h-36 rounded-xl bg-slate-950 border border-dashed border-slate-800 flex items-center justify-center overflow-hidden">
                      {awayKitPreview ? (
                        <img
                          src={awayKitPreview}
                          alt="Uniforme Visitante"
                          className="h-full object-contain p-2"
                        />
                      ) : (
                        <div className="text-center text-slate-500">
                          <Shirt className="w-8 h-8 mx-auto mb-1 opacity-40" />
                          <span className="text-[10px] uppercase">Kit Visitante</span>
                        </div>
                      )}
                    </div>

                    <label className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold uppercase tracking-wider cursor-pointer transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{awayKitFile ? 'Alterar Kit Visitante' : 'Enviar Kit Visitante'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={(e) => handleFileChange(e, setAwayKitFile, setAwayKitPreview)}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ETAPA 4: ESTÁDIO */}
            {step === 4 && (
              <motion.div
                key="step-4"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-5"
              >
                <div className="pb-3 border-b border-slate-800">
                  <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Building className="w-4 h-4 text-emerald-400" />
                    <span>4. A Casa do Seu Time (Estádio)</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Defina onde seu clube mandará seus jogos oficiais.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                      Nome do Estádio
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Arena Universe, Estádio das Estrelas..."
                      value={stadiumName}
                      onChange={(e) => setStadiumName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                      Capacidade de Público
                    </label>
                    <input
                      type="number"
                      min={5000}
                      max={120000}
                      step={1000}
                      value={stadiumCapacity}
                      onChange={(e) => setStadiumCapacity(Number(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Foto ou Render do Estádio
                  </span>

                  <div className="h-40 rounded-xl bg-slate-950 border border-dashed border-slate-800 flex items-center justify-center overflow-hidden">
                    {stadiumPreview ? (
                      <img
                        src={stadiumPreview}
                        alt="Foto do Estádio"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center text-slate-500">
                        <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-40" />
                        <span className="text-[10px] uppercase">Foto do Estádio</span>
                      </div>
                    )}
                  </div>

                  <label className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold uppercase tracking-wider cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{stadiumFile ? 'Alterar Foto do Estádio' : 'Enviar Foto do Estádio'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={(e) => handleFileChange(e, setStadiumFile, setStadiumPreview)}
                      className="hidden"
                    />
                  </label>
                </div>
              </motion.div>
            )}

            {/* ETAPA 5: FINALIZAR & REVISÃO */}
            {step === 5 && (
              <motion.div
                key="step-5"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="pb-3 border-b border-slate-800 text-center">
                  <h2 className="text-lg font-black text-white uppercase tracking-wider">
                    5. Resumo do Clube
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Confira todos os dados antes de oficializar a fundação da sua equipe.
                  </p>
                </div>

                {/* Card Apresentação do Clube estilo FM */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-xl space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                      {logoPreview ? (
                        <img
                          src={logoPreview}
                          alt={clubName}
                          className="w-full h-full object-contain p-1.5"
                        />
                      ) : (
                        <Shield className="w-8 h-8 text-emerald-400" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-wide">
                        {clubName}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono font-bold text-emerald-400">
                          {clubCode}
                        </span>
                        <span className="text-xs text-slate-400">
                          Treinador: {managerProfile?.name || firebaseUser?.displayName || 'Treinador'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Estádio</span>
                      <span className="font-semibold text-slate-200">{stadiumName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Capacidade</span>
                      <span className="font-semibold text-slate-200">
                        {stadiumCapacity.toLocaleString('pt-BR')} lugares
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Orçamento Inicial</span>
                      <span className="font-semibold text-emerald-400">€ 45.000.000</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Divisão</span>
                      <span className="font-semibold text-purple-400">Primeira Divisão</span>
                    </div>
                  </div>
                </div>

                {isSubmitting && (
                  <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-center gap-3">
                    <Activity className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>{uploadProgressStatus}</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Barra de Ações / Navegação do Stepper */}
        <div className="flex items-center justify-between pt-2">
          {step > 1 ? (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handlePrevStep}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>
          ) : (
            <div />
          )}

          {step < 5 ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-emerald-950/40 cursor-pointer"
            >
              <span>Avançar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmitting || isSuccess}
              onClick={handleCreateClub}
              className="py-3.5 px-8 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-black text-sm uppercase tracking-wider flex items-center gap-2 transition-all shadow-xl shadow-emerald-950/50 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Activity className="w-4 h-4 animate-spin" />
                  <span>Processando Fundação...</span>
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Clube Criado com Sucesso!</span>
                </>
              ) : (
                <>
                  <Trophy className="w-4 h-4" />
                  <span>CRIAR MEU CLUBE</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
