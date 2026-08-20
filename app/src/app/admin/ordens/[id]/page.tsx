'use client';

import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@convex/_generated/api';
import { ArrowLeft, Mail, Copy, MapPin, CheckCircle2, Clock, Check, Loader2, Trash2, Download, FileSpreadsheet, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Id } from '@convex/_generated/dataModel';
import { useState } from 'react';
import * as XLSX from 'xlsx';

export default function OrdemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as Id<"ordensServico">;
  
  const ordem = useQuery(api.ordensServico.getById, { id });
  const atribuicoes = useQuery(api.atribuicoes.listByOrdem, { ordemServicoId: id }) || [];
  const pontos = useQuery(api.pontos.listByOrdem, { ordemServicoId: id }) || [];
  const updateStatus = useMutation(api.ordensServico.updateStatus);
  const removeOrdem = useMutation(api.ordensServico.remove);
  const enviarEmailAction = useAction(api.email.enviarEmailTecnico);

  const [copiadoToken, setCopiadoToken] = useState<string | null>(null);
  const [enviandoEmailId, setEnviandoEmailId] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [expandedPontos, setExpandedPontos] = useState<Record<string, boolean>>({});

  const togglePontoExpanded = (pontoId: string) => {
    setExpandedPontos(prev => ({
      ...prev,
      [pontoId]: !prev[pontoId]
    }));
  };

  if (ordem === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-[#FF5000] animate-spin" />
      </div>
    );
  }

  if (ordem === null) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
        <h2 className="text-xl font-bold text-slate-900">Ordem de serviço não encontrada</h2>
        <Link href="/admin/ordens" className="text-[#FF5000] font-semibold underline mt-4 inline-block">
          Voltar para a lista de ordens
        </Link>
      </div>
    );
  }

  // Total de pontos e progresso
  const totalPontos = pontos.length;
  const pontosConcluidos = pontos.filter((p: any) => 
    p.atividades?.length > 0 && p.atividades.every((a: any) => a.concluida)
  ).length;
  const progress = totalPontos > 0 ? Math.round((pontosConcluidos / totalPontos) * 100) : 0;
  const isAllDone = totalPontos > 0 && pontosConcluidos === totalPontos;

  const handleCopiarLink = (token: string) => {
    const url = `${window.location.origin}/campo/${token}`;
    navigator.clipboard.writeText(url);
    setCopiadoToken(token);
    setTimeout(() => setCopiadoToken(null), 3000);
  };

  const handleEnviarWhatsApp = (atrib: any) => {
    const url = `${window.location.origin}/campo/${atrib.token}`;
    const nomeTecnico = atrib.tecnico?.nome || 'Técnico';
    const texto = encodeURIComponent(
      `Olá ${nomeTecnico}! 🛠️\nUma nova Ordem de Serviço foi atribuída a você:\n\n*${ordem.titulo}*\n\nAcesse o link abaixo para visualizar a rota e executar o serviço:\n${url}`
    );
    const telefone = atrib.tecnico?.telefone ? atrib.tecnico.telefone.replace(/\D/g, '') : '';
    const waUrl = telefone ? `https://wa.me/55${telefone}?text=${texto}` : `https://wa.me/?text=${texto}`;
    window.open(waUrl, '_blank');
  };

  const handleEnviarEmail = async (atribuicaoId: Id<"atribuicoes">) => {
    try {
      setEnviandoEmailId(atribuicaoId);
      const res = await enviarEmailAction({
        atribuicaoId,
        baseUrl: window.location.origin,
      });
      alert(`E-mail enviado com sucesso para ${res.destinatario}!`);
    } catch (err: any) {
      console.error('Erro ao enviar e-mail:', err);
      alert(`Erro ao enviar e-mail: ${err.message || 'Verifique as credenciais do Brevo'}`);
    } finally {
      setEnviandoEmailId(null);
    }
  };

  const handleExportarPlanilha = () => {
    if (!pontos || pontos.length === 0) {
      alert('Nenhum ponto para exportar.');
      return;
    }

    const dadosExportacao = pontos.map((p: any, idx: number) => {
      const totalAtiv = p.atividades?.length || 0;
      const concluidasAtiv = p.atividades?.filter((a: any) => a.concluida).length || 0;
      const statusPonto = totalAtiv > 0 && concluidasAtiv === totalAtiv ? 'CONCLUÍDO' : concluidasAtiv > 0 ? 'EM ANDAMENTO' : 'PENDENTE';

      const linha: Record<string, any> = {
        'ORDEM': p.ordem || (idx + 1),
        'N° Parada': p.numeroPonto,
        'Endereço': p.endereco,
        'Bairro / Ref': p.referencia || '',
        'Modelo / Tipo': p.tipo === 'totem' ? 'Totem' : p.tipo === 'abrigo' ? 'Abrigo' : 'Outro',
        'Latitude': p.latitude ?? '',
        'Longitude': p.longitude ?? '',
        'Status do Ponto': statusPonto,
        'Progresso': `${concluidasAtiv}/${totalAtiv}`,
      };

      if (p.atividades && p.atividades.length > 0) {
        p.atividades.forEach((ativ: any) => {
          linha[`Atividade: ${ativ.descricao}`] = ativ.concluida ? 'OK' : 'PENDENTE';
          if (ativ.observacao) {
            linha[`Obs: ${ativ.descricao}`] = ativ.observacao;
          }
        });
      }

      return linha;
    });

    const ws = XLSX.utils.json_to_sheet(dadosExportacao);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatorio_Campo');
    const nomeArquivo = `Relatorio_${ordem.titulo.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, nomeArquivo);
  };

  const handleExcluir = async () => {
    if (confirm("Tem certeza que deseja excluir esta ordem de serviço? Esta ação não pode ser desfeita e excluirá todos os pontos e atividades vinculados.")) {
      try {
        setExcluindo(true);
        await removeOrdem({ id });
        router.push('/admin/ordens');
      } catch (err: any) {
        console.error('Erro ao excluir ordem de serviço:', err);
        alert(`Erro ao excluir: ${err.message || 'Erro desconhecido'}`);
      } finally {
        setExcluindo(false);
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/ordens" className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#FF5000]">Ordem de Serviço</span>
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">{ordem.titulo}</h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          {/* Botão de Exportar Relatório Excel */}
          <button
            onClick={handleExportarPlanilha}
            className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-2xs"
            title="Exportar dados e status de campo para planilha Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Exportar Excel
          </button>

          {ordem.status !== 'concluida' ? (
            <button 
              onClick={() => updateStatus({ id, status: 'concluida' })}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Marcar como Concluída
            </button>
          ) : (
            <button 
              onClick={() => updateStatus({ id, status: 'ativa' })}
              className="px-5 py-2.5 bg-[#FF5000] hover:bg-[#E04700] text-white rounded-xl text-sm font-semibold transition-colors shadow-sm cursor-pointer"
            >
              Reabrir Ordem
            </button>
          )}
          
          <button 
            onClick={handleExcluir}
            disabled={excluindo}
            className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-sm font-semibold transition-colors shadow-2xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {excluindo ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Excluir
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Status Atual</p>
            <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full uppercase tracking-wider ${
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
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Data Criação</p>
            <p className="font-semibold text-sm text-slate-900">{new Date(ordem.dataCriacao).toLocaleDateString('pt-BR')}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Prazo Limite</p>
            <p className="font-semibold text-sm text-slate-900">
              {ordem.dataLimite ? new Date(ordem.dataLimite).toLocaleDateString('pt-BR') : 'Não definido'}
            </p>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold uppercase tracking-wider text-slate-400">Progresso Geral</span>
              <span className="font-bold text-slate-800">{progress}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div 
                className={`h-2.5 rounded-full transition-all duration-500 ${isAllDone ? 'bg-emerald-500' : 'bg-[#FF5000]'}`} 
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">{pontosConcluidos} de {totalPontos} pontos concluídos</p>
          </div>
        </div>
        
        {ordem.descricao && (
          <div className="pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Instruções / Descrição</p>
            <p className="text-sm text-slate-700 leading-relaxed">{ordem.descricao}</p>
          </div>
        )}
      </div>

      {/* Técnicos Atribuídos */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-slate-900">Técnicos de Campo Atribuídos ({atribuicoes.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {atribuicoes.map((atrib: any) => (
            <div key={atrib._id} className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-bold text-slate-900">{atrib.tecnico?.nome || 'Técnico'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{atrib.tecnico?.email}</p>
                  </div>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                    atrib.enviadoEm ? 'bg-orange-50 text-[#FF5000] border border-orange-200' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {atrib.enviadoEm ? 'E-mail Enviado' : 'Não Notificado'}
                  </span>
                </div>
                {atrib.visualizadoEm && (
                  <p className="text-xs text-emerald-600 mt-2 font-medium flex items-center gap-1">
                    ✓ Acessou em {new Date(atrib.visualizadoEm).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100">
                <button 
                  onClick={() => handleEnviarEmail(atrib._id)}
                  disabled={enviandoEmailId === atrib._id}
                  title="Disparar e-mail automático para o técnico"
                  className="flex items-center justify-center gap-1.5 bg-orange-50 hover:bg-orange-100 text-[#FF5000] py-2 px-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {enviandoEmailId === atrib._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                  <span className="truncate">{atrib.enviadoEm ? 'Reenviar' : 'E-mail'}</span>
                </button>
                <button 
                  onClick={() => handleEnviarWhatsApp(atrib)}
                  title="Enviar link da OS direto no WhatsApp"
                  className="flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-2 px-2 rounded-xl text-xs font-semibold transition-colors border border-emerald-200"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="truncate">WhatsApp</span>
                </button>
                <button 
                  onClick={() => handleCopiarLink(atrib.token)}
                  title="Copiar link de acesso direto"
                  className="flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 py-2 px-2 rounded-xl text-xs font-semibold transition-colors border border-slate-200"
                >
                  {copiadoToken === atrib.token ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600 truncate">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="truncate">Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
          {atribuicoes.length === 0 && (
            <div className="col-span-full bg-white p-8 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 text-sm">
              Nenhum técnico atribuído a esta ordem de serviço.
            </div>
          )}
        </div>
      </div>

      {/* Pontos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Pontos de Parada ({pontos.length})</h2>
          <button
            onClick={handleExportarPlanilha}
            className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 hover:underline"
          >
            <Download className="w-3.5 h-3.5" />
            Baixar planilha com status
          </button>
        </div>

        <div className="space-y-4">
          {pontos.map((ponto: any) => {
            const isDone = ponto.atividades?.length > 0 && ponto.atividades.every((a: any) => a.concluida);

            return (
              <div key={ponto._id} className={`bg-white rounded-2xl shadow-xs border p-5 transition-all ${isDone ? 'border-emerald-200 bg-emerald-50/5' : 'border-slate-200/80 hover:border-slate-300'}`}>
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className={`p-2.5 rounded-xl mt-0.5 shrink-0 ${isDone ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-[#FF5000]'}`}>
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-slate-900 font-mono">Ponto {ponto.numeroPonto}</span>
                        <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded-full font-medium">
                          {ponto.tipo === 'totem' ? 'Totem' : ponto.tipo === 'abrigo' ? 'Abrigo' : 'Outro'}
                        </span>
                        {isDone ? (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Concluído
                          </span>
                        ) : (
                          <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                            Pendente
                          </span>
                        )}
                      </div>
                      <p className="text-slate-800 text-sm font-medium">{ponto.endereco}</p>
                      {ponto.referencia && (
                        <p className="text-xs text-slate-500 mt-0.5">Ref / Bairro: {ponto.referencia}</p>
                      )}
                      {(ponto.latitude !== undefined || ponto.longitude !== undefined) && (
                        <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                          GPS: {ponto.latitude ?? '-'}, {ponto.longitude ?? '-'}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 self-start md:self-auto">
                    <span className={`text-xs font-bold px-3.5 py-1.5 rounded-xl border ${
                      isDone 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {isDone ? '✓ Ponto Concluído' : 'Ponto Pendente'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
