'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useRouter } from 'next/navigation';
import { 
  FileSpreadsheet, 
  Search, 
  Filter, 
  CheckSquare, 
  Square, 
  Sparkles, 
  Plus, 
  MapPin, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Loader2, 
  Check, 
  Upload, 
  Download, 
  Navigation,
  Layers,
  Building2,
  Calendar,
  Zap,
  Info
} from 'lucide-react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { Id } from '@convex/_generated/dataModel';

export interface PontoBase {
  id: string;
  numeroEletro: string;
  numeroParada: string;
  rota: string;
  ordem: number;
  semana: string;
  area: string;
  bairro: string;
  endereco: string;
  latitude?: number;
  longitude?: number;
  filial: string;
  modelo: string;
  tipo: 'totem' | 'abrigo' | 'outro';
}

const CHECKLIST_PREVENTIVA_PADRAO = [
  'Manutenção Preventiva do Endereço/Ponto'
];

export default function BasePreventivaPage() {
  const router = useRouter();
  const tecnicos = useQuery(api.tecnicos.list, {}) || [];
  const createOrdemComPontos = useMutation(api.ordensServico.createOrdemComPontos);

  const [pontos, setPontos] = useState<PontoBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorCarregamento, setErrorCarregamento] = useState<string | null>(null);

  // Filtros
  const [filtroSemana, setFiltroSemana] = useState<string>('todas');
  const [filtroArea, setFiltroArea] = useState<string>('todas');
  const [filtroFilial, setFiltroFilial] = useState<string>('todas');
  const [filtroRota, setFiltroRota] = useState<string>('todas');
  const [filtroBairro, setFiltroBairro] = useState<string>('todos');
  const [filtroModelo, setFiltroModelo] = useState<string>('todos');
  const [buscaTexto, setBuscaTexto] = useState<string>('');

  // Ordenação
  const [campoOrdenacao, setCampoOrdenacao] = useState<keyof PontoBase>('ordem');
  const [direcaoOrdenacao, setDirecaoOrdenacao] = useState<'asc' | 'desc'>('asc');

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(50);

  // Seleção de linhas (estilo Excel)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal de Criação de OS
  const [modalCriarOS, setModalCriarOS] = useState(false);
  const [salvandoOS, setSalvandoOS] = useState(false);
  const [formOS, setFormOS] = useState({
    titulo: '',
    descricao: '',
    dataLimite: '',
    status: 'rascunho' as 'rascunho' | 'ativa',
    tecnicosIds: [] as string[],
    atividades: CHECKLIST_PREVENTIVA_PADRAO,
  });

  const [buscaTecnicoModal, setBuscaTecnicoModal] = useState('');

  // Filtragem de técnicos no modal
  const tecnicosFiltradosModal = useMemo(() => {
    if (!buscaTecnicoModal.trim()) return tecnicos;
    const q = buscaTecnicoModal.toLowerCase().trim();
    return tecnicos.filter((t: any) => 
      t.nome.toLowerCase().includes(q) || 
      (t.email && t.email.toLowerCase().includes(q))
    );
  }, [tecnicos, buscaTecnicoModal]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Carregar base inicial pré-indexada
  useEffect(() => {
    async function carregarBase() {
      try {
        setLoading(true);
        const res = await fetch('/data/base_preventivas.json');
        if (!res.ok) {
          throw new Error('Não foi possível carregar a base pré-indexada.');
        }
        const data: PontoBase[] = await res.json();
        setPontos(data);
      } catch (err: any) {
        console.error('Erro ao carregar base inicial:', err);
        setErrorCarregamento('A base ainda não foi carregada. Faça upload do arquivo BASE PREVENTIVAS.xlsx para começar.');
      } finally {
        setLoading(false);
      }
    }

    carregarBase();
  }, []);

  // Opções únicas para os dropdowns
  const semanasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    pontos.forEach(p => { if (p.semana) set.add(p.semana); });
    return Array.from(set).sort();
  }, [pontos]);

  const areasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    pontos.forEach(p => { if (p.area) set.add(p.area); });
    return Array.from(set).sort();
  }, [pontos]);

  const filiaisDisponiveis = useMemo(() => {
    const set = new Set<string>();
    pontos.forEach(p => { if (p.filial) set.add(p.filial); });
    return Array.from(set).sort();
  }, [pontos]);

  const rotasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    pontos.forEach(p => {
      // Filtrar rotas com base na área/semana selecionada para facilitar
      if (filtroSemana !== 'todas' && p.semana !== filtroSemana) return;
      if (filtroArea !== 'todas' && p.area !== filtroArea) return;
      if (p.rota && p.rota !== 'SEM_ROTA') set.add(p.rota);
    });
    return Array.from(set).sort();
  }, [pontos, filtroSemana, filtroArea]);

  const bairrosDisponiveis = useMemo(() => {
    const set = new Set<string>();
    pontos.forEach(p => {
      if (filtroArea !== 'todas' && p.area !== filtroArea) return;
      if (p.bairro) set.add(p.bairro);
    });
    return Array.from(set).sort();
  }, [pontos, filtroArea]);

  const modelosDisponiveis = useMemo(() => {
    const set = new Set<string>();
    pontos.forEach(p => { if (p.modelo && p.modelo !== '-') set.add(p.modelo); });
    return Array.from(set).sort();
  }, [pontos]);

  // Filtragem dos pontos
  const pontosFiltrados = useMemo(() => {
    const query = buscaTexto.toLowerCase().trim();

    return pontos.filter(p => {
      if (filtroSemana !== 'todas' && p.semana !== filtroSemana) return false;
      if (filtroArea !== 'todas' && p.area !== filtroArea) return false;
      if (filtroFilial !== 'todas' && p.filial !== filtroFilial) return false;
      if (filtroRota !== 'todas' && p.rota !== filtroRota) return false;
      if (filtroBairro !== 'todos' && p.bairro !== filtroBairro) return false;
      if (filtroModelo !== 'todos' && p.modelo !== filtroModelo) return false;

      if (query) {
        const matchEnd = p.endereco.toLowerCase().includes(query);
        const matchEletro = p.numeroEletro.toLowerCase().includes(query);
        const matchParada = p.numeroParada.toLowerCase().includes(query);
        const matchRota = p.rota.toLowerCase().includes(query);
        const matchBairro = p.bairro.toLowerCase().includes(query);
        if (!matchEnd && !matchEletro && !matchParada && !matchRota && !matchBairro) {
          return false;
        }
      }

      return true;
    });
  }, [pontos, filtroSemana, filtroArea, filtroFilial, filtroRota, filtroBairro, filtroModelo, buscaTexto]);

  // Ordenação dos pontos filtrados
  const pontosOrdenados = useMemo(() => {
    const lista = [...pontosFiltrados];
    lista.sort((a, b) => {
      let valA = a[campoOrdenacao];
      let valB = b[campoOrdenacao];

      if (typeof valA === 'number' && typeof valB === 'number') {
        return direcaoOrdenacao === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA || '');
      const strB = String(valB || '');
      return direcaoOrdenacao === 'asc' 
        ? strA.localeCompare(strB, 'pt-BR', { numeric: true }) 
        : strB.localeCompare(strA, 'pt-BR', { numeric: true });
    });
    return lista;
  }, [pontosFiltrados, campoOrdenacao, direcaoOrdenacao]);

  // Paginação
  const totalPaginas = Math.ceil(pontosOrdenados.length / itensPorPagina) || 1;
  const pontosPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    return pontosOrdenados.slice(inicio, inicio + itensPorPagina);
  }, [pontosOrdenados, paginaAtual, itensPorPagina]);

  // Resetar página quando filtros mudarem
  useEffect(() => {
    setPaginaAtual(1);
  }, [filtroSemana, filtroArea, filtroFilial, filtroRota, filtroBairro, filtroModelo, buscaTexto, itensPorPagina]);

  // Controles de seleção
  const toggleSelectPoint = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(pontosFiltrados.map(p => p.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const toggleSort = (campo: keyof PontoBase) => {
    if (campoOrdenacao === campo) {
      setDirecaoOrdenacao(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setCampoOrdenacao(campo);
      setDirecaoOrdenacao('asc');
    }
  };

  // Upload dinâmico de nova planilha
  const handleUploadNovaPlanilha = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheetName = wb.SheetNames.includes('BASE') ? 'BASE' : wb.SheetNames[0];
      const rawData: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });

      const parsed: PontoBase[] = rawData.map((row, idx) => {
        const eletro = String(row['Nº Eletro'] || row['N° Eletro'] || row['Eletro'] || '').trim();
        const parada = String(row['Nº Parada'] || row['N° Parada'] || row['Parada'] || '').trim();
        const modelo = String(row['Modelo de Abrigo'] || row['Modelo'] || '').trim();
        const lat = typeof row['Latitude'] === 'number' ? row['Latitude'] : (parseFloat(String(row['Latitude'] || '').replace(',', '.')) || undefined);
        const lng = typeof row['Longitude'] === 'number' ? row['Longitude'] : (parseFloat(String(row['Longitude'] || '').replace(',', '.')) || undefined);

        return {
          id: String(idx + 1),
          numeroEletro: eletro,
          numeroParada: parada,
          rota: String(row['ROTA'] || row['Rota'] || 'SEM_ROTA').trim(),
          ordem: typeof row['ORDEM'] === 'number' ? row['ORDEM'] : (parseInt(row['ORDEM'] || row['Ordem'], 10) || (idx + 1)),
          semana: String(row['SEMANA'] || row['Semana'] || '').trim(),
          area: String(row['Área de Trabalho'] || row['Area de Trabalho'] || row['Área'] || row['Area'] || row['Região'] || '').trim(),
          bairro: String(row['Bairro'] || '').trim(),
          endereco: String(row['Endereço'] || row['Endereco'] || `Ponto ${idx + 1}`).trim(),
          latitude: lat,
          longitude: lng,
          filial: String(row['Filial'] || '').trim(),
          modelo: modelo,
          tipo: (modelo.toLowerCase().includes('totem') || eletro.startsWith('T')) ? 'totem' : 'abrigo',
        };
      });

      setPontos(parsed);
      setSelectedIds(new Set());
      setErrorCarregamento(null);
      alert(`Planilha carregada com sucesso! ${parsed.length} pontos importados.`);
    } catch (err: any) {
      alert(`Erro ao processar planilha: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Preparar e abrir modal de criação de OS com os selecionados
  const handleAbrirModalCriarOS = () => {
    if (selectedIds.size === 0) return;

    const pontosSelecionados = pontos.filter(p => selectedIds.has(p.id));
    
    // Sugerir título inteligente
    const rotas = Array.from(new Set(pontosSelecionados.map(p => p.rota).filter(r => r && r !== 'SEM_ROTA')));
    const bairros = Array.from(new Set(pontosSelecionados.map(p => p.bairro).filter(Boolean)));
    const semanas = Array.from(new Set(pontosSelecionados.map(p => p.semana).filter(Boolean)));

    let tituloSugerido = '';
    if (rotas.length === 1) {
      const r = rotas[0];
      const b = bairros[0] || '';
      const s = semanas[0] ? ` (${semanas[0]})` : '';
      tituloSugerido = `Preventiva - ${r} - ${b}${s} (${pontosSelecionados.length} pontos)`;
    } else if (bairros.length === 1) {
      tituloSugerido = `Preventiva - ${bairros[0]} (${pontosSelecionados.length} pontos)`;
    } else {
      tituloSugerido = `Manutenção Preventiva - ${pontosSelecionados.length} pontos selecionados`;
    }

    setFormOS({
      titulo: tituloSugerido,
      descricao: `Ordem de serviço preventiva gerada diretamente da Planilha Base com ${pontosSelecionados.length} endereços selecionados.`,
      dataLimite: '',
      status: 'rascunho',
      tecnicosIds: [],
      atividades: CHECKLIST_PREVENTIVA_PADRAO,
    });

    setModalCriarOS(true);
  };

  // Confirmar criação da OS no Convex
  const handleConfirmarCriacaoOS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formOS.titulo.trim()) {
      alert('Informe o título da Ordem de Serviço.');
      return;
    }

    const pontosSelecionados = pontos
      .filter(p => selectedIds.has(p.id))
      .sort((a, b) => a.ordem - b.ordem);

    if (pontosSelecionados.length === 0) return;

    try {
      setSalvandoOS(true);

      const payloadPontos = pontosSelecionados.map((p, idx) => {
        let numeroPonto = '';
        if (p.numeroEletro && p.numeroParada) {
          numeroPonto = `${p.numeroEletro} (${p.numeroParada})`;
        } else if (p.numeroEletro) {
          numeroPonto = p.numeroEletro;
        } else if (p.numeroParada) {
          numeroPonto = p.numeroParada;
        } else {
          numeroPonto = `P-${idx + 1}`;
        }

        const partesRef: string[] = [];
        if (p.bairro) partesRef.push(p.bairro);
        if (p.area) partesRef.push(p.area);
        if (p.filial && p.filial !== p.area) partesRef.push(p.filial);
        if (p.semana) partesRef.push(p.semana);

        return {
          numeroPonto,
          numeroEletro: p.numeroEletro || undefined,
          numeroParada: p.numeroParada || undefined,
          rota: p.rota || undefined,
          modelo: p.modelo || undefined,
          endereco: p.endereco,
          referencia: partesRef.join(' • '),
          tipo: p.tipo,
          latitude: p.latitude,
          longitude: p.longitude,
          ordem: idx + 1,
        };
      });

      const ordemId = await createOrdemComPontos({
        titulo: formOS.titulo.trim(),
        descricao: formOS.descricao.trim() || undefined,
        dataLimite: formOS.dataLimite || undefined,
        status: formOS.status,
        tecnicosIds: formOS.tecnicosIds.map(id => id as Id<"tecnicos">),
        atividadesPadrao: formOS.atividades,
        pontos: payloadPontos,
      });

      setModalCriarOS(false);
      clearSelection();
      router.push(`/admin/ordens/${ordemId}`);
    } catch (err: any) {
      console.error('Erro ao criar OS:', err);
      alert(`Erro ao criar OS: ${err.message || 'Tente novamente'}`);
    } finally {
      setSalvandoOS(false);
    }
  };

  const isAllFilteredSelected = pontosFiltrados.length > 0 && pontosFiltrados.every(p => selectedIds.has(p.id));

  return (
    <div className="space-y-6">
      {/* Header Principal */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Planilha Base de Preventivas
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Visualize toda a base de mobiliário, filtre rotas e gere Ordens de Serviço diretamente no site
              </p>
            </div>
          </div>
        </div>

        {/* Ações do Topo */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
            title="Carregar nova planilha .xlsx para atualizar a base"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Atualizar Base (.xlsx)</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleUploadNovaPlanilha}
            className="hidden"
          />

          <Link
            href="/admin/ordens/nova"
            className="px-4 py-2 bg-[#FF5000] hover:bg-[#E04700] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nova OS Manual</span>
          </Link>
        </div>
      </div>

      {/* Cards de Métricas / Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total de Pontos</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">
            {pontos.length.toLocaleString('pt-BR')}
          </p>
          <span className="text-[11px] text-emerald-600 font-semibold">100% integrados</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rotas Ativas</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">
            {rotasDisponiveis.length}
          </p>
          <span className="text-[11px] text-slate-400 font-medium">Ciclos de 1ª a 7ª sem.</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filtrados na Tela</p>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1">
            {pontosFiltrados.length.toLocaleString('pt-BR')}
          </p>
          <span className="text-[11px] text-slate-500 font-medium">Prontos para seleção</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Selecionados</p>
          <p className="text-2xl font-extrabold text-[#FF5000] mt-1">
            {selectedIds.size.toLocaleString('pt-BR')}
          </p>
          <span className="text-[11px] text-slate-500 font-medium">Para criar nova OS</span>
        </div>
      </div>

      {/* PAINEL DE FILTROS ESTILO PLANILHA */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#FF5000]" />
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              Filtros da Planilha
            </h3>
          </div>
          {(filtroSemana !== 'todas' || filtroArea !== 'todas' || filtroFilial !== 'todas' || filtroRota !== 'todas' || filtroBairro !== 'todos' || filtroModelo !== 'todos' || buscaTexto) && (
            <button
              type="button"
              onClick={() => {
                setFiltroSemana('todas');
                setFiltroArea('todas');
                setFiltroFilial('todas');
                setFiltroRota('todas');
                setFiltroBairro('todos');
                setFiltroModelo('todos');
                setBuscaTexto('');
              }}
              className="text-xs text-[#FF5000] font-bold hover:underline cursor-pointer"
            >
              Limpar Filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Busca Livre */}
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Buscar Endereço / Código
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Logradouro, A02561, 820012561..."
                value={buscaTexto}
                onChange={(e) => setBuscaTexto(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>
          </div>

          {/* Filtro Semana */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Ciclo / Semana
            </label>
            <select
              value={filtroSemana}
              onChange={(e) => setFiltroSemana(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="todas">Todas as Semanas</option>
              {semanasDisponiveis.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Filtro Área */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Região / Área
            </label>
            <select
              value={filtroArea}
              onChange={(e) => setFiltroArea(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="todas">Todas as Regiões</option>
              {areasDisponiveis.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Filtro Rota */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Rota ({rotasDisponiveis.length})
            </label>
            <select
              value={filtroRota}
              onChange={(e) => setFiltroRota(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="todas">Todas as Rotas</option>
              {rotasDisponiveis.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Filtro Bairro */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Bairro
            </label>
            <select
              value={filtroBairro}
              onChange={(e) => setFiltroBairro(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="todos">Todos os Bairros</option>
              {bairrosDisponiveis.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* TABELA DE DADOS INTERATIVA (PLANILHA NATIVA) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Barra superior da tabela */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => isAllFilteredSelected ? clearSelection() : selectAllFiltered()}
              className="text-xs font-bold text-slate-800 flex items-center gap-2 hover:text-emerald-700 cursor-pointer"
            >
              {isAllFilteredSelected ? (
                <CheckSquare className="w-4 h-4 text-emerald-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>
                {isAllFilteredSelected
                  ? 'Desmarcar todos'
                  : `Selecionar todos os ${pontosFiltrados.length.toLocaleString('pt-BR')} filtrados`}
              </span>
            </button>

            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={clearSelection}
                className="text-xs text-slate-500 hover:text-red-600 underline font-medium cursor-pointer"
              >
                Limpar seleção ({selectedIds.size})
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>Mostrar por página:</span>
            <select
              value={itensPorPagina}
              onChange={(e) => setItensPorPagina(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold outline-none"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
            </select>
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
              <p className="text-sm font-bold text-slate-700">Carregando planilha base interativa...</p>
            </div>
          ) : pontosFiltrados.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-2">
              <p className="text-base font-bold text-slate-700">Nenhum ponto encontrado para estes filtros.</p>
              <p className="text-xs text-slate-400">Tente ajustar a rota, região ou termo de busca.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 select-none">
                <tr>
                  <th className="py-3 px-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllFilteredSelected}
                      onChange={() => isAllFilteredSelected ? clearSelection() : selectAllFiltered()}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                    />
                  </th>
                  <th 
                    onClick={() => toggleSort('ordem')}
                    className="py-3 px-3 cursor-pointer hover:bg-slate-200/70 transition-colors w-16"
                  >
                    <div className="flex items-center gap-1">
                      <span>#</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th 
                    onClick={() => toggleSort('numeroEletro')}
                    className="py-3 px-3 cursor-pointer hover:bg-slate-200/70 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Nº Eletro</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th 
                    onClick={() => toggleSort('numeroParada')}
                    className="py-3 px-3 cursor-pointer hover:bg-slate-200/70 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Nº Parada</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th 
                    onClick={() => toggleSort('rota')}
                    className="py-3 px-3 cursor-pointer hover:bg-slate-200/70 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Rota</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th 
                    onClick={() => toggleSort('endereco')}
                    className="py-3 px-3 cursor-pointer hover:bg-slate-200/70 transition-colors min-w-[240px]"
                  >
                    <div className="flex items-center gap-1">
                      <span>Endereço</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th 
                    onClick={() => toggleSort('bairro')}
                    className="py-3 px-3 cursor-pointer hover:bg-slate-200/70 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Bairro</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th 
                    onClick={() => toggleSort('area')}
                    className="py-3 px-3 cursor-pointer hover:bg-slate-200/70 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Área / Região</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th 
                    onClick={() => toggleSort('semana')}
                    className="py-3 px-3 cursor-pointer hover:bg-slate-200/70 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Ciclo</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th 
                    onClick={() => toggleSort('modelo')}
                    className="py-3 px-3 cursor-pointer hover:bg-slate-200/70 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Modelo</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center">GPS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {pontosPaginados.map((p) => {
                  const isSelected = selectedIds.has(p.id);

                  return (
                    <tr 
                      key={p.id}
                      onClick={() => toggleSelectPoint(p.id)}
                      className={`hover:bg-slate-50/90 transition-colors cursor-pointer ${
                        isSelected ? 'bg-orange-50/50 font-medium' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectPoint(p.id)}
                          className="w-4 h-4 text-[#FF5000] rounded focus:ring-[#FF5000] accent-[#FF5000] cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono font-medium">
                        {p.ordem}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {p.numeroEletro || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {p.numeroParada || '-'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold rounded-md font-mono">
                          {p.rota}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 max-w-[280px] truncate" title={p.endereco}>
                        {p.endereco}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {p.bairro || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {p.area || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 font-medium">
                        {p.semana || '-'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.tipo === 'totem' 
                            ? 'bg-orange-100 text-[#FF5000]' 
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {p.modelo || (p.tipo === 'totem' ? 'Totem' : 'Abrigo')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        {p.latitude && p.longitude ? (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-slate-400 hover:text-[#FF5000] inline-block transition-colors"
                            title={`Abrir Maps (${p.latitude}, ${p.longitude})`}
                          >
                            <Navigation className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Rodapé de Paginação */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-500">
          <p>
            Mostrando <strong>{((paginaAtual - 1) * itensPorPagina) + 1}</strong> a <strong>{Math.min(paginaAtual * itensPorPagina, pontosOrdenados.length)}</strong> de <strong>{pontosOrdenados.length.toLocaleString('pt-BR')}</strong> pontos
          </p>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={paginaAtual === 1}
              onClick={() => setPaginaAtual(prev => Math.max(1, prev - 1))}
              className="p-1.5 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-800">
              Página {paginaAtual} de {totalPaginas}
            </span>
            <button
              type="button"
              disabled={paginaAtual === totalPaginas}
              onClick={() => setPaginaAtual(prev => Math.min(totalPaginas, prev + 1))}
              className="p-1.5 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-30 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* BARRA FLUTUANTE DE AÇÃO (CRIAÇÃO DIRETA DE OS) */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-3xl bg-slate-900 text-white p-4 rounded-2xl shadow-2xl z-40 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="w-10 h-10 bg-[#FF5000] text-white rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0">
              {selectedIds.size}
            </div>
            <div>
              <p className="font-bold text-sm text-white">
                {selectedIds.size} endereço{selectedIds.size > 1 ? 's' : ''} selecionado{selectedIds.size > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-slate-400">
                Pronto para gerar a Ordem de Serviço sem usar o Excel
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={clearSelection}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer w-full sm:w-auto"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAbrirModalCriarOS}
              className="px-5 py-2.5 bg-[#FF5000] hover:bg-[#E04700] text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30 transition-all cursor-pointer w-full sm:w-auto"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>⚡ Criar Ordem de Serviço</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO & CRIAÇÃO DIRETA DE OS */}
      {modalCriarOS && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-orange-100 text-[#FF5000] rounded-xl">
                  <Zap className="w-5 h-5 fill-[#FF5000]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Criar Ordem de Serviço Direta</h2>
                  <p className="text-xs text-slate-500">
                    Gerando OS com {selectedIds.size} ponto{selectedIds.size > 1 ? 's' : ''} selecionados da Planilha Base
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setModalCriarOS(false)}
                className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleConfirmarCriacaoOS} className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Título da Ordem de Serviço *
                </label>
                <input
                  required
                  type="text"
                  value={formOS.titulo}
                  onChange={(e) => setFormOS({ ...formOS, titulo: e.target.value })}
                  placeholder="Ex: Preventiva - RT-FL-001 - TATUAPÉ"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#FF5000] font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Instruções para Campo / Descrição
                </label>
                <textarea
                  value={formOS.descricao}
                  onChange={(e) => setFormOS({ ...formOS, descricao: e.target.value })}
                  placeholder="Orientações e especificações técnicas para os operadores..."
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-[#FF5000] h-20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Data Limite de Conclusão
                  </label>
                  <input
                    type="date"
                    value={formOS.dataLimite}
                    onChange={(e) => setFormOS({ ...formOS, dataLimite: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#FF5000]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Status da Ordem
                  </label>
                  <select
                    value={formOS.status}
                    onChange={(e) => setFormOS({ ...formOS, status: e.target.value as any })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#FF5000] bg-white"
                  >
                    <option value="rascunho">Rascunho (Salvar para revisar depois)</option>
                    <option value="ativa">Ativa / Em Andamento (Liberar para campo)</option>
                  </select>
                </div>
              </div>

              {/* Atribuir Técnico */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Atribuir Técnico de Campo (Opcional)
                  </label>
                  {formOS.tecnicosIds.length > 0 && (
                    <span className="text-[11px] font-bold text-[#FF5000] bg-orange-50 px-2 py-0.5 rounded-full">
                      {formOS.tecnicosIds.length} selecionado(s)
                    </span>
                  )}
                </div>

                {/* Campo de pesquisa de técnico */}
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Pesquisar técnico por nome ou e-mail..."
                    value={buscaTecnicoModal}
                    onChange={(e) => setBuscaTecnicoModal(e.target.value)}
                    className="w-full pl-8 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-[#FF5000] transition-all font-medium"
                  />
                  {buscaTecnicoModal && (
                    <button
                      type="button"
                      onClick={() => setBuscaTecnicoModal('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-sm font-bold p-1 cursor-pointer"
                      title="Limpar pesquisa"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="border border-slate-200 rounded-xl p-2.5 max-h-40 overflow-y-auto space-y-1.5 bg-slate-50/50">
                  {tecnicosFiltradosModal.map((tec: any) => {
                    const isSelected = formOS.tecnicosIds.includes(tec._id);
                    return (
                      <label 
                        key={tec._id} 
                        className={`flex items-center gap-2.5 p-2 rounded-lg border transition-colors cursor-pointer ${
                          isSelected 
                            ? 'bg-orange-50/70 border-orange-200' 
                            : 'bg-white border-slate-200/70 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setFormOS(prev => ({
                              ...prev,
                              tecnicosIds: isSelected
                                ? prev.tecnicosIds.filter(id => id !== tec._id)
                                : [...prev.tecnicosIds, tec._id]
                            }));
                          }}
                          className="w-4 h-4 text-[#FF5000] rounded focus:ring-[#FF5000] accent-[#FF5000] cursor-pointer"
                        />
                        <div className="flex-1">
                          <p className="font-bold text-xs text-slate-800">{tec.nome}</p>
                          <p className="text-[11px] text-slate-400">{tec.email}</p>
                        </div>
                      </label>
                    );
                  })}

                  {tecnicosFiltradosModal.length === 0 && (
                    <p className="text-xs text-slate-400 italic text-center py-3">
                      Nenhum técnico encontrado para "{buscaTecnicoModal}".
                    </p>
                  )}

                  {tecnicos.length === 0 && (
                    <p className="text-xs text-slate-400 italic text-center py-2">
                      Nenhum técnico cadastrado ainda.
                    </p>
                  )}
                </div>
              </div>

              {/* Checklist Preventivo */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Checklist de Manutenção Preventiva
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {formOS.atividades.map((ativ, i) => (
                    <span 
                      key={i}
                      className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-medium rounded-lg shadow-2xs"
                    >
                      ✓ {ativ}
                    </span>
                  ))}
                </div>
              </div>

              {/* Rodapé do Modal */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalCriarOS(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Voltar para a Planilha
                </button>

                <button
                  type="submit"
                  disabled={salvandoOS}
                  className="px-6 py-2.5 bg-[#FF5000] hover:bg-[#E04700] text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {salvandoOS ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-white" />}
                  <span>{salvandoOS ? 'Criando Ordem...' : `Confirmar e Criar OS (${selectedIds.size} pontos)`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
