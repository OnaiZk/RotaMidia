'use client';

import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import Link from 'next/link';
import { Plus, Search, ClipboardList, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import ImportarPlanilha from '@/components/importar-planilha';

export default function OrdensPage() {
  const [filter, setFilter] = useState('todas');
  const [busca, setBusca] = useState('');
  const queryArgs = filter === 'todas' ? {} : { status: filter as any };
  const ordens = useQuery(api.ordensServico.list, queryArgs) || [];

  const ordensFiltradas = ordens.filter((o: any) => 
    busca ? o.titulo.toLowerCase().includes(busca.toLowerCase()) : true
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Ordens de Serviço</h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie e acompanhe o andamento dos pontos de parada</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/admin/base-preventiva"
            className="text-xs text-emerald-800 bg-emerald-50 hover:bg-emerald-100 font-bold flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl transition-all border border-emerald-200 shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Abrir Planilha Base (21k pts)</span>
          </Link>
          <ImportarPlanilha modoLoteDireto={true} botaoTexto="Importar Planilha Externa" />
          <Link 
            href="/admin/ordens/nova" 
            className="bg-[#FF5000] hover:bg-[#E04700] text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Ordem</span>
          </Link>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Buscar por título da ordem..." 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF5000] text-sm"
          />
        </div>
        <select 
          className="border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#FF5000] bg-white text-sm font-medium text-slate-700"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="todas">Todos os Status</option>
          <option value="rascunho">Rascunho</option>
          <option value="ativa">Em Andamento</option>
          <option value="concluida">Concluída</option>
          <option value="cancelada">Cancelada</option>
        </select>
      </div>

      <div className="grid gap-4">
        {ordensFiltradas.map((ordem: any) => (
          <Link key={ordem._id} href={`/admin/ordens/${ordem._id}`} className="group block">
            <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-xs border border-slate-200/80 group-hover:border-orange-300 group-hover:shadow-sm transition-all flex flex-col md:flex-row justify-between md:items-center gap-4 cursor-pointer">
              <div>
                <h3 className="font-bold text-lg text-slate-900 group-hover:text-[#FF5000] transition-colors">{ordem.titulo}</h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Criada em: {ordem.dataCriacao ? new Date(ordem.dataCriacao).toLocaleDateString('pt-BR') : 'Recente'} • Limite: {ordem.dataLimite ? new Date(ordem.dataLimite).toLocaleDateString('pt-BR') : 'Sem prazo definido'}
                </p>
              </div>
              <div className="flex items-center justify-between md:justify-end gap-6 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                <div className="text-left md:text-right">
                  <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-0.5">Atividades</p>
                  <p className="text-sm font-bold text-slate-800">
                    {ordem.atividadesConcluidas || 0} / {ordem.totalAtividades || 0}
                  </p>
                </div>
                <span className={`px-3 py-1 text-xs font-semibold rounded-full uppercase tracking-wider ${
                  ordem.status === 'ativa' ? 'bg-orange-50 text-[#FF5000] border border-orange-200' :
                  ordem.status === 'concluida' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                  ordem.status === 'cancelada' ? 'bg-red-50 text-red-700 border border-red-200' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {ordem.status === 'rascunho' ? 'Rascunho' :
                   ordem.status === 'ativa' ? 'Em Andamento' :
                   ordem.status === 'concluida' ? 'Concluída' : 'Cancelada'}
                </span>
              </div>
            </div>
          </Link>
        ))}
        
        {ordensFiltradas.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
            <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">Nenhuma ordem encontrada</h3>
            <p className="text-sm text-slate-400 mt-1">Tente ajustar os filtros de busca ou crie uma nova ordem de serviço.</p>
          </div>
        )}
      </div>
    </div>
  );
}
