import React, { useEffect, useState } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { clubesService } from '../../services/clubesService';
import { Club } from '../../types';
import { ClubBadge } from '../../components/common/ClubBadge';
import { Building2, Users, MapPin, ArrowRight } from 'lucide-react';

export const EstadiosPage: React.FC = () => {
  const { navigate } = useNavigation();
  const [clubs, setClubs] = useState<Club[]>([]);

  useEffect(() => {
    clubesService.getAll().then(setClubs);
  }, []);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
          <Building2 className="w-7 h-7 text-emerald-400" />
          <span>Estádios & Praças Desportivas</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Arenas históricas e modernos complexos que sediam as partidas do FM Universe.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clubs.map((club) => (
          <div
            key={club.id}
            onClick={() => navigate(`/clubes/${club.slug}`)}
            className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 transition-all hover:-translate-y-1 cursor-pointer group shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                  🏟️
                </div>
                <span className="font-mono text-xs font-bold text-emerald-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                  {(club.capacity / 1000).toFixed(1)}k Lugares
                </span>
              </div>

              <h2 className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors mb-1">
                {club.stadiumName}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
                <span>Casa do</span>
                <span className="text-white font-semibold flex items-center gap-1.5">
                  <ClubBadge club={club} size="xs" />
                  <span>{club.name}</span>
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800 mb-4">
                <div className="flex justify-between">
                  <span>Capacidade Total:</span>
                  <span className="font-mono font-bold text-white">
                    {club.capacity.toLocaleString()} torcedores
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Gramado:</span>
                  <span className="text-emerald-400 font-semibold">Natural Padrão FIFA</span>
                </div>
                <div className="flex justify-between">
                  <span>Condição da Arena:</span>
                  <span className="text-slate-200 font-semibold">Excelente (Nível 4)</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-semibold text-emerald-400 group-hover:text-emerald-300">
              <span>Ver Clube Proprietário</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
