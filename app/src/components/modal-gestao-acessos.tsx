'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { X, Check, Trash2, ShieldCheck, Clock, UserCheck, UserX, Search, Loader2 } from 'lucide-react';
import Image from 'next/image';

interface ModalGestaoAcessosProps {
  isOpen: boolean;
  onClose: () => void;
  adminClerkId: string;
}

export function ModalGestaoAcessos({ isOpen, onClose, adminClerkId }: ModalGestaoAcessosProps) {
  const [filtro, setFiltro] = useState<'todos' | 'pendente' | 'aprovado'>('pendente');
  const [busca, setBusca] = useState('');
  const [processandoId, setProcessandoId] = useState<string | null>(null);

  const usuarios = useQuery(api.auth.listarUsuariosAdmin, { clerkId: adminClerkId }) || [];
  const aprovarMutation = useMutation(api.auth.aprovarUsuario);
  const rejeitarMutation = useMutation(api.auth.rejeitarUsuario);
  const removerMutation = useMutation(api.auth.removerUsuario);

  if (!isOpen) return null;

  const pendentesCount = usuarios.filter((u: any) => u.status === 'pendente').length;

  const usuariosFiltrados = usuarios.filter((u: any) => {
    if (filtro === 'pendente' && u.status !== 'pendente') return false;
    if (filtro === 'aprovado' && u.status !== 'aprovado') return false;

    if (busca) {
      const b = busca.toLowerCase();
      return u.nome.toLowerCase().includes(b) || u.email.toLowerCase().includes(b);
    }
    return true;
  });

  const handleAprovar = async (usuarioId: any) => {
    try {
      setProcessandoId(usuarioId);
      await aprovarMutation({ adminClerkId, usuarioId });
    } catch (err: any) {
      alert('Erro ao aprovar: ' + err.message);
    } finally {
      setProcessandoId(null);
    }
  };

  const handleRejeitar = async (usuarioId: any, nome: string) => {
    if (confirm(`Deseja realmente revogar o acesso de ${nome}?`)) {
      try {
        setProcessandoId(usuarioId);
        await rejeitarMutation({ adminClerkId, usuarioId });
      } catch (err: any) {
        alert('Erro ao alterar status: ' + err.message);
      } finally {
        setProcessandoId(null);
      }
    }
  };

  const handleRemover = async (usuarioId: any, nome: string) => {
    if (confirm(`Excluir permanentemente o cadastro de ${nome}?`)) {
      try {
        setProcessandoId(usuarioId);
        await removerMutation({ adminClerkId, usuarioId });
      } catch (err: any) {
        alert('Erro ao excluir: ' + err.message);
      } finally {
        setProcessandoId(null);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 text-[#FF5000] rounded-2xl flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Gestão de Acessos ao Painel</h2>
              <p className="text-xs text-slate-500">Aprove ou gerencie os líderes e supervisores autorizados</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filtros e Busca */}
        <div className="py-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                onClick={() => setFiltro('pendente')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  filtro === 'pendente' ? 'bg-white text-[#FF5000] shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Pendentes
                {pendentesCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-[#FF5000] text-white text-[10px] rounded-full">
                    {pendentesCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setFiltro('aprovado')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  filtro === 'aprovado' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                Aprovados
              </button>

              <button
                onClick={() => setFiltro('todos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filtro === 'todos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos ({usuarios.length})
              </button>
            </div>

            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nome ou e-mail..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#FF5000]"
              />
            </div>
          </div>
        </div>

        {/* Lista de Usuários */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 py-1">
          {usuariosFiltrados.map((u: any) => {
            const isProcessing = processandoId === u._id;

            return (
              <div
                key={u._id}
                className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  u.status === 'pendente'
                    ? 'border-amber-200 bg-amber-50/40 hover:bg-amber-50/70'
                    : u.status === 'aprovado'
                    ? 'border-slate-200/80 bg-white hover:border-slate-300'
                    : 'border-red-200 bg-red-50/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  {u.fotoUrl ? (
                    <Image
                      src={u.fotoUrl}
                      alt={u.nome}
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded-xl object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#FF5000] flex items-center justify-center font-bold text-sm">
                      {u.nome?.charAt(0).toUpperCase() || 'L'}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-slate-900">{u.nome}</p>
                      {u.ehSuperAdmin && (
                        <span className="text-[10px] bg-slate-900 text-white font-bold px-2 py-0.5 rounded-md">
                          SuperAdmin
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{u.email}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Cadastrado em {new Date(u.criadoEm).toLocaleDateString('pt-BR')}
                      {u.aprovadoPor && ` • Aprovado por ${u.aprovadoPor}`}
                    </p>
                  </div>
                </div>

                {/* Status e Ações */}
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {u.status === 'pendente' ? (
                    <>
                      <button
                        onClick={() => handleAprovar(u._id)}
                        disabled={isProcessing}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        Aprovar Acesso
                      </button>
                      <button
                        onClick={() => handleRejeitar(u._id, u.nome)}
                        disabled={isProcessing}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Recusar
                      </button>
                    </>
                  ) : u.status === 'aprovado' ? (
                    <>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" /> Aprovado
                      </span>
                      {!u.ehSuperAdmin && (
                        <button
                          onClick={() => handleRejeitar(u._id, u.nome)}
                          disabled={isProcessing}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Revogar Acesso"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
                        Revogado
                      </span>
                      <button
                        onClick={() => handleAprovar(u._id)}
                        disabled={isProcessing}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors"
                      >
                        Reativar
                      </button>
                      <button
                        onClick={() => handleRemover(u._id, u.nome)}
                        disabled={isProcessing}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir Definitivamente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {usuariosFiltrados.length === 0 && (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <p className="text-sm font-semibold text-slate-600">Nenhuma solicitação encontrada</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {filtro === 'pendente' ? 'Não há líderes pendentes de aprovação no momento.' : 'Nenhum usuário corresponde à busca.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
