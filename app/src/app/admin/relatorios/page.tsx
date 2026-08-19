'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import {
  BarChart3,
  Clock,
  CheckCircle2,
  Users,
  AlertTriangle,
  FileSpreadsheet,
  Search,
  ChevronRight,
  ArrowUpRight,
  TrendingUp,
  Award,
  Calendar,
  Layers,
  MapPin,
  X,
  Eye,
  Phone,
  Mail,
  Filter,
  Activity,
  Zap,
} from 'lucide-react';

type TabType = 'visao_geral' | 'pendentes' | 'concluidas' | 'tecnicos';

/**
 * Componente de Gráfico Circular / Donut Gauge para % de conclusão da OS
 */
function DonutProgress({
  percent,
  size = 54,
  strokeWidth = 5,
  color = '#FF5000',
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercent = Math.min(100, Math.max(0, percent));
  const offset = circumference - (clampedPercent / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Círculo de fundo */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E2E8F0"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Arco de progresso */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className="absolute text-[11px] font-extrabold text-slate-800">
        {clampedPercent}%
      </span>
    </div>
  );
}

/**
 * Componente de Gráfico de Evolução Temporal em SVG (Barras + Linha de Tendência)
 */
function EvolucaoTecnicoChart({
  evolucao,
}: {
  evolucao: Array<{ dataIso: string; dataFormatada: string; quantidade: number; acumulado: number }>;
}) {
  if (!evolucao || evolucao.length === 0) {
    return (
      <div className="text-center py-4 px-3 bg-slate-50 rounded-xl border border-slate-100 text-slate-400 text-xs">
        Sem histórico temporal suficiente para traçar a evolução.
      </div>
    );
  }

  const maxQtd = Math.max(...evolucao.map((e) => e.quantidade), 1);
  const totalAcumulado = evolucao[evolucao.length - 1]?.acumulado || 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-600 flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5 text-[#FF5000]" />
          Evolução de Atividades Realizadas
        </span>
        <span className="text-[11px] font-bold text-slate-500">
          Total: <strong className="text-slate-900">{totalAcumulado}</strong>
        </span>
      </div>

      {/* Gráfico de Barras com Escala */}
      <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 flex items-end gap-2 h-24 overflow-x-auto">
        {evolucao.slice(-10).map((item, idx) => {
          const heightPercent = Math.max(12, Math.round((item.quantidade / maxQtd) * 100));

          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1 min-w-[28px] h-full justify-end group relative">
              {/* Tooltip hover */}
              <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] py-0.5 px-1.5 rounded pointer-events-none whitespace-nowrap z-20 shadow-md">
                {item.quantidade} ativ. ({item.dataFormatada})
              </div>

              {/* Valor numérico em cima da barra */}
              <span className="text-[10px] font-bold text-slate-500 group-hover:text-[#FF5000] transition-colors">
                {item.quantidade}
              </span>

              {/* Barra */}
              <div className="w-full bg-slate-200 rounded-t-md overflow-hidden flex items-end h-14">
                <div
                  className="w-full bg-gradient-to-t from-[#FF5000] to-orange-400 group-hover:from-orange-600 group-hover:to-orange-500 transition-all rounded-t-md"
                  style={{ height: `${heightPercent}%` }}
                />
              </div>

              {/* Data embaixo */}
              <span className="text-[9px] font-semibold text-slate-400 truncate w-full text-center">
                {item.dataFormatada}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function RelatoriosPage() {
  const [activeTab, setActiveTab] = useState<TabType>('visao_geral');
  const [busca, setBusca] = useState('');
  const [filtroStatusPrazo, setFiltroStatusPrazo] = useState<'todos' | 'atrasada' | 'alerta' | 'no_prazo'>('todos');
  const [tecnicoModal, setTecnicoModal] = useState<any | null>(null);

  // Consulta reativa de relatórios no Convex
  const dados = useQuery(api.relatorios.getDadosCompletos, {});

  // Funções de exportação para Excel
  const exportarRelatorioExcel = (tipo: 'ativa' | 'completa' = 'ativa') => {
    if (!dados) return;

    const wb = XLSX.utils.book_new();

    // 1. Aba Ordens Pendentes
    if (tipo === 'completa' || activeTab === 'pendentes' || activeTab === 'visao_geral') {
      const dataPendentes = dados.ordensPendentes.map((o: any) => ({
        'Título da OS': o.titulo,
        'Status': o.status === 'ativa' ? 'Em Andamento' : 'Rascunho',
        'Data Criação': o.dataCriacao ? new Date(o.dataCriacao).toLocaleDateString('pt-BR') : '',
        'Data Limite': o.dataLimite ? new Date(o.dataLimite).toLocaleDateString('pt-BR') : 'Não definida',
        'Situação do Prazo': o.estaAtrasada
          ? `Atrasada (${Math.abs(o.diasRestantes || 0)} dias)`
          : o.diasRestantes !== null
          ? `${o.diasRestantes} dias restantes`
          : 'Sem prazo',
        'Total Pontos': o.totalPontos,
        'Atividades Concluídas': o.atividadesConcluidas,
        'Atividades Pendentes': o.atividadesPendentes,
        'Total Atividades': o.totalAtividades,
        'Progresso (%)': `${o.progresso}%`,
        'Técnicos Alocados': o.tecnicos.map((t: any) => t.nome).join(', ') || 'Nenhum',
      }));

      const wsPendentes = XLSX.utils.json_to_sheet(dataPendentes);
      XLSX.utils.book_append_sheet(wb, wsPendentes, 'Ordens Pendentes');
    }

    // 2. Aba Ordens Concluídas
    if (tipo === 'completa' || activeTab === 'concluidas' || activeTab === 'visao_geral') {
      const dataConcluidas = dados.ordensConcluidas.map((o: any) => ({
        'Título da OS': o.titulo,
        'Status': 'Concluída',
        'Data Criação': o.dataCriacao ? new Date(o.dataCriacao).toLocaleDateString('pt-BR') : '',
        'Data Limite': o.dataLimite ? new Date(o.dataLimite).toLocaleDateString('pt-BR') : 'Não definida',
        'Última Conclusão': o.ultimaDataConclusao
          ? new Date(o.ultimaDataConclusao).toLocaleString('pt-BR')
          : 'N/A',
        'Total Pontos': o.totalPontos,
        'Total Atividades': o.totalAtividades,
        'Atividades Concluídas': o.atividadesConcluidas,
        'Progresso': '100%',
        'Técnicos Participantes': o.tecnicos.map((t: any) => t.nome).join(', ') || 'Nenhum',
      }));

      const wsConcluidas = XLSX.utils.json_to_sheet(dataConcluidas);
      XLSX.utils.book_append_sheet(wb, wsConcluidas, 'Ordens Concluídas');
    }

    // 3. Aba Produtividade Técnicos
    if (tipo === 'completa' || activeTab === 'tecnicos' || activeTab === 'visao_geral') {
      const dataTecnicos = dados.relatorioTecnicos.map((t: any) => ({
        'Nome do Técnico': t.nome,
        'E-mail': t.email,
        'Telefone': t.telefone || 'Não informado',
        'Total Atividades Realizadas': t.totalAtividadesFeitas,
        'Ordens com Atividade': t.totalOrdensComAtividades,
        'Ordens Atribuídas': t.totalOrdensAtribuidas,
        'Ordens em Andamento': t.ordensEmAndamento?.length || 0,
        'Última Atividade': t.ultimaAtividadeEm
          ? new Date(t.ultimaAtividadeEm).toLocaleString('pt-BR')
          : 'Nenhuma registrada',
      }));

      const wsTecnicos = XLSX.utils.json_to_sheet(dataTecnicos);
      XLSX.utils.book_append_sheet(wb, wsTecnicos, 'Produtividade Técnicos');
    }

    const dataHoje = new Date().toISOString().split('T')[0];
    const nomeArquivo =
      tipo === 'completa'
        ? `Relatorio_Completo_Manutencao_${dataHoje}.xlsx`
        : `Relatorio_${activeTab.toUpperCase()}_${dataHoje}.xlsx`;

    XLSX.writeFile(wb, nomeArquivo);
  };

  if (!dados) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-slate-200 rounded-xl w-1/3"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-2xl"></div>
          ))}
        </div>
        <div className="h-96 bg-slate-200 rounded-2xl"></div>
      </div>
    );
  }

  const { metricas, ordensPendentes, ordensConcluidas, relatorioTecnicos } = dados;

  // Filtros locais para a lista de pendentes
  const pendentesFiltradas = ordensPendentes.filter((o: any) => {
    const matchBusca = busca
      ? o.titulo.toLowerCase().includes(busca.toLowerCase()) ||
        o.tecnicos.some((t: any) => t.nome.toLowerCase().includes(busca.toLowerCase()))
      : true;

    if (!matchBusca) return false;

    if (filtroStatusPrazo === 'atrasada') return o.estaAtrasada;
    if (filtroStatusPrazo === 'alerta') return o.statusPrazo === 'alerta';
    if (filtroStatusPrazo === 'no_prazo') return o.statusPrazo === 'no_prazo';
    return true;
  });

  // Filtros locais para a lista de concluídas
  const concluidasFiltradas = ordensConcluidas.filter((o: any) => {
    return busca
      ? o.titulo.toLowerCase().includes(busca.toLowerCase()) ||
        o.tecnicos.some((t: any) => t.nome.toLowerCase().includes(busca.toLowerCase()))
      : true;
  });

  // Filtros locais para os técnicos
  const tecnicosFiltrados = relatorioTecnicos.filter((t: any) => {
    return busca
      ? t.nome.toLowerCase().includes(busca.toLowerCase()) ||
        t.email.toLowerCase().includes(busca.toLowerCase())
      : true;
  });

  return (
    <div className="space-y-7 pb-12">
      {/* Header Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-orange-100 rounded-xl text-[#FF5000]">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Relatórios & Indicadores
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Acompanhamento completo de ordens pendentes, finalizadas e produtividade com gráficos de evolução dos técnicos.
          </p>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
          <button
            onClick={() => exportarRelatorioExcel('completa')}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-xs"
            title="Exportar todas as abas consolidadas em uma única planilha"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Exportar Excel Completo
          </button>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-2xl max-w-full overflow-x-auto">
        <button
          onClick={() => {
            setActiveTab('visao_geral');
            setBusca('');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'visao_geral'
              ? 'bg-white text-[#FF5000] shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Visão Geral
        </button>

        <button
          onClick={() => {
            setActiveTab('pendentes');
            setBusca('');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'pendentes'
              ? 'bg-white text-[#FF5000] shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Clock className="w-4 h-4" />
          Ordens Pendentes
          <span className="ml-1 px-2 py-0.5 text-xs bg-orange-100 text-[#FF5000] rounded-full font-bold">
            {metricas.totalPendentes}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab('concluidas');
            setBusca('');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'concluidas'
              ? 'bg-white text-[#FF5000] shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          Ordens Concluídas
          <span className="ml-1 px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded-full font-bold">
            {metricas.totalConcluidas}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab('tecnicos');
            setBusca('');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'tecnicos'
              ? 'bg-white text-[#FF5000] shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Users className="w-4 h-4" />
          Atividades por Técnico
          <span className="ml-1 px-2 py-0.5 text-xs bg-slate-100 text-slate-700 rounded-full font-bold">
            {metricas.totalTecnicos}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: VISÃO GERAL & KPIS                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'visao_geral' && (
        <div className="space-y-6">
          {/* Métricas Principais em Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Ordens Pendentes
                </p>
                <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">
                  {metricas.totalPendentes}
                </span>
                <span className="text-xs text-slate-500">
                  de {metricas.totalOrdens} ordens totais
                </span>
              </div>
              {metricas.ordensAtrasadas > 0 && (
                <div className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {metricas.ordensAtrasadas} ordem(ns) com prazo vencido
                </div>
              )}
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Ordens Concluídas
                </p>
                <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">
                  {metricas.totalConcluidas}
                </span>
                <span className="text-xs text-emerald-600 font-medium">
                  {metricas.totalOrdens > 0
                    ? Math.round((metricas.totalConcluidas / metricas.totalOrdens) * 100)
                    : 0}
                  % de conclusão
                </span>
              </div>
              <p className="mt-2.5 text-xs text-slate-500">
                Totalmente finalizadas em campo
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Atividades Executadas
                </p>
                <div className="p-2 bg-orange-50 rounded-xl text-[#FF5000]">
                  <Layers className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">
                  {metricas.totalAtividadesConcluidas}
                </span>
                <span className="text-xs text-slate-500">
                  / {metricas.totalAtividades} totais
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
                <div
                  className="bg-[#FF5000] h-full rounded-full transition-all duration-500"
                  style={{ width: `${metricas.taxaGeralConclusao}%` }}
                />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Técnicos Produtivos
                </p>
                <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">
                  {metricas.tecnicosComAtividade}
                </span>
                <span className="text-xs text-slate-500">
                  de {metricas.totalTecnicos} cadastrados
                </span>
              </div>
              <p className="mt-2.5 text-xs text-slate-500">
                Com registros de atividades concluídas
              </p>
            </div>
          </div>

          {/* Seção 2: Top Técnicos e Ordens Críticas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Técnicos por Atividades */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Ranking de Produtividade dos Técnicos
                  </h3>
                  <p className="text-xs text-slate-500">
                    Técnicos com maior volume de atividades executadas
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('tecnicos')}
                  className="text-xs font-semibold text-[#FF5000] hover:text-[#E04700] flex items-center gap-1"
                >
                  Ver todos <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3">
                {relatorioTecnicos.slice(0, 5).map((tec: any, index: number) => {
                  const maxAtivs = relatorioTecnicos[0]?.totalAtividadesFeitas || 1;
                  const pct = Math.round((tec.totalAtividadesFeitas / maxAtivs) * 100);

                  return (
                    <div
                      key={tec._id}
                      onClick={() => setTecnicoModal(tec)}
                      className="p-3.5 rounded-xl border border-slate-100 hover:border-orange-200 hover:bg-orange-50/30 transition-all cursor-pointer flex items-center gap-3.5"
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          index === 0
                            ? 'bg-amber-100 text-amber-800'
                            : index === 1
                            ? 'bg-slate-200 text-slate-700'
                            : index === 2
                            ? 'bg-amber-700/10 text-amber-900'
                            : 'bg-slate-50 text-slate-500'
                        }`}
                      >
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {tec.nome}
                          </p>
                          <span className="text-xs font-bold text-slate-900">
                            {tec.totalAtividadesFeitas} atividades
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-[#FF5000] h-full rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {tec.ordensEmAndamento?.length > 0 && (
                        <div className="shrink-0 flex items-center" title={`${tec.ordensEmAndamento.length} ordem(ns) em andamento`}>
                          <DonutProgress percent={tec.ordensEmAndamento[0]?.progresso || 0} size={38} strokeWidth={3.5} />
                        </div>
                      )}
                    </div>
                  );
                })}

                {relatorioTecnicos.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-6">
                    Nenhum técnico cadastrado ainda.
                  </p>
                )}
              </div>
            </div>

            {/* Ordens Pendentes com Atenção aos Prazos */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Ordens Pendentes em Atenção
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ordens com prazos próximos ou vencidos
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('pendentes')}
                  className="text-xs font-semibold text-[#FF5000] hover:text-[#E04700] flex items-center gap-1"
                >
                  Ver todas <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3">
                {ordensPendentes.slice(0, 5).map((ordem: any) => (
                  <Link
                    key={ordem._id}
                    href={`/admin/ordens/${ordem._id}`}
                    className="p-3.5 rounded-xl border border-slate-100 hover:border-orange-200 hover:bg-orange-50/30 transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 group-hover:text-[#FF5000] transition-colors truncate">
                        {ordem.titulo}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>{ordem.totalPontos} pontos</span>
                        <span>•</span>
                        <span>
                          {ordem.atividadesConcluidas}/{ordem.totalAtividades} atividades
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <DonutProgress percent={ordem.progresso} size={40} strokeWidth={4} />
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          ordem.estaAtrasada
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : ordem.statusPrazo === 'alerta'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {ordem.estaAtrasada
                          ? `Atrasada (${Math.abs(ordem.diasRestantes || 0)}d)`
                          : ordem.diasRestantes !== null
                          ? `${ordem.diasRestantes}d`
                          : 'Sem prazo'}
                      </span>
                    </div>
                  </Link>
                ))}

                {ordensPendentes.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-6">
                    Nenhuma ordem pendente no momento.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: RELATÓRIO DE ORDENS PENDENTES                                      */}
      {/* ========================================================================= */}
      {activeTab === 'pendentes' && (
        <div className="space-y-5">
          {/* Barra de Filtros & Ações */}
          <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por título ou técnico atribuído..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5000]"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Filter className="w-3.5 h-3.5" />
                <span>Prazo:</span>
              </div>
              <select
                value={filtroStatusPrazo}
                onChange={(e) => setFiltroStatusPrazo(e.target.value as any)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5000] text-slate-700"
              >
                <option value="todos">Todos os Prazos</option>
                <option value="atrasada">⚠️ Somente Atrasadas</option>
                <option value="alerta">⏳ Próximas do Vencimento (≤ 2 dias)</option>
                <option value="no_prazo">✅ No Prazo</option>
              </select>

              <button
                onClick={() => exportarRelatorioExcel('ativa')}
                className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                Exportar Esta Lista
              </button>
            </div>
          </div>

          {/* Tabela de Ordens Pendentes */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 px-5">Ordem de Serviço</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Data Limite & Prazo</th>
                    <th className="py-3.5 px-4">Pontos & Atividades</th>
                    <th className="py-3.5 px-4">Progresso (% Concluída)</th>
                    <th className="py-3.5 px-4">Técnicos Atribuídos</th>
                    <th className="py-3.5 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendentesFiltradas.map((ordem: any) => (
                    <tr key={ordem._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-5">
                        <Link
                          href={`/admin/ordens/${ordem._id}`}
                          className="font-bold text-sm text-slate-900 hover:text-[#FF5000] transition-colors"
                        >
                          {ordem.titulo}
                        </Link>
                        {ordem.descricao && (
                          <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                            {ordem.descricao}
                          </p>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        <span
                          className={`px-2.5 py-1 text-xs font-semibold rounded-full uppercase tracking-wider ${
                            ordem.status === 'ativa'
                              ? 'bg-orange-50 text-[#FF5000] border border-orange-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {ordem.status === 'ativa' ? 'Em Andamento' : 'Rascunho'}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-sm">
                        {ordem.dataLimite ? (
                          <div>
                            <p className="font-semibold text-slate-800 text-xs">
                              {new Date(ordem.dataLimite).toLocaleDateString('pt-BR')}
                            </p>
                            <span
                              className={`inline-block text-[11px] font-bold mt-0.5 ${
                                ordem.estaAtrasada
                                  ? 'text-red-600'
                                  : ordem.statusPrazo === 'alerta'
                                  ? 'text-amber-600'
                                  : 'text-slate-500'
                              }`}
                            >
                              {ordem.estaAtrasada
                                ? `⚠️ Atrasada há ${Math.abs(ordem.diasRestantes || 0)} dias`
                                : `${ordem.diasRestantes} dias restantes`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Sem prazo</span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-xs">
                        <div className="font-medium text-slate-700">
                          {ordem.totalPontos} pontos de parada
                        </div>
                        <div className="text-slate-400 mt-0.5">
                          {ordem.atividadesConcluidas} de {ordem.totalAtividades} atividades
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <DonutProgress percent={ordem.progresso} size={42} strokeWidth={4} />
                          <div className="w-24">
                            <div className="text-xs font-bold text-slate-800">
                              {ordem.progresso}% concluída
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
                              <div
                                className="bg-[#FF5000] h-full rounded-full"
                                style={{ width: `${ordem.progresso}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1">
                          {ordem.tecnicos.map((tec: any) => (
                            <span
                              key={tec._id}
                              className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md"
                            >
                              {tec.nome}
                            </span>
                          ))}
                          {ordem.tecnicos.length === 0 && (
                            <span className="text-xs text-slate-400 italic">
                              Não atribuído
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-4 text-right">
                        <Link
                          href={`/admin/ordens/${ordem._id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#FF5000] hover:text-[#E04700]"
                        >
                          Ver OS <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}

                  {pendentesFiltradas.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                        Nenhuma ordem de serviço pendente encontrada com os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: RELATÓRIO DE ORDENS CONCLUÍDAS                                     */}
      {/* ========================================================================= */}
      {activeTab === 'concluidas' && (
        <div className="space-y-5">
          {/* Barra de Filtros & Ações */}
          <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por título ou técnico participante..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5000]"
              />
            </div>

            <button
              onClick={() => exportarRelatorioExcel('ativa')}
              className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Exportar Esta Lista
            </button>
          </div>

          {/* Tabela de Concluídas */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 px-5">Ordem de Serviço</th>
                    <th className="py-3.5 px-4">Criada em</th>
                    <th className="py-3.5 px-4">Última Finalização</th>
                    <th className="py-3.5 px-4">Pontos Atendidos</th>
                    <th className="py-3.5 px-4">Progresso</th>
                    <th className="py-3.5 px-4">Técnicos Participantes</th>
                    <th className="py-3.5 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {concluidasFiltradas.map((ordem: any) => (
                    <tr key={ordem._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <Link
                            href={`/admin/ordens/${ordem._id}`}
                            className="font-bold text-sm text-slate-900 hover:text-[#FF5000] transition-colors"
                          >
                            {ordem.titulo}
                          </Link>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-xs text-slate-600 font-medium">
                        {ordem.dataCriacao
                          ? new Date(ordem.dataCriacao).toLocaleDateString('pt-BR')
                          : 'N/A'}
                      </td>

                      <td className="py-4 px-4 text-xs text-slate-800 font-semibold">
                        {ordem.ultimaDataConclusao
                          ? new Date(ordem.ultimaDataConclusao).toLocaleString('pt-BR', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                          : 'Concluída'}
                      </td>

                      <td className="py-4 px-4 text-xs font-semibold text-slate-700">
                        {ordem.totalPontos} pontos
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2.5">
                          <DonutProgress percent={100} size={36} strokeWidth={3.5} color="#10B981" />
                          <span className="text-xs font-bold text-emerald-700">
                            100% ({ordem.atividadesConcluidas}/{ordem.totalAtividades})
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1">
                          {ordem.tecnicos.map((tec: any) => (
                            <span
                              key={tec._id}
                              className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md"
                            >
                              {tec.nome}
                            </span>
                          ))}
                          {ordem.tecnicos.length === 0 && (
                            <span className="text-xs text-slate-400 italic">-</span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-4 text-right">
                        <Link
                          href={`/admin/ordens/${ordem._id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#FF5000] hover:text-[#E04700]"
                        >
                          Ver Detalhes <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}

                  {concluidasFiltradas.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                        Nenhuma ordem de serviço concluída encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 4: RELATÓRIO DE ATIVIDADES POR TÉCNICO COM GRÁFICOS                   */}
      {/* ========================================================================= */}
      {activeTab === 'tecnicos' && (
        <div className="space-y-6">
          {/* Barra de Filtros & Ações */}
          <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar técnico por nome ou e-mail..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5000]"
              />
            </div>

            <button
              onClick={() => exportarRelatorioExcel('ativa')}
              className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Exportar Produtividade
            </button>
          </div>

          {/* Grid de Cards de Técnicos com Gráficos de Evolução e % Concluída de Ordens em Andamento */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {tecnicosFiltrados.map((tec: any, index: number) => {
              const maxAtivs = relatorioTecnicos[0]?.totalAtividadesFeitas || 1;
              const percentualRelativo = Math.round((tec.totalAtividadesFeitas / maxAtivs) * 100);
              const temOrdensEmExecucao = tec.ordensEmAndamento && tec.ordensEmAndamento.length > 0;

              return (
                <div
                  key={tec._id}
                  className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-5"
                >
                  <div>
                    {/* Header do Card com Posição & Identificação */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-orange-100 text-[#FF5000] flex items-center justify-center font-extrabold text-base shadow-xs">
                          {tec.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-900 text-base leading-tight">
                              {tec.nome}
                            </h3>
                            {index < 3 && tec.totalAtividadesFeitas > 0 && (
                              <span className="text-base" title={`Posição #${index + 1} no ranking`}>
                                {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{tec.email}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                          Total Concluído
                        </span>
                        <span className="text-xl font-extrabold text-slate-900">
                          {tec.totalAtividadesFeitas} <span className="text-xs font-medium text-slate-500">ativ.</span>
                        </span>
                      </div>
                    </div>

                    {/* Estatísticas Chave */}
                    <div className="grid grid-cols-3 gap-2.5 my-4 p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Atividades
                        </p>
                        <p className="text-base font-extrabold text-slate-900 mt-0.5">
                          {tec.totalAtividadesFeitas}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          OS Atendidas
                        </p>
                        <p className="text-base font-extrabold text-slate-900 mt-0.5">
                          {tec.totalOrdensComAtividades}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Em Execução
                        </p>
                        <p className={`text-base font-extrabold mt-0.5 ${temOrdensEmExecucao ? 'text-[#FF5000]' : 'text-slate-900'}`}>
                          {tec.ordensEmAndamento?.length || 0}
                        </p>
                      </div>
                    </div>

                    {/* SEÇÃO 1: GRÁFICO DE EVOLUÇÃO TEMPORAL DO TÉCNICO */}
                    <div className="my-4">
                      <EvolucaoTecnicoChart evolucao={tec.evolucaoTemporal} />
                    </div>

                    {/* SEÇÃO 2: GRÁFICO DE % CONCLUÍDA DAS ORDENS QUE O TÉCNICO ESTÁ EXECUTANDO */}
                    {temOrdensEmExecucao ? (
                      <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-[#FF5000]" />
                            Ordens em Execução por este Técnico ({tec.ordensEmAndamento.length})
                          </span>
                          <span className="text-[11px] font-semibold text-slate-400">
                            % Concluída da OS
                          </span>
                        </div>

                        <div className="space-y-2.5">
                          {tec.ordensEmAndamento.map((ord: any) => (
                            <Link
                              key={ord.ordemId}
                              href={`/admin/ordens/${ord.ordemId}`}
                              className="p-3 bg-slate-50 hover:bg-orange-50/40 rounded-xl border border-slate-100 hover:border-orange-200 transition-all flex items-center justify-between gap-3 group"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-bold text-slate-900 group-hover:text-[#FF5000] transition-colors truncate">
                                    {ord.titulo}
                                  </p>
                                  {ord.estaAtrasada && (
                                    <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.2 rounded shrink-0">
                                      Atrasada
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                                  <span>{ord.totalPontos} pontos</span>
                                  <span>•</span>
                                  <span>{ord.atividadesConcluidas}/{ord.totalAtividades} concluídas na OS</span>
                                  {ord.atividadesFeitasPeloTecnico > 0 && (
                                    <span className="font-semibold text-orange-600">
                                      ({ord.atividadesFeitasPeloTecnico} feitas por ele)
                                    </span>
                                  )}
                                </p>
                              </div>

                              {/* Gráfico de Progresso Circular (% Concluída da Ordem) */}
                              <div className="shrink-0 flex items-center gap-2">
                                <DonutProgress
                                  percent={ord.progresso}
                                  size={44}
                                  strokeWidth={4.5}
                                  color={ord.progresso === 100 ? '#10B981' : '#FF5000'}
                                />
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400 italic">
                        <CheckCircle2 className="w-4 h-4 text-slate-300" />
                        Nenhuma ordem pendente atribuída a este técnico no momento.
                      </div>
                    )}
                  </div>

                  {/* Footer do Card com Contato & Botão para Modal */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-[11px] text-slate-400">
                      {tec.ultimaAtividadeEm ? (
                        <span>
                          Último registro: {new Date(tec.ultimaAtividadeEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      ) : (
                        <span>Sem atividade recente</span>
                      )}
                    </div>

                    <button
                      onClick={() => setTecnicoModal(tec)}
                      className="py-2 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Histórico Completo
                    </button>
                  </div>
                </div>
              );
            })}

            {tecnicosFiltrados.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-400 text-sm bg-white rounded-2xl border border-dashed border-slate-200">
                Nenhum técnico encontrado.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: HISTÓRICO DETALHADO DE ATIVIDADES DO TÉCNICO COM GRÁFICOS          */}
      {/* ========================================================================= */}
      {tecnicoModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-orange-100 text-[#FF5000] flex items-center justify-center font-extrabold">
                  {tecnicoModal.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {tecnicoModal.nome}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {tecnicoModal.email} • {tecnicoModal.totalAtividadesFeitas} atividade(s) concluída(s)
                  </p>
                </div>
              </div>

              <button
                onClick={() => setTecnicoModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Corpo com Gráfico de Evolução e Lista de Atividades */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* Gráfico de Evolução no Modal */}
              <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                <EvolucaoTecnicoChart evolucao={tecnicoModal.evolucaoTemporal} />
              </div>

              {/* Ordens em Execução no Modal com Gráfico de % Concluída */}
              {tecnicoModal.ordensEmAndamento?.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-[#FF5000]" />
                    Ordens em Execução
                  </h4>
                  <div className="space-y-2">
                    {tecnicoModal.ordensEmAndamento.map((ord: any) => (
                      <Link
                        key={ord.ordemId}
                        href={`/admin/ordens/${ord.ordemId}`}
                        className="p-3 bg-white rounded-xl border border-slate-200 hover:border-orange-300 transition-all flex items-center justify-between gap-3 group"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 group-hover:text-[#FF5000] truncate">
                            {ord.titulo}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {ord.atividadesConcluidas}/{ord.totalAtividades} atividades totais da OS
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <DonutProgress percent={ord.progresso} size={38} strokeWidth={4} />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Lista Detalhada de Atividades Concluídas */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Histórico de Atividades Realizadas ({tecnicoModal.atividades?.length || 0})
                </h4>

                <div className="space-y-2.5">
                  {tecnicoModal.atividades?.map((ativ: any) => (
                    <div
                      key={ativ._id}
                      className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 font-semibold text-xs text-slate-900">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>{ativ.descricao}</span>
                        </div>
                        {ativ.concluidaEm && (
                          <span className="text-[10px] font-bold text-slate-500 shrink-0 bg-white px-2 py-0.5 rounded border border-slate-200">
                            {new Date(ativ.concluidaEm).toLocaleString('pt-BR', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-y-1 gap-x-2 pl-5.5">
                        <span className="font-semibold text-slate-700">
                          OS: {ativ.ordemTitulo}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          Ponto #{ativ.pontoNumero} - {ativ.pontoEndereco}
                        </span>
                      </div>

                      {ativ.observacao && (
                        <div className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-100 mt-1.5 ml-5.5 italic">
                          &ldquo;{ativ.observacao}&rdquo;
                        </div>
                      )}
                    </div>
                  ))}

                  {(!tecnicoModal.atividades || tecnicoModal.atividades.length === 0) && (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      Nenhuma atividade registrada como concluída por este técnico até o momento.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end">
              <button
                onClick={() => setTecnicoModal(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
