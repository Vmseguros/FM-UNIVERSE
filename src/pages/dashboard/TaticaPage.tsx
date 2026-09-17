import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { jogadoresService } from '../../services/jogadoresService';
import { taticasService } from '../../services/taticasService';
import { dataStore } from '../../services/dataStore';
import { Player, TacticalSlot, TacticSetup } from '../../types';
import { FootballPitch } from '../../components/common/FootballPitch';
import { PositionBadge } from '../../components/common/Badge';
import {
  Crosshair,
  Sliders,
  CheckCircle2,
  ArrowLeftRight,
  X,
  RotateCcw,
  AlertCircle,
  Users,
  ShieldCheck,
  Loader2,
} from 'lucide-react';

interface SubstitutionRecord {
  slotId: string;
  slotLabel: string;
  slotPositionName: string;
  outPlayer: Player;
  inPlayer: Player;
  timestamp: number;
}

// Position compatibility calculation
interface PositionFit {
  isCompatible: boolean;
  isExact: boolean;
  fitLevel: 'IDEAL' | 'ADAPTADO' | 'IMPROVISADO';
  description: string;
}

export const checkPositionFit = (
  player: Player,
  slot: { positionName: string; label: string }
): PositionFit => {
  const pPos = (player.position || '').toUpperCase();
  const pCat = (player.positionCategory || '').toUpperCase();
  const sPos = (slot.positionName || '').toUpperCase();

  // Goalkeeper slot
  if (sPos === 'GOL' || sPos === 'GK') {
    if (pPos === 'GK' || pPos === 'GOL' || pCat === 'GOLEIRO') {
      return { isCompatible: true, isExact: true, fitLevel: 'IDEAL', description: 'Posição Natural' };
    }
    return { isCompatible: false, isExact: false, fitLevel: 'IMPROVISADO', description: 'Improvisado no Gol' };
  }

  // If player is a Goalkeeper, they shouldn't play outfield
  if (pPos === 'GK' || pPos === 'GOL' || pCat === 'GOLEIRO') {
    return { isCompatible: false, isExact: false, fitLevel: 'IMPROVISADO', description: 'Goleiro na Linha' };
  }

  // Exact position matches
  const exactMap: Record<string, string[]> = {
    ZAG: ['ZAG', 'CB'],
    LE: ['LE', 'LB', 'LWB'],
    LD: ['LD', 'RB', 'RWB'],
    VOL: ['VOL', 'CDM'],
    MC: ['MC', 'CM'],
    MEI: ['MEI', 'CAM', 'AM'],
    PE: ['PE', 'LW', 'LM', 'ME'],
    PD: ['PD', 'RW', 'RM', 'MD'],
    ME: ['ME', 'LM', 'PE', 'LW'],
    MD: ['MD', 'RM', 'PD', 'RW'],
    ATA: ['ATA', 'ST', 'CF', 'CA', 'SA'],
  };

  const exacts = exactMap[sPos] || [sPos];
  if (exacts.includes(pPos)) {
    return { isCompatible: true, isExact: true, fitLevel: 'IDEAL', description: 'Posição Natural' };
  }

  // Defesa
  if (['ZAG', 'LE', 'LD'].includes(sPos)) {
    if (pCat === 'DEFENSOR' || ['CB', 'LB', 'RB', 'ZAG', 'LE', 'LD', 'LWB', 'RWB'].includes(pPos)) {
      return { isCompatible: true, isExact: false, fitLevel: 'ADAPTADO', description: 'Adaptado na Defesa' };
    }
    if (['VOL', 'CDM'].includes(pPos)) {
      return { isCompatible: true, isExact: false, fitLevel: 'ADAPTADO', description: 'Volante Recuado' };
    }
  }

  // Meio-Campo
  if (['VOL', 'MC', 'MEI', 'ME', 'MD'].includes(sPos)) {
    if (
      pCat === 'MEIO-CAMPISTA' ||
      ['CDM', 'CM', 'CAM', 'LM', 'RM', 'VOL', 'MC', 'MEI', 'ME', 'MD'].includes(pPos)
    ) {
      return { isCompatible: true, isExact: false, fitLevel: 'ADAPTADO', description: 'Adaptado no Meio' };
    }
    if (['LW', 'RW', 'PE', 'PD'].includes(pPos) && ['ME', 'MD', 'MEI'].includes(sPos)) {
      return { isCompatible: true, isExact: false, fitLevel: 'ADAPTADO', description: 'Ponta Recuado' };
    }
  }

  // Ataque
  if (['ATA', 'PE', 'PD'].includes(sPos)) {
    if (pCat === 'ATACANTE' || ['ST', 'CF', 'LW', 'RW', 'ATA', 'PE', 'PD', 'CA', 'SA'].includes(pPos)) {
      return { isCompatible: true, isExact: false, fitLevel: 'ADAPTADO', description: 'Adaptado no Ataque' };
    }
    if (['MEI', 'CAM'].includes(pPos)) {
      return { isCompatible: true, isExact: false, fitLevel: 'ADAPTADO', description: 'Meia Avançado' };
    }
  }

  return { isCompatible: false, isExact: false, fitLevel: 'IMPROVISADO', description: 'Fora de Posição' };
};

// Formation slot definitions
const getFormationSlotsDefinition = (fmt: string): Omit<TacticalSlot, 'player'>[] => {
  if (fmt === '4-3-3') {
    return [
      { id: 'gk', positionName: 'GOL', label: 'GOL', x: 50, y: 88, defaultRole: 'GK' },
      { id: 'lb', positionName: 'LE', label: 'LE', x: 16, y: 70, defaultRole: 'LB' },
      { id: 'cb1', positionName: 'ZAG', label: 'ZAG', x: 38, y: 72, defaultRole: 'CB' },
      { id: 'cb2', positionName: 'ZAG', label: 'ZAG', x: 62, y: 72, defaultRole: 'CB' },
      { id: 'rb', positionName: 'LD', label: 'LD', x: 84, y: 70, defaultRole: 'RB' },
      { id: 'dm', positionName: 'VOL', label: 'VOL', x: 50, y: 53, defaultRole: 'CDM' },
      { id: 'cm1', positionName: 'MC', label: 'MC', x: 32, y: 44, defaultRole: 'CM' },
      { id: 'cm2', positionName: 'MC', label: 'MEI', x: 68, y: 44, defaultRole: 'CAM' },
      { id: 'lw', positionName: 'PE', label: 'PE', x: 20, y: 22, defaultRole: 'LW' },
      { id: 'st', positionName: 'ATA', label: 'CA', x: 50, y: 16, defaultRole: 'ST' },
      { id: 'rw', positionName: 'PD', label: 'PD', x: 80, y: 22, defaultRole: 'RW' },
    ];
  } else if (fmt === '4-2-3-1') {
    return [
      { id: 'gk', positionName: 'GOL', label: 'GOL', x: 50, y: 88, defaultRole: 'GK' },
      { id: 'lb', positionName: 'LE', label: 'LE', x: 16, y: 70, defaultRole: 'LB' },
      { id: 'cb1', positionName: 'ZAG', label: 'ZAG', x: 38, y: 72, defaultRole: 'CB' },
      { id: 'cb2', positionName: 'ZAG', label: 'ZAG', x: 62, y: 72, defaultRole: 'CB' },
      { id: 'rb', positionName: 'LD', label: 'LD', x: 84, y: 70, defaultRole: 'RB' },
      { id: 'dm1', positionName: 'VOL', label: 'VOL', x: 38, y: 55, defaultRole: 'CDM' },
      { id: 'dm2', positionName: 'VOL', label: 'VOL', x: 62, y: 55, defaultRole: 'CDM' },
      { id: 'am', positionName: 'MEI', label: 'MEI', x: 50, y: 35, defaultRole: 'CAM' },
      { id: 'lw', positionName: 'PE', label: 'ME', x: 18, y: 35, defaultRole: 'LM' },
      { id: 'rw', positionName: 'PD', label: 'MD', x: 82, y: 35, defaultRole: 'RM' },
      { id: 'st', positionName: 'ATA', label: 'CA', x: 50, y: 15, defaultRole: 'ST' },
    ];
  } else if (fmt === '3-5-2') {
    return [
      { id: 'gk', positionName: 'GOL', label: 'GOL', x: 50, y: 88, defaultRole: 'GK' },
      { id: 'cb1', positionName: 'ZAG', label: 'ZAG', x: 28, y: 72, defaultRole: 'CB' },
      { id: 'cb2', positionName: 'ZAG', label: 'LIB', x: 50, y: 74, defaultRole: 'CB' },
      { id: 'cb3', positionName: 'ZAG', label: 'ZAG', x: 72, y: 72, defaultRole: 'CB' },
      { id: 'lwb', positionName: 'LE', label: 'ALA', x: 12, y: 48, defaultRole: 'LWB' },
      { id: 'dm', positionName: 'VOL', label: 'VOL', x: 50, y: 56, defaultRole: 'CDM' },
      { id: 'cm1', positionName: 'MC', label: 'MC', x: 34, y: 44, defaultRole: 'CM' },
      { id: 'cm2', positionName: 'MC', label: 'MC', x: 66, y: 44, defaultRole: 'CM' },
      { id: 'rwb', positionName: 'LD', label: 'ALA', x: 88, y: 48, defaultRole: 'RWB' },
      { id: 'st1', positionName: 'ATA', label: 'CA', x: 38, y: 18, defaultRole: 'ST' },
      { id: 'st2', positionName: 'ATA', label: 'SA', x: 62, y: 18, defaultRole: 'ST' },
    ];
  } else {
    // 4-4-2
    return [
      { id: 'gk', positionName: 'GOL', label: 'GOL', x: 50, y: 88, defaultRole: 'GK' },
      { id: 'lb', positionName: 'LE', label: 'LE', x: 16, y: 70, defaultRole: 'LB' },
      { id: 'cb1', positionName: 'ZAG', label: 'ZAG', x: 38, y: 72, defaultRole: 'CB' },
      { id: 'cb2', positionName: 'ZAG', label: 'ZAG', x: 62, y: 72, defaultRole: 'CB' },
      { id: 'rb', positionName: 'LD', label: 'LD', x: 84, y: 70, defaultRole: 'RB' },
      { id: 'lm', positionName: 'ME', label: 'ME', x: 18, y: 45, defaultRole: 'LM' },
      { id: 'cm1', positionName: 'MC', label: 'MC', x: 40, y: 48, defaultRole: 'CM' },
      { id: 'cm2', positionName: 'MC', label: 'MC', x: 60, y: 48, defaultRole: 'CM' },
      { id: 'rm', positionName: 'MD', label: 'MD', x: 82, y: 45, defaultRole: 'RM' },
      { id: 'st1', positionName: 'ATA', label: 'CA', x: 38, y: 18, defaultRole: 'ST' },
      { id: 'st2', positionName: 'ATA', label: 'CA', x: 62, y: 18, defaultRole: 'ST' },
    ];
  }
};

// Intelligently assign unique players to slots without duplicate assignments
const assignPlayersToSlots = (
  slotDefs: Omit<TacticalSlot, 'player'>[],
  allPlayers: Player[],
  preferredPlayers?: (Player | null | undefined)[]
): TacticalSlot[] => {
  const pool = [...allPlayers];
  const assigned: TacticalSlot[] = [];
  const usedPlayerIds = new Set<string>();

  // Filter candidates already starting
  const candidatePool =
    preferredPlayers?.filter((p): p is Player => !!p && pool.some((ap) => ap.id === p.id)) || [];

  // Sort pool by overall descending
  const sortedPool = [...pool].sort((a, b) => b.overall - a.overall);

  for (const slot of slotDefs) {
    // 1. Candidate with exact match
    let chosen = candidatePool.find(
      (p) => !usedPlayerIds.has(p.id) && checkPositionFit(p, slot).isExact
    );

    // 2. Candidate with compatible match
    if (!chosen) {
      chosen = candidatePool.find(
        (p) => !usedPlayerIds.has(p.id) && checkPositionFit(p, slot).isCompatible
      );
    }

    // 3. Pool with exact match
    if (!chosen) {
      chosen = sortedPool.find(
        (p) => !usedPlayerIds.has(p.id) && checkPositionFit(p, slot).isExact
      );
    }

    // 4. Pool with compatible match
    if (!chosen) {
      chosen = sortedPool.find(
        (p) => !usedPlayerIds.has(p.id) && checkPositionFit(p, slot).isCompatible
      );
    }

    // 5. Fallback non-GK for outfield / GK for goalkeeper
    if (!chosen) {
      chosen = sortedPool.find(
        (p) =>
          !usedPlayerIds.has(p.id) &&
          (slot.positionName === 'GOL'
            ? p.position === 'GK' || p.position === 'GOL'
            : p.position !== 'GK' && p.position !== 'GOL')
      );
    }

    // 6. Absolute fallback
    if (!chosen) {
      chosen = sortedPool.find((p) => !usedPlayerIds.has(p.id));
    }

    if (chosen) {
      usedPlayerIds.add(chosen.id);
    }

    assigned.push({
      ...slot,
      player: chosen || null,
      assignedPlayerId: chosen?.id,
    });
  }

  return assigned;
};

// Helper normalizers to map persistent strings into strict UI state
const normalizeMentality = (
  val: string | undefined
): 'OFENSIVA' | 'EQUILIBRADA' | 'DEFENSIVA' | 'CONTRA-ATAQUE' => {
  if (!val) return 'EQUILIBRADA';
  const upper = val.toUpperCase();
  if (upper.includes('OFENSIV')) return 'OFENSIVA';
  if (upper.includes('DEFENSIV')) return 'DEFENSIVA';
  if (upper.includes('CONTRA') || upper.includes('CAUTELOS')) return 'CONTRA-ATAQUE';
  return 'EQUILIBRADA';
};

const normalizePressing = (val: string | undefined): 'ALTA' | 'MODERADA' | 'BAIXA' => {
  if (!val) return 'MODERADA';
  const upper = val.toUpperCase();
  if (upper.includes('ALT') || upper.includes('INTENS')) return 'ALTA';
  if (upper.includes('BAIX')) return 'BAIXA';
  return 'MODERADA';
};

const normalizePassingStyle = (val: string | undefined): 'CURTO' | 'DIRETO' | 'MISTO' => {
  if (!val) return 'CURTO';
  const upper = val.toUpperCase();
  if (upper.includes('DIRET')) return 'DIRETO';
  if (upper.includes('MIST')) return 'MISTO';
  return 'CURTO';
};

const normalizeFormation = (
  val: string | undefined
): '4-3-3' | '4-2-3-1' | '3-5-2' | '4-4-2' => {
  if (val === '4-2-3-1' || val === '3-5-2' || val === '4-4-2' || val === '4-3-3') {
    return val;
  }
  return '4-3-3';
};

export const TaticaPage: React.FC = () => {
  const { managedClub } = useAuth();
  const [squad, setSquad] = useState<Player[]>([]);
  const [formation, setFormation] = useState<'4-3-3' | '4-2-3-1' | '3-5-2' | '4-4-2'>('4-3-3');
  const [tacticalSlots, setTacticalSlots] = useState<TacticalSlot[]>([]);
  const [initialSlots, setInitialSlots] = useState<TacticalSlot[]>([]);
  const [benchPlayers, setBenchPlayers] = useState<Player[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TacticalSlot | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [subFilter, setSubFilter] = useState<'RECOMMENDED' | 'ALL'>('RECOMMENDED');
  const [subHistory, setSubHistory] = useState<SubstitutionRecord[]>([]);

  // Tactical instructions
  const [mentality, setMentality] = useState<'OFENSIVA' | 'EQUILIBRADA' | 'DEFENSIVA' | 'CONTRA-ATAQUE'>('EQUILIBRADA');
  const [pressing, setPressing] = useState<'ALTA' | 'MODERADA' | 'BAIXA'>('MODERADA');
  const [passingStyle, setPassingStyle] = useState<'CURTO' | 'DIRETO' | 'MISTO'>('CURTO');
  
  // Status and feedback states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  // Load squad and persistent tactical setup (Firestore / local cache)
  useEffect(() => {
    let isMounted = true;

    async function loadTacticalData() {
      if (!managedClub) return;

      setIsLoading(true);
      setErrorMessage(null);

      try {
        // Fetch club squad and persistent tactic
        const [players, savedTactic] = await Promise.all([
          jogadoresService.getByClubId(managedClub.id),
          taticasService.getByClubId(managedClub.id),
        ]);

        if (!isMounted) return;

        setSquad(players);

        // 1. Restore formation and tactical instructions
        const activeFormation = savedTactic?.formation
          ? normalizeFormation(savedTactic.formation)
          : '4-3-3';
        setFormation(activeFormation);

        if (savedTactic) {
          setMentality(normalizeMentality(savedTactic.mentality));
          setPressing(normalizePressing(savedTactic.pressingIntensity));
          setPassingStyle(normalizePassingStyle(savedTactic.passingStyle));
        }

        // 2. Restore starting lineup (slots)
        const slotDefs = getFormationSlotsDefinition(activeFormation);
        let initial: TacticalSlot[];

        if (savedTactic && savedTactic.slots && savedTactic.slots.length === 11) {
          const savedIds = savedTactic.slots
            .map((s) => s.assignedPlayerId)
            .filter(Boolean) as string[];
          const uniqueSavedIds = new Set(savedIds);

          if (uniqueSavedIds.size === 11) {
            initial = slotDefs.map((def, idx) => {
              const savedSlot = savedTactic.slots[idx];
              const p = players.find((pl) => pl.id === savedSlot?.assignedPlayerId);
              return {
                ...def,
                player: p || null,
                assignedPlayerId: p?.id,
              };
            });
          } else {
            initial = assignPlayersToSlots(slotDefs, players);
          }
        } else {
          initial = assignPlayersToSlots(slotDefs, players);
        }

        setTacticalSlots(initial);
        setInitialSlots(initial);

        // 3. Bench = squad members not in starting 11, respecting saved substitutes order if present
        const starterIds = new Set(initial.map((s) => s.player?.id).filter(Boolean) as string[]);
        
        let initialBench: Player[] = [];
        if (savedTactic?.substitutes && savedTactic.substitutes.length > 0) {
          const savedBenchIds = new Set(savedTactic.substitutes);
          const savedBenchPlayers = savedTactic.substitutes
            .map((id) => players.find((p) => p.id === id))
            .filter((p): p is Player => p !== undefined && !starterIds.has(p.id));

          const otherBenchPlayers = players.filter(
            (p) => !starterIds.has(p.id) && !savedBenchIds.has(p.id)
          );
          initialBench = [...savedBenchPlayers, ...otherBenchPlayers];
        } else {
          initialBench = players.filter((p) => !starterIds.has(p.id));
        }

        setBenchPlayers(initialBench);
        setSubHistory([]);
      } catch (err: any) {
        console.error('Erro ao carregar dados táticos:', err);
        if (isMounted) {
          setErrorMessage('Aviso: Não foi possível sincronizar com o servidor tático. Dados locais ativos.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadTacticalData();

    return () => {
      isMounted = false;
    };
  }, [managedClub]);

  // Handle formation changes, keeping currently assigned players
  const handleFormationChange = (newFmt: '4-3-3' | '4-2-3-1' | '3-5-2' | '4-4-2') => {
    setFormation(newFmt);
    const slotDefs = getFormationSlotsDefinition(newFmt);
    const currentStarters = tacticalSlots
      .map((s) => s.player)
      .filter((p): p is Player => p !== null && p !== undefined);

    const newSlots = assignPlayersToSlots(slotDefs, squad, currentStarters);
    setTacticalSlots(newSlots);

    const starterIds = new Set(newSlots.map((s) => s.player?.id).filter(Boolean) as string[]);
    const newBench = squad.filter((p) => !starterIds.has(p.id));
    setBenchPlayers(newBench);

    setSelectedSlot(null);
    setIsModalOpen(false);
  };

  // Keep bench and starters in guaranteed synchronization to prevent any lost/duplicated player
  useEffect(() => {
    if (squad.length > 0 && tacticalSlots.length === 11) {
      const activeStarterIds = new Set(
        tacticalSlots.map((s) => s.player?.id).filter(Boolean) as string[]
      );

      setBenchPlayers((prevBench) => {
        // Remove any starter currently in the starting 11
        const cleanedBench = prevBench.filter((p) => !activeStarterIds.has(p.id));
        const currentBenchIds = new Set(cleanedBench.map((p) => p.id));

        // Add any player from squad that is neither starting nor on the bench
        let hasChanges = cleanedBench.length !== prevBench.length;
        const missingPlayers = squad.filter(
          (p) => !activeStarterIds.has(p.id) && !currentBenchIds.has(p.id)
        );

        if (missingPlayers.length > 0) {
          hasChanges = true;
          return [...cleanedBench, ...missingPlayers];
        }

        return hasChanges ? cleanedBench : prevBench;
      });
    }
  }, [tacticalSlots, squad]);

  // When a slot on the pitch is clicked
  const handleSlotClick = (slot: TacticalSlot) => {
    setSelectedSlot(slot);
    setSubFilter('RECOMMENDED');
    setIsModalOpen(true);
  };

  // Authoritative substitution function (Atomic, ID-based, Functional state update)
  const executeSubstitution = (incomingPlayer: Player, targetSlot: TacticalSlot) => {
    if (!targetSlot || !incomingPlayer || !incomingPlayer.id) return;

    let resolvedOutgoingPlayer: Player | null = null;

    // 1. Functional atomic update on starters (tacticalSlots)
    setTacticalSlots((prevSlots) => {
      // Find the specific slot being modified by its unique slot ID
      const slotIndex = prevSlots.findIndex((s) => s.id === targetSlot.id);
      if (slotIndex === -1) return prevSlots;

      const currentSlot = prevSlots[slotIndex];
      // Identify the exact outgoing player currently sitting in this slot (avoids stale state)
      resolvedOutgoingPlayer = currentSlot.player || targetSlot.player || null;

      // Protection: prevent substituting a player with himself
      if (resolvedOutgoingPlayer?.id === incomingPlayer.id) {
        return prevSlots;
      }

      return prevSlots.map((slot) => {
        // Rule: Target slot receives incoming player
        if (slot.id === targetSlot.id) {
          return {
            ...slot,
            player: incomingPlayer,
            assignedPlayerId: incomingPlayer.id,
          };
        }

        // Protection: If incoming player was somehow in another slot on the field, replace with outgoing
        if (slot.player?.id === incomingPlayer.id || slot.assignedPlayerId === incomingPlayer.id) {
          return {
            ...slot,
            player: resolvedOutgoingPlayer,
            assignedPlayerId: resolvedOutgoingPlayer?.id,
          };
        }

        // All other starters remain unchanged
        return slot;
      });
    });

    // 2. Functional atomic update on bench players (benchPlayers)
    setBenchPlayers((prevBench) => {
      // Rule 4: Remove the incoming player from the bench by unique ID
      const benchWithoutIncoming = prevBench.filter((p) => p.id !== incomingPlayer.id);

      // Rule 3: Add the outgoing player to the bench
      const playerToAdd = resolvedOutgoingPlayer || targetSlot.player;
      if (playerToAdd && playerToAdd.id !== incomingPlayer.id) {
        // Rule 5: Ensure no duplicate IDs in the bench
        if (!benchWithoutIncoming.some((p) => p.id === playerToAdd.id)) {
          return [...benchWithoutIncoming, playerToAdd];
        }
      }

      return benchWithoutIncoming;
    });

    // 3. Record for undo functionality
    const effectiveOut = resolvedOutgoingPlayer || targetSlot.player;
    if (effectiveOut) {
      setSubHistory((prev) => [
        ...prev,
        {
          slotId: targetSlot.id,
          slotLabel: targetSlot.label,
          slotPositionName: targetSlot.positionName,
          outPlayer: effectiveOut,
          inPlayer: incomingPlayer,
          timestamp: Date.now(),
        },
      ]);
    }

    // 4. Visual notification
    setNoticeMessage(
      `Substituição realizada: Saiu ${effectiveOut?.name || 'Vago'} (#${effectiveOut?.jerseyNumber || '-'}), Entrou ${incomingPlayer.name} (#${incomingPlayer.jerseyNumber}) na posição ${targetSlot.label}.`
    );
    setTimeout(() => setNoticeMessage(null), 4000);

    // 5. Close modal and clear selection
    setIsModalOpen(false);
    setSelectedSlot(null);
  };

  // Undo last substitution (Rule 5)
  const handleUndoLastSubstitution = () => {
    if (subHistory.length === 0) return;

    const last = subHistory[subHistory.length - 1];
    setSubHistory((prev) => prev.slice(0, -1));

    // 1. Revert starter slot
    setTacticalSlots((prevSlots) =>
      prevSlots.map((s) => {
        if (s.id === last.slotId) {
          return {
            ...s,
            player: last.outPlayer,
            assignedPlayerId: last.outPlayer.id,
          };
        }
        if (s.player?.id === last.outPlayer.id || s.assignedPlayerId === last.outPlayer.id) {
          return {
            ...s,
            player: last.inPlayer,
            assignedPlayerId: last.inPlayer.id,
          };
        }
        return s;
      })
    );

    // 2. Revert bench: remove outPlayer, put inPlayer back
    setBenchPlayers((prevBench) => {
      const withoutOutPlayer = prevBench.filter((p) => p.id !== last.outPlayer.id);
      if (!withoutOutPlayer.some((p) => p.id === last.inPlayer.id)) {
        return [...withoutOutPlayer, last.inPlayer];
      }
      return withoutOutPlayer;
    });

    setNoticeMessage(
      `Alteração desfeita: ${last.outPlayer.name} retornou à posição ${last.slotLabel}.`
    );
    setTimeout(() => setNoticeMessage(null), 3000);
  };

  // Reset to initial lineup
  const handleResetLineup = () => {
    if (initialSlots.length > 0) {
      setTacticalSlots(initialSlots);
      const starterIds = new Set(initialSlots.map((s) => s.player?.id).filter(Boolean) as string[]);
      setBenchPlayers(squad.filter((p) => !starterIds.has(p.id)));
      setSubHistory([]);
      setSelectedSlot(null);
      setIsModalOpen(false);
      setNoticeMessage('Escalação inicial restaurada.');
      setTimeout(() => setNoticeMessage(null), 3000);
    }
  };

  // Filtered bench players for the selected slot
  const { recommendedBench, otherBench } = useMemo(() => {
    if (!selectedSlot) return { recommendedBench: [], otherBench: benchPlayers };

    const rec: { player: Player; fit: PositionFit }[] = [];
    const oth: { player: Player; fit: PositionFit }[] = [];

    benchPlayers.forEach((player) => {
      const fit = checkPositionFit(player, selectedSlot);
      if (fit.fitLevel === 'IDEAL' || fit.fitLevel === 'ADAPTADO') {
        rec.push({ player, fit });
      } else {
        oth.push({ player, fit });
      }
    });

    // Sort by overall descending
    rec.sort((a, b) => b.player.overall - a.player.overall);
    oth.sort((a, b) => b.player.overall - a.player.overall);

    return { recommendedBench: rec, otherBench: oth };
  }, [selectedSlot, benchPlayers]);

  const displayedBench = useMemo(() => {
    if (!selectedSlot) return [];
    if (subFilter === 'RECOMMENDED') {
      return recommendedBench.length > 0
        ? recommendedBench
        : [...recommendedBench, ...otherBench];
    }
    return [...recommendedBench, ...otherBench];
  }, [selectedSlot, subFilter, recommendedBench, otherBench]);

  // Save tactics to persistent store (Firestore + local store in a single atomic operation)
  const saveTactics = async () => {
    if (isSaving) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const startingIds = tacticalSlots.map((s) => s.player?.id).filter(Boolean) as string[];
      const subIds =
        benchPlayers.length > 0
          ? benchPlayers.map((p) => p.id)
          : squad.filter((p) => !startingIds.includes(p.id)).map((p) => p.id);

      const tacticSetup: TacticSetup = {
        formation,
        mentality:
          mentality === 'OFENSIVA'
            ? 'Ofensiva'
            : mentality === 'DEFENSIVA'
            ? 'Defensiva'
            : mentality === 'CONTRA-ATAQUE'
            ? 'Contra-Ataque'
            : 'Equilibrada',
        tempo: 'Padrão',
        passingStyle:
          passingStyle === 'CURTO' ? 'Curto' : passingStyle === 'DIRETO' ? 'Direto' : 'Misto',
        pressingIntensity:
          pressing === 'ALTA' ? 'Alta' : pressing === 'BAIXA' ? 'Baixa' : 'Média',
        slots: tacticalSlots.map((s) => ({
          id: s.id,
          label: s.label,
          defaultRole: (s.positionName as any) || 'MC',
          x: s.x,
          y: s.y,
          assignedPlayerId: s.player?.id,
        })),
        substitutes: subIds,
        clubId: managedClub?.id,
        updatedAt: new Date().toISOString(),
      };

      const targetClubId = managedClub?.id || 'club-1';
      await taticasService.save(targetClubId, tacticSetup);

      setSaveMessage('Configuração tática, instruções e escalação salvas com sucesso!');
      setSubHistory([]);
      setTimeout(() => setSaveMessage(null), 3500);
    } catch (err: any) {
      console.error('Erro ao salvar tática:', err);
      setErrorMessage('Erro ao persistir tática no servidor. As alterações foram salvas localmente.');
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && squad.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        <p className="text-xs text-zinc-400 font-medium">Carregando configuração tática e elenco...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#262626] pb-5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Crosshair className="w-6 h-6 text-emerald-400" />
            <span>Prancheta Tática & Estratégia</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Defina o desenho tático, substitua jogadores clicando no campo e ajuste as instruções coletivas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {subHistory.length > 0 && (
            <button
              onClick={handleUndoLastSubstitution}
              disabled={isSaving}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-semibold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Desfazer última substituição"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Desfazer ({subHistory.length})</span>
            </button>
          )}

          <button
            id="btn-save-tactics"
            onClick={saveTactics}
            disabled={isSaving || isLoading}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Salvar Tática</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {saveMessage && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-500/15 border border-red-500/30 text-red-300 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {noticeMessage && (
        <div className="bg-amber-500/15 border border-amber-500/30 text-amber-300 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between gap-2 animate-fadeIn">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>{noticeMessage}</span>
          </div>
          {subHistory.length > 0 && (
            <button
              onClick={handleUndoLastSubstitution}
              className="text-[11px] underline text-amber-300 hover:text-white font-bold ml-2 cursor-pointer"
            >
              Desfazer
            </button>
          )}
        </div>
      )}

      {/* Grid: Tactical Board & Instructions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pitch on the left (lg:col-span-7) */}
        <div className="lg:col-span-7 bg-[#121212] border border-[#262626] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-medium">Formação:</span>
              <div className="flex gap-1.5">
                {(['4-3-3', '4-2-3-1', '3-5-2', '4-4-2'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    id={`btn-formation-${fmt}`}
                    onClick={() => handleFormationChange(fmt)}
                    className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                      formation === fmt
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                        : 'bg-zinc-900 text-zinc-400 hover:text-white border border-[#262626]'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-emerald-400/90 font-medium bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Toque no jogador para substituir
              </span>
            </div>
          </div>

          {/* Interactive Pitch */}
          <div className="relative">
            <FootballPitch
              slots={tacticalSlots}
              players={squad}
              selectedSlotId={selectedSlot?.id}
              onSelectSlot={handleSlotClick}
              onSlotClick={handleSlotClick}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-[#262626]">
            <span>11 Titulares em campo ({formation})</span>
            <span>{benchPlayers.length} Jogadores no Banco de Reservas</span>
          </div>
        </div>

        {/* Right side controls: Bench & Team Instructions */}
        <div className="lg:col-span-5 space-y-4">
          {/* Bench / Substitution Quick Panel */}
          <div className="bg-[#121212] border border-[#262626] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#262626] pb-2.5">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-xs text-white uppercase tracking-wider">
                  {selectedSlot ? (
                    <span className="text-amber-400">
                      Substituir {selectedSlot.label} ({selectedSlot.player?.name?.split(' ').pop() || 'Vago'})
                    </span>
                  ) : (
                    'Banco de Reservas'
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded font-mono font-bold">
                  {benchPlayers.length} atletas
                </span>
                {selectedSlot && (
                  <button
                    onClick={() => {
                      setSelectedSlot(null);
                      setIsModalOpen(false);
                    }}
                    className="text-[10px] text-zinc-400 hover:text-white px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 cursor-pointer"
                  >
                    Fechar
                  </button>
                )}
              </div>
            </div>

            {/* If a slot is clicked, show outgoing starter context */}
            {selectedSlot && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-amber-400/90 font-bold uppercase tracking-wider block">
                    Titular Selecionado:
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-bold text-white">
                      {selectedSlot.player ? selectedSlot.player.name : 'Posição Vazia'}
                    </span>
                    <PositionBadge position={selectedSlot.player?.position || selectedSlot.positionName} size="xs" />
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-400 block">OVR Titular</span>
                  <span className="font-mono font-black text-amber-400 text-sm">
                    {selectedSlot.player?.overall || '-'}
                  </span>
                </div>
              </div>
            )}

            {/* List of bench players */}
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {benchPlayers.length === 0 ? (
                <div className="text-center py-6 text-zinc-500 text-xs">
                  Nenhum jogador disponível no banco de reservas.
                </div>
              ) : (
                benchPlayers.map((p) => {
                  const fit = selectedSlot ? checkPositionFit(p, selectedSlot) : null;
                  const isRec = fit?.fitLevel === 'IDEAL' || fit?.fitLevel === 'ADAPTADO';

                  return (
                    <div
                      key={p.id}
                      id={`bench-player-${p.id}`}
                      onClick={() => {
                        if (selectedSlot) {
                          executeSubstitution(p, selectedSlot);
                        }
                      }}
                      className={`p-2.5 rounded-lg flex items-center justify-between text-xs transition-all border ${
                        selectedSlot
                          ? isRec
                            ? 'bg-emerald-950/30 hover:bg-emerald-900/40 border-emerald-500/40 cursor-pointer'
                            : 'bg-zinc-900/80 hover:bg-zinc-800 border-[#262626] cursor-pointer opacity-90'
                          : 'bg-zinc-900/60 border-[#262626]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono text-zinc-500 text-[11px] w-6 flex-shrink-0">
                          #{p.jerseyNumber}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-white truncate max-w-[130px] sm:max-w-[170px]">
                              {p.knownAs || p.name}
                            </span>
                            <PositionBadge position={p.position} size="xs" />
                          </div>
                          {fit && (
                            <span
                              className={`text-[9px] font-medium block ${
                                fit.fitLevel === 'IDEAL'
                                  ? 'text-emerald-400'
                                  : fit.fitLevel === 'ADAPTADO'
                                  ? 'text-amber-400'
                                  : 'text-zinc-500'
                              }`}
                            >
                              {fit.description}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 flex-shrink-0">
                        <div className="text-right">
                          <span className="font-mono font-black text-emerald-400 text-xs block">
                            {p.overall}
                          </span>
                          <span className="text-[9px] text-zinc-400 block font-mono">
                            {p.condition}% cond.
                          </span>
                        </div>

                        {selectedSlot && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              executeSubstitution(p, selectedSlot);
                            }}
                            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 shadow cursor-pointer"
                          >
                            <ArrowLeftRight className="w-3 h-3" />
                            <span>Escalar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {!selectedSlot && (
              <p className="text-[10px] text-zinc-500 text-center pt-1 border-t border-[#262626]">
                Dica: Toque em qualquer titular na prancheta para abrir o modal completo de substituição.
              </p>
            )}
          </div>

          {/* Tactical Instructions */}
          <div className="bg-[#121212] border border-[#262626] rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2 border-b border-[#262626] pb-3">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <h2 className="font-bold text-xs text-white uppercase tracking-wider">
                Instruções Coletivas do Treinador
              </h2>
            </div>

            {/* Mentality */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Mentalidade da Equipe:</span>
                <span className="font-bold text-emerald-400 font-mono">{mentality}</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {(['OFENSIVA', 'EQUILIBRADA', 'DEFENSIVA', 'CONTRA-ATAQUE'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMentality(m)}
                    className={`py-1.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                      mentality === m
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-zinc-900 text-zinc-400 hover:text-white border border-[#262626]'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Pressing */}
            <div className="space-y-1.5 pt-2 border-t border-[#262626]">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Pressão sem a Bola:</span>
                <span className="font-bold text-emerald-400 font-mono">{pressing}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(['BAIXA', 'MODERADA', 'ALTA'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPressing(p)}
                    className={`py-1.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                      pressing === p
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-zinc-900 text-zinc-400 hover:text-white border border-[#262626]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Passing style */}
            <div className="space-y-1.5 pt-2 border-t border-[#262626]">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Estilo de Passes:</span>
                <span className="font-bold text-emerald-400 font-mono">{passingStyle}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(['CURTO', 'MISTO', 'DIRETO'] as const).map((ps) => (
                  <button
                    key={ps}
                    onClick={() => setPassingStyle(ps)}
                    className={`py-1.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                      passingStyle === ps
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-zinc-900 text-zinc-400 hover:text-white border border-[#262626]'
                    }`}
                  >
                    {ps}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Substitution Modal (Rule 1, 2, 3, 4) */}
      {isModalOpen && selectedSlot && (
        <div
          id="modal-substituicao"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-[#121212] border border-[#262626] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-4 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#262626] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base leading-tight">
                    Substituição de Jogador
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-zinc-400">
                      Posição no campo: <strong className="text-emerald-400">{selectedSlot.label}</strong> ({selectedSlot.positionName})
                    </span>
                    <span className="text-zinc-600">•</span>
                    <span className="text-xs font-mono text-zinc-400">{formation}</span>
                  </div>
                </div>
              </div>

              <button
                id="btn-close-sub-modal"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-[#262626]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Player Card (Jogador a ser substituído) */}
            <div className="bg-zinc-900/90 border border-[#262626] rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-950 border border-emerald-500/60 flex items-center justify-center font-mono font-bold text-emerald-400 text-sm shadow">
                  {selectedSlot.player?.jerseyNumber || '-'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400">
                      Titular Atual (Sairá)
                    </span>
                    <PositionBadge
                      position={selectedSlot.player?.position || selectedSlot.positionName}
                      size="xs"
                    />
                  </div>
                  <h4 className="font-bold text-white text-sm">
                    {selectedSlot.player ? selectedSlot.player.name : 'Vago (Sem titular)'}
                  </h4>
                  {selectedSlot.player && (
                    <span className="text-[11px] text-zinc-400">
                      {selectedSlot.player.preferredFoot} • {selectedSlot.player.condition}% cond. • {selectedSlot.player.morale}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-zinc-500 uppercase font-bold block">OVR</span>
                <span className="font-mono font-black text-amber-400 text-base">
                  {selectedSlot.player?.overall || '-'}
                </span>
              </div>
            </div>

            {/* Filter Tabs: Recommended vs All */}
            <div className="flex items-center justify-between border-b border-[#262626] pb-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Jogadores Disponíveis no Banco ({benchPlayers.length})
              </span>

              <div className="flex gap-1">
                <button
                  id="tab-sub-recommended"
                  onClick={() => setSubFilter('RECOMMENDED')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                    subFilter === 'RECOMMENDED'
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white border border-[#262626]'
                  }`}
                >
                  Compatíveis ({recommendedBench.length})
                </button>
                <button
                  id="tab-sub-all"
                  onClick={() => setSubFilter('ALL')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                    subFilter === 'ALL'
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white border border-[#262626]'
                  }`}
                >
                  Todos ({benchPlayers.length})
                </button>
              </div>
            </div>

            {/* Available Players List (Rule 2 & 3) */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {displayedBench.length === 0 ? (
                <div className="text-center py-8 bg-zinc-900/40 rounded-xl border border-dashed border-[#262626] p-4">
                  <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2 opacity-80" />
                  <p className="text-xs text-zinc-300 font-semibold">
                    Nenhum jogador de reserva com a posição exata encontrada.
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Você pode selecionar outro atleta da aba &quot;Todos&quot; para adaptar na função.
                  </p>
                  <button
                    onClick={() => setSubFilter('ALL')}
                    className="mt-3 bg-zinc-800 hover:bg-zinc-700 text-white text-xs px-3 py-1.5 rounded-lg border border-zinc-700 font-medium cursor-pointer"
                  >
                    Ver todos os reservas
                  </button>
                </div>
              ) : (
                displayedBench.map(({ player, fit }) => (
                  <div
                    key={player.id}
                    id={`sub-option-${player.id}`}
                    className="p-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800/90 border border-[#262626] hover:border-emerald-500/50 flex items-center justify-between transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-slate-950 border border-zinc-700 flex items-center justify-center font-mono font-bold text-zinc-300 text-xs flex-shrink-0 group-hover:border-emerald-400 group-hover:text-emerald-400 transition-colors">
                        {player.jerseyNumber}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs truncate max-w-[140px] sm:max-w-[190px]">
                            {player.name}
                          </span>
                          <PositionBadge position={player.position} size="xs" />
                        </div>

                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${
                              fit.fitLevel === 'IDEAL'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : fit.fitLevel === 'ADAPTADO'
                                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                            }`}
                          >
                            {fit.description}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-mono">
                            {player.condition}% cond.
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <span className="text-[9px] text-zinc-500 uppercase font-bold block">OVR</span>
                        <span className="font-mono font-black text-emerald-400 text-sm">
                          {player.overall}
                        </span>
                      </div>

                      <button
                        id={`btn-substitute-${player.id}`}
                        onClick={() => executeSubstitution(player, selectedSlot)}
                        className="bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        <span>Substituir</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-[#262626] pt-3 text-xs">
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Atualização imediata no campo e banco</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900 border border-[#262626] cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
