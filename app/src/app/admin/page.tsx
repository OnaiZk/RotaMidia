'use client';

import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { ClipboardList, CheckCircle2, Users, Activity, ChevronRight, Plus, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const ordens = useQuery(api.ordensServico.list, {}) || [];
  const tecnicos = useQuery(api.tecnicos.list, {}) || [];
  
  const totalOrdens = ordens.length;
  const ativas = ordens.filter((o: any) => o.status === 'ativa').length;
  const concluidas = ordens.filter((o: any) => o.status === 'concluida').length;
  
  const stats = [
    { title: 'Total de Ordens', value: totalOrdens, icon: ClipboardList, color: 'text-[#FF5000]', bg: 'bg-orange-50' },
    { title: 'Ordens em Andamento', value: ativas, icon: Activity, color: 'text-amber-600', bg: 'bg-amber-50' },
    { title: 'Técnicos em Campo', value: tecnicos.length, icon: Users, color: 'text-slate-700', bg: 'bg-slate-100' },
    { title: 'Ordens Concluídas', value: concluidas, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Visão geral das rotas e manutenções em campo</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/base-preventiva"
            className="inline-flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-2xs self-start sm:self-auto cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Planilha Base (21k pts)</span>
          </Link>
          <Link 
            href="/admin/ordens/nova" 
            className="inline-flex items-center justify-center gap-2 bg-[#FF5000] hover:bg-[#E04700] text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-colors shadow-sm self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Ordem</span>
          </Link>
        </div>
      </div>
      
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-white rounded-2xl shadow-xs p-6 border border-slate-200/80 flex items-center gap-4 transition-all hover:shadow-sm">
              <div className={`p-3.5 rounded-xl ${stat.bg}`}>
                <Icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{stat.title}</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Orders Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Ordens de Serviço Recentes</h2>
            <p className="text-xs text-slate-400">Últimas ordens cadastradas na plataforma</p>
          </div>
          <Link href="/admin/ordens" className="text-xs font-semibold text-[#FF5000] hover:text-[#E04700] flex items-center gap-1">
            Ver todas <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4">Título</th>
                <th className="py-3 px-4">Data Limite</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ordens.slice(0, 5).map((ordem: any) => (
                <tr key={ordem._id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 text-sm font-semibold text-slate-800">
                    <Link href={`/admin/ordens/${ordem._id}`} className="hover:text-[#FF5000] transition-colors">
                      {ordem.titulo}
                    </Link>
                  </td>
                  <td className="py-3.5 px-4 text-sm text-slate-500">
                    {ordem.dataLimite ? new Date(ordem.dataLimite).toLocaleDateString('pt-BR') : 'Não definida'}
                  </td>
                  <td className="py-3.5 px-4 text-sm">
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full uppercase tracking-wider ${
                      ordem.status === 'ativa' ? 'bg-orange-50 text-[#FF5000] border border-orange-200' :
                      ordem.status === 'concluida' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      ordem.status === 'cancelada' ? 'bg-red-50 text-red-700 border border-red-200' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {ordem.status === 'ativa' ? 'Em Andamento' :
                       ordem.status === 'concluida' ? 'Concluída' :
                       ordem.status === 'cancelada' ? 'Cancelada' : 'Rascunho'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Link 
                      href={`/admin/ordens/${ordem._id}`}
                      className="text-xs font-medium text-slate-600 hover:text-[#FF5000] transition-colors"
                    >
                      Detalhes →
                    </Link>
                  </td>
                </tr>
              ))}
              {ordens.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 text-sm">
                    Nenhuma ordem de serviço cadastrada no momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
