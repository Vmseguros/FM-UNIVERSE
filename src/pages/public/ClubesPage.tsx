import React, { useEffect, useState } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { clubesService } from '../../services/clubesService';
import { Club } from '../../types';
import { formatCurrencyBRL } from '../../utils/currency';
import { ClubBadge } from '../../components/common/ClubBadge';
import { Shield, Users, DollarSign, Trophy, ArrowRight, Building2 } from 'lucide-react';

export const ClubesPage: React.FC = () => {
  const { navigate } = useNavigation();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    clubesService.getAll().then(setClubs);
  }, []);

  const filtered = clubs.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.stadiumName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
            <Shield className="w-7 h-7 text-emerald-400" />
            <span>Clubes do FM Universe</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Conheça as equipes, estádios, orçamentos, dirigentes e histórias dos participantes.
          </p>
        </div>

        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Buscar clube ou estádio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Clubs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((club) => (
          <div
            key={club.id}
            onClick={() => navigate(`/clubes/${club.slug}`)}
            className="bg-slate-900 border border-slate-800 hover:border-emerald-500/60 rounded-2xl p-6 transition-all hover:-translate-y-1 cursor-pointer flex flex-col justify-between group shadow-sm"
          >
            <div>
              {/* Badge & Info Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <ClubBadge club={club} size="lg" className="shadow-md group-hover:scale-105 transition-transform" />
                  <div>
                    <h2 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                      {club.name}
                    </h2>
                    <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider font-semibold">
                      {club.code} • Fundado em {club.foundedYear}
                    </span>
                  </div>
                </div>

                <span className="text-xs font-mono font-bold bg-slate-800 text-emerald-400 px-2.5 py-1 rounded-lg border border-slate-700">
                  Rep {club.reputation}
                </span>
              </div>

              {/* Stadium & Coach Info */}
              <div className="space-y-2 text-xs text-slate-400 mb-5">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="text-slate-300 font-medium truncate">{club.stadiumName}</span>
                  <span className="text-slate-500 font-mono">({(club.capacity / 1000).toFixed(1)}k)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="text-slate-400">Treinador:</span>
                  <span className="text-slate-200 font-semibold">{club.managerName}</span>
                </div>
              </div>

              {/* Financial & Squad Stats HUD */}
              <div className="grid grid-cols-3 gap-2 bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-center mb-4">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Elenco</span>
                  <span className="font-mono font-bold text-xs text-white">{club.squadCount} atletas</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Orçamento</span>
                  <span className="font-mono font-bold text-xs text-emerald-400">
                    {formatCurrencyBRL(club.transferBudget, { compact: true })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Títulos</span>
                  <span className="font-mono font-bold text-xs text-amber-400 flex items-center justify-center gap-1">
                    <Trophy className="w-3 h-3 text-amber-400" />
                    {club.trophiesCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Card Footer Button */}
            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-emerald-400 group-hover:text-emerald-300">
              <span>Acessar Perfil Completo</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
