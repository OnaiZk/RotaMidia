'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { ProgressBar } from '@/components/progress-bar';
import { PontoCard } from '@/components/ponto-card';
import { AlertCircle, CheckCircle2, Loader2, Calendar } from 'lucide-react';
import { obterStatusPontoOffline } from '@/lib/offline-sync';

export default function CampoTokenPage() {
  const params = useParams();
  const token = params.token as string;
  const [filter, setFilter] = useState<'todos' | 'pendentes' | 'concluidos'>('todos');
  const [tick, setTick] = useState(0); // Trigger para re-renderizar quando a fila offline muda

  const data = useQuery(api.campo.getAtribuicaoByToken, { token });
  const markVisualizado = useMutation(api.campo.markAtribuicaoVisualizado);

  useEffect(() => {
    if (data && !data.visualizadoEm) {
      markVisualizado({ token }).catch(console.error);
    }
  }, [data, token, markVisualizado]);

  useEffect(() => {
    const handleQueueChange = () => {
      setTick((prev) => prev + 1);
    };

    window.addEventListener('offline-queue-changed', handleQueueChange);
    return () => {
      window.removeEventListener('offline-queue-changed', handleQueueChange);
    };
  }, []);

  if (data === undefined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8FAFC] p-6">
        <Loader2 className="w-10 h-10 text-[#FF5000] animate-spin mb-4" />
        <p className="text-slate-500 font-medium text-sm">Carregando ordem de serviço...</p>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8FAFC] p-6 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Link inválido ou expirado</h1>
        <p className="text-slate-500 max-w-md text-sm">
          Não foi possível encontrar uma ordem de serviço válida para este link. Verifique com seu supervisor da Eletromidia.
        </p>
      </div>
    );
  }

  const { atribuicao, ordem, tecnico, pontosComAtividades } = data;

  const isPontoRealmenteConcluido = (p: any) => {
    const offlineStatus = obterStatusPontoOffline(p._id);
    if (offlineStatus !== null) return offlineStatus;
    return p.atividades?.length > 0 && p.atividades.every((a: any) => a.concluida);
  };

  // Progresso total de pontos (incluindo fila offline)
  const totalPontos = pontosComAtividades.length;
  const pontosConcluidos = pontosComAtividades.filter(isPontoRealmenteConcluido).length;
  const isFinalizado = totalPontos > 0 && pontosConcluidos === totalPontos;

  // Filtros
  const filteredPontos = pontosComAtividades.filter((p: any) => {
    const concluido = isPontoRealmenteConcluido(p);
    if (filter === 'concluidos') return concluido;
    if (filter === 'pendentes') return !concluido;
    return true;
  }).sort((a: any, b: any) => {
    const aConcluido = isPontoRealmenteConcluido(a);
    const bConcluido = isPontoRealmenteConcluido(b);
    if (aConcluido && !bConcluido) return 1;
    if (!aConcluido && bConcluido) return -1;
    return 0;
  });

  const filterButtons = [
    { id: 'todos', label: 'Todos os Pontos' },
    { id: 'pendentes', label: 'Pendentes' },
    { id: 'concluidos', label: 'Concluídos' },
  ] as const;

  return (
    <div className="flex flex-col min-h-screen pb-20 bg-[#F8FAFC]">
      {/* Premium Header */}
      <header className="bg-slate-900 text-white px-5 pt-7 pb-6 shadow-md rounded-b-3xl relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#FF5000]/10 rounded-full blur-3xl pointer-events-none" />
        
        {/* Brand bar */}
        <div className="flex items-center justify-between mb-5 relative z-10">
          <div className="flex items-center gap-2.5">
            <Image 
              src="/eletromidia/logo-desktop.png" 
              alt="Eletromidia" 
              width={125} 
              height={26}
              className="h-5.5 w-auto object-contain"
              priority
            />
            <span className="text-[10px] font-bold tracking-widest uppercase bg-[#FF5000] text-white px-2 py-0.5 rounded-full">
              Campo
            </span>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            {totalPontos} {totalPontos === 1 ? 'ponto' : 'pontos'}
          </span>
        </div>
        
        <div className="relative z-10 mb-4">
          <p className="text-xs text-orange-400 font-semibold uppercase tracking-wider mb-0.5">
            Técnico em Campo
          </p>
          <h1 className="text-2xl font-extrabold text-white leading-tight">
            Olá, {tecnico.nome.split(' ')[0]}!
          </h1>
          <p className="text-slate-300 text-sm font-medium mt-1">
            {ordem.titulo}
          </p>
          {ordem.dataLimite && (
            <p className="text-slate-400 text-xs flex items-center gap-1 mt-1">
              <Calendar className="w-3.5 h-3.5 text-orange-400" />
              Prazo limite: {new Date(ordem.dataLimite).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
        
        {/* Progress Box */}
        <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-md border border-white/15 relative z-10 shadow-inner">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Progresso do Roteiro
            </span>
            {isFinalizado ? (
              <span className="flex items-center text-xs bg-emerald-500/20 text-emerald-300 font-bold px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                100% Concluído
              </span>
            ) : (
              <span className="text-xs text-orange-300 font-bold">
                {pontosConcluidos} de {totalPontos} pontos concluídos
              </span>
            )}
          </div>
          <ProgressBar 
            current={pontosConcluidos} 
            total={totalPontos} 
            showLabel={false}
            size="md"
          />
        </div>
      </header>

      <main className="flex-1 px-4 mt-5">
        {/* Filters */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-none">
          {filterButtons.map(btn => (
            <button
              key={btn.id}
              onClick={() => setFilter(btn.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filter === btn.id 
                  ? 'bg-[#FF5000] text-white shadow-sm' 
                  : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* List of Points */}
        <div className="space-y-3.5">
          {filteredPontos.length > 0 ? (
            filteredPontos.map((ponto: any) => (
              <PontoCard key={ponto._id} ponto={ponto} token={token} />
            ))
          ) : (
            <div className="text-center py-12 px-4 bg-white rounded-2xl border border-dashed border-slate-200">
              <p className="text-slate-400 text-sm">
                Nenhum ponto encontrado para este filtro.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

