import React, { useEffect, useState } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { noticiasService } from '../../services/noticiasService';
import { News } from '../../types';
import { Newspaper, Calendar, Clock, Tag } from 'lucide-react';

export const NoticiasPage: React.FC = () => {
  const [news, setNews] = useState<News[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  useEffect(() => {
    noticiasService.getAll().then(setNews);
  }, []);

  const categories = ['ALL', 'LIGA', 'MERCADO', 'BASTIDORES', 'TÁTICA'];

  const filtered = news.filter((n) =>
    selectedCategory === 'ALL' ? true : n.category.toUpperCase() === selectedCategory
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
            <Newspaper className="w-7 h-7 text-emerald-400" />
            <span>Noticiário do FM Universe</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Cobertura diária de jogos, declarações de treinadores e bastidores do mercado.
          </p>
        </div>

        {/* Category filters */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 overflow-x-auto self-start">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {cat === 'ALL' ? 'Todas' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* News Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map((item) => (
          <article
            key={item.id}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
                <span className="bg-emerald-500/15 text-emerald-400 font-bold px-2 py-0.5 rounded text-[10px] border border-emerald-500/30 uppercase">
                  {item.category}
                </span>
                <span className="flex items-center gap-1 text-slate-500">
                  <Calendar className="w-3.5 h-3.5" />
                  {item.date}
                </span>
              </div>

              <h2 className="text-lg font-bold text-white mb-2 leading-snug hover:text-emerald-400 transition-colors">
                {item.title}
              </h2>

              <p className="text-xs text-slate-300 mb-4 leading-relaxed font-medium">
                {item.summary}
              </p>

              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 text-xs text-slate-400 leading-relaxed">
                {item.content}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
              <span>Fonte: Imprensa FM Universe</span>
              <span>Leitura de 2 min</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};
