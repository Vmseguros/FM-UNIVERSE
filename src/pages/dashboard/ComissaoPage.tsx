import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { StaffMember } from '../../types';
import { formatCurrencyBRL } from '../../utils/currency';
import { initialStaff } from '../../data/mockData';
import { Briefcase, Award, CheckCircle, UserCheck } from 'lucide-react';

export const ComissaoPage: React.FC = () => {
  const { managedClub } = useAuth();
  const [staffList, setStaffList] = useState<StaffMember[]>(initialStaff);
  const [feedback, setFeedback] = useState<string | null>(null);

  const roleLabels: Record<string, string> = {
    ASSISTANT_MANAGER: 'Auxiliar Técnico',
    COACH: 'Treinador Adjunto',
    SCOUT: 'Olheiro Chefe',
    PHYSIO: 'Fisioterapeuta Chefe',
  };

  const handleHireUpgrade = (staffId: string) => {
    setStaffList((prev) =>
      prev.map((s) => (s.id === staffId ? { ...s, rating: Math.min(99, s.rating + 2) } : s))
    );
    setFeedback('Qualificação e curso de capacitação concluídos com êxito para o profissional!');
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Briefcase className="w-6 h-6 text-emerald-400" />
          <span>Comissão Técnica & Profissionais do Staff</span>
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Equipe de apoio do treinador para treinos, relatórios de olheiros e recuperação médica.
        </p>
      </div>

      {feedback && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Staff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {staffList.map((member) => (
          <div
            key={member.id}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-400 font-mono">
                    {roleLabels[member.role] || member.role}
                  </span>
                  <h2 className="text-base font-bold text-white mt-0.5">{member.name}</h2>
                  <span className="text-xs text-slate-400">{member.nationality}</span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Nível</span>
                  <span className="font-mono text-base font-black text-emerald-400 bg-slate-950 px-2.5 py-0.5 rounded border border-slate-800">
                    {member.rating}
                  </span>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1.5 mb-4">
                <div className="flex justify-between">
                  <span>Salário Mensal:</span>
                  <span className="font-mono text-white font-bold">
                    {formatCurrencyBRL(member.wage, { compact: true, decimals: 0 })}/mês
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Especialidade:</span>
                  <span className="text-emerald-400 font-semibold">{member.specialty}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleHireUpgrade(member.id)}
              className="w-full bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 py-2 rounded-xl text-xs font-semibold border border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Enviar para Curso de Capacitação (+2 Nível)</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
