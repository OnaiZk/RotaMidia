'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ArrowLeft, Loader2, FileSpreadsheet, MapPin, Search, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { Id } from '@convex/_generated/dataModel';
import ImportarPlanilha, { PontoImportado } from '@/components/importar-planilha';

export default function NovaOrdemPage() {
  const router = useRouter();
  const tecnicos = useQuery(api.tecnicos.list, {}) || [];
  
  const createOrdem = useMutation(api.ordensServico.create);
  const createPonto = useMutation(api.pontos.create);
  const createAtividadesBatch = useMutation(api.atividades.createBatch);
  const createAtribuicao = useMutation(api.atribuicoes.create);
  
  const [salvando, setSalvando] = useState(false);
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    dataLimite: '',
  });

  const [pontos, setPontos] = useState<PontoImportado[]>([
    { endereco: '', numeroPonto: '', referencia: '', tipo: 'abrigo' }
  ]);

  const [atividadesPadrao, setAtividadesPadrao] = useState<string[]>([
    'Limpeza geral', 'Verificar iluminação', 'Verificar estrutura', 'Verificar sinalização'
  ]);
  const [tecnicosSelecionados, setTecnicosSelecionados] = useState<string[]>([]);
  const [buscaTecnico, setBuscaTecnico] = useState('');
  const [atividadesExpanded, setAtividadesExpanded] = useState(true);
  const [pontosExpanded, setPontosExpanded] = useState(true);

  const sugestoesAtividades = [
    'Limpeza geral', 'Verificar iluminação', 'Verificar estrutura', 
    'Verificar sinalização', 'Verificar vidros', 'Verificar banco/assento', 
    'Verificar cobertura', 'Verificar painel de informações'
  ];

  const handleImportarPlanilha = (pontosImportados: PontoImportado[], atividadesImportadas: string[]) => {
    if (pontosImportados.length > 0) {
      setPontos(pontosImportados);
      
      // Se não tinha título, sugerir um
      if (!formData.titulo.trim()) {
        const primeiroBairro = pontosImportados[0]?.referencia;
        setFormData(prev => ({
          ...prev,
          titulo: primeiroBairro 
            ? `Manutenção - ${primeiroBairro} (${pontosImportados.length} pontos)`
            : `Ordem de Serviço - ${pontosImportados.length} pontos`
        }));
      }
    }

    if (atividadesImportadas.length > 0) {
      // Mesclar atividades novas sem duplicar
      setAtividadesPadrao(prev => {
        const set = new Set([...prev, ...atividadesImportadas]);
        return Array.from(set);
      });
    }
  };

  const toggleAtividade = (atividade: string) => {
    setAtividadesPadrao(prev => 
      prev.includes(atividade) 
        ? prev.filter(a => a !== atividade)
        : [...prev, atividade]
    );
  };

  const toggleTecnico = (id: string) => {
    setTecnicosSelecionados(prev => 
      prev.includes(id)
        ? prev.filter(t => t !== id)
        : [...prev, id]
    );
  };

  const addPonto = () => {
    setPontos([...pontos, { endereco: '', numeroPonto: '', referencia: '', tipo: 'abrigo' }]);
  };

  const removePonto = (index: number) => {
    setPontos(pontos.filter((_, i) => i !== index));
  };

  const handlePontoChange = (index: number, field: keyof PontoImportado, value: string) => {
    const newPontos = [...pontos];
    newPontos[index] = { ...newPontos[index], [field]: value };
    setPontos(newPontos);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titulo.trim()) return;

    try {
      setSalvando(true);

      // 1. Criar Ordem de Serviço
      const ordemId = await createOrdem({
        titulo: formData.titulo.trim(),
        descricao: formData.descricao.trim() || undefined,
        dataLimite: formData.dataLimite || undefined,
      });

      // 2. Criar Pontos e suas Atividades
      for (let i = 0; i < pontos.length; i++) {
        const p = pontos[i];
        if (!p.endereco.trim()) continue;

        const pontoId = await createPonto({
          ordemServicoId: ordemId,
          numeroPonto: p.numeroPonto.trim() || `P-${i + 1}`,
          endereco: p.endereco.trim(),
          referencia: p.referencia.trim() || undefined,
          tipo: p.tipo,
          latitude: p.latitude,
          longitude: p.longitude,
          ordem: i + 1,
        });

        // Criar atividades para o ponto
        if (atividadesPadrao.length > 0) {
          await createAtividadesBatch({
            pontoId,
            atividades: atividadesPadrao.map(desc => ({ descricao: desc })),
          });
        }
      }

      // 3. Atribuir Técnicos
      for (const tecId of tecnicosSelecionados) {
        await createAtribuicao({
          ordemServicoId: ordemId,
          tecnicoId: tecId as Id<"tecnicos">,
        });
      }

      router.push(`/admin/ordens/${ordemId}`);
    } catch (error) {
      console.error('Erro ao criar ordem:', error);
      alert('Ocorreu um erro ao salvar a ordem de serviço.');
      setSalvando(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/ordens" className="text-slate-500 hover:text-slate-900">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Nova Ordem de Serviço</h1>
            <p className="text-xs text-slate-500">Crie manualmente ou importe uma planilha Excel</p>
          </div>
        </div>

        {/* Botão de Importação no Header */}
        <ImportarPlanilha onImportar={handleImportarPlanilha} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Informações Gerais */}
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200/80 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">Informações Gerais</h2>
          
          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Título da Ordem *</label>
              <input 
                required
                type="text" 
                placeholder="Ex: Manutenção Preventiva - Rota Jaraguá / São Domingos"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-[#FF5000] focus:border-[#FF5000] text-sm outline-none"
                value={formData.titulo}
                onChange={e => setFormData({...formData, titulo: e.target.value})}
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Descrição / Instruções para Campo</label>
              <textarea 
                placeholder="Instruções e orientações técnicas para os operadores executarem em campo..."
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-[#FF5000] focus:border-[#FF5000] h-24 text-sm outline-none"
                value={formData.descricao}
                onChange={e => setFormData({...formData, descricao: e.target.value})}
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Data Limite para Conclusão</label>
              <input 
                type="date" 
                className="w-full md:w-1/3 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-[#FF5000] focus:border-[#FF5000] text-sm outline-none"
                value={formData.dataLimite}
                onChange={e => setFormData({...formData, dataLimite: e.target.value})}
              />
            </div>
          </div>
        </div>

        {/* Pontos de Parada */}
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200/80 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Pontos de Parada ({pontos.length})</h2>
              <p className="text-xs text-slate-400">Locais onde as atividades serão executadas em campo</p>
            </div>
            <div className="flex items-center gap-2">
              <ImportarPlanilha onImportar={handleImportarPlanilha} />
              <button 
                type="button" 
                onClick={addPonto}
                className="text-sm text-[#FF5000] font-semibold flex items-center gap-1.5 hover:text-[#E04700] px-3 py-1.5 rounded-lg hover:bg-orange-50 transition-colors"
              >
                <Plus className="w-4 h-4" /> Adicionar Ponto
              </button>
              <button
                type="button"
                onClick={() => setPontosExpanded(!pontosExpanded)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 hover:bg-slate-50 rounded-lg flex items-center justify-center ml-1"
                title={pontosExpanded ? "Recolher Pontos" : "Expandir Pontos"}
              >
                {pontosExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {pontosExpanded && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {pontos.map((ponto, idx) => (
                <div key={idx} className="p-4 sm:p-5 border border-slate-200/80 rounded-xl bg-slate-50/50 relative">
                  {pontos.length > 1 && (
                    <button 
                      type="button"
                      onClick={() => removePonto(idx)}
                      className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition-colors p-1"
                      title="Remover este ponto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Endereço / Logradouro *</label>
                      <input 
                        required
                        type="text" 
                        placeholder="Ex: RUA FLOR DA CACHOEIRA, 211"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#FF5000] outline-none"
                        value={ponto.endereco}
                        onChange={e => handlePontoChange(idx, 'endereco', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Nº da Parada / Código</label>
                      <input 
                        required
                        type="text" 
                        placeholder="Ex: 3900000089"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#FF5000] outline-none font-mono"
                        value={ponto.numeroPonto}
                        onChange={e => handlePontoChange(idx, 'numeroPonto', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Bairro / Referência</label>
                      <input 
                        type="text" 
                        placeholder="Ex: JARAGUÁ • NORTE"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#FF5000] outline-none"
                        value={ponto.referencia}
                        onChange={e => handlePontoChange(idx, 'referencia', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Modelo / Tipo de Equipamento</label>
                      <select 
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#FF5000] outline-none font-medium text-slate-700"
                        value={ponto.tipo}
                        onChange={e => handlePontoChange(idx, 'tipo', e.target.value as any)}
                      >
                        <option value="abrigo">Abrigo de Ônibus (Minimalista / SK / Mupi)</option>
                        <option value="totem">Totem Digital / Totem Marrom</option>
                        <option value="outro">Outro Mobiliário</option>
                      </select>
                    </div>
                  </div>

                  {(ponto.latitude !== undefined || ponto.longitude !== undefined) && (
                    <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>GPS: {ponto.latitude ?? '-'}, {ponto.longitude ?? '-'}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Atividades Padrão */}
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Checklist de Atividades</h2>
              <p className="text-xs text-slate-500">Selecione as tarefas que serão incluídas automaticamente em cada ponto de parada.</p>
            </div>
            <button
              type="button"
              onClick={() => setAtividadesExpanded(!atividadesExpanded)}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 hover:bg-slate-50 rounded-lg flex items-center justify-center"
              title={atividadesExpanded ? "Recolher Atividades" : "Expandir Atividades"}
            >
              {atividadesExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
          
          {atividadesExpanded && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-wrap gap-2 pt-2">
                {sugestoesAtividades.map(atividade => {
                  const isSelected = atividadesPadrao.includes(atividade);
                  return (
                    <button
                      key={atividade}
                      type="button"
                      onClick={() => toggleAtividade(atividade)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        isSelected
                          ? 'bg-orange-50 border-orange-300 text-[#FF5000] shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {isSelected ? `✓ ${atividade}` : `+ ${atividade}`}
                    </button>
                  );
                })}
              </div>

              {/* Atividades extras da planilha */}
              {atividadesPadrao.some(a => !sugestoesAtividades.includes(a)) && (
                <div className="pt-2">
                  <p className="text-xs font-semibold text-slate-600 mb-1.5">Atividades adicionadas da planilha:</p>
                  <div className="flex flex-wrap gap-2">
                    {atividadesPadrao
                      .filter(a => !sugestoesAtividades.includes(a))
                      .map(atividade => (
                        <span
                          key={atividade}
                          className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-full flex items-center gap-1.5"
                        >
                          ✓ {atividade}
                          <button
                            type="button"
                            onClick={() => toggleAtividade(atividade)}
                            className="text-emerald-500 hover:text-emerald-800"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Técnicos */}
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200/80 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Atribuir Técnicos de Campo</h2>
              <p className="text-xs text-slate-500">Selecione os técnicos que realizarão as vistorias.</p>
            </div>
            
            {/* Campo de Busca */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Pesquisar técnico..."
                value={buscaTecnico}
                onChange={e => setBuscaTecnico(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#FF5000] focus:border-[#FF5000] transition-all"
              />
            </div>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {tecnicos
              .filter((tecnico: any) => 
                tecnico.nome.toLowerCase().includes(buscaTecnico.toLowerCase()) ||
                tecnico.email.toLowerCase().includes(buscaTecnico.toLowerCase())
              )
              .map((tecnico: any) => (
                <label key={tecnico._id} className="flex items-center gap-3 p-3.5 border border-slate-200/80 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <input 
                    type="checkbox"
                    className="w-4 h-4 text-[#FF5000] rounded focus:ring-[#FF5000] accent-[#FF5000]"
                    checked={tecnicosSelecionados.includes(tecnico._id)}
                    onChange={() => toggleTecnico(tecnico._id)}
                  />
                  <div>
                    <p className="font-semibold text-sm text-slate-900">{tecnico.nome}</p>
                    <p className="text-xs text-slate-500">{tecnico.email}</p>
                  </div>
                </label>
              ))}

            {tecnicos.length > 0 && tecnicos.filter((t: any) => 
              t.nome.toLowerCase().includes(buscaTecnico.toLowerCase()) ||
              t.email.toLowerCase().includes(buscaTecnico.toLowerCase())
            ).length === 0 && (
              <div className="text-xs text-slate-500 italic p-4 text-center">
                Nenhum técnico encontrado para "{buscaTecnico}"
              </div>
            )}

            {tecnicos.length === 0 && (
              <div className="text-xs text-slate-500 italic p-4 bg-slate-50 rounded-xl">
                Nenhum técnico cadastrado ainda.{' '}
                <Link href="/admin/tecnicos" className="text-[#FF5000] font-semibold underline">
                  Cadastrar técnicos
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Link href="/admin/ordens" className="px-5 py-2.5 border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-50 transition-colors text-sm">
            Cancelar
          </Link>
          <button 
            type="submit" 
            disabled={salvando}
            className="px-6 py-2.5 bg-[#FF5000] hover:bg-[#E04700] text-white rounded-xl font-semibold disabled:opacity-50 flex items-center gap-2 transition-colors shadow-sm text-sm cursor-pointer"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            {salvando ? 'Criando Ordem...' : 'Criar Ordem de Serviço'}
          </button>
        </div>
      </form>
    </div>
  );
}
