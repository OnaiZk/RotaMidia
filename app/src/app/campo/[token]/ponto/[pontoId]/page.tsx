'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Navigation, MapPin, CheckCircle2, Loader2, Clock, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { enfileirarAcaoOffline, obterStatusPontoOffline } from '@/lib/offline-sync';

export default function PontoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const token = (Array.isArray(params?.token) ? params.token[0] : params?.token) as string || '';
  const pontoId = (Array.isArray(params?.pontoId) ? params.pontoId[0] : params?.pontoId) as string || '';
  
  const [concluindo, setConcluindo] = useState(false);
  const [overrideOffline, setOverrideOffline] = useState<boolean | null>(null);

  const data = useQuery(
    api.campo.getPontoDetailsByToken, 
    token && pontoId ? { token, pontoId } : 'skip'
  );
  const markAllAtividades = useMutation(api.campo.markAllAtividades);
  const unmarkAllAtividades = useMutation(api.campo.unmarkAllAtividades);


  useEffect(() => {
    // Carrega status offline se houver ação pendente
    const statusLocal = obterStatusPontoOffline(pontoId);
    setOverrideOffline(statusLocal);

    const handleQueueChange = () => {
      const novoStatus = obterStatusPontoOffline(pontoId);
      setOverrideOffline(novoStatus);
    };

    window.addEventListener('offline-queue-changed', handleQueueChange);
    return () => {
      window.removeEventListener('offline-queue-changed', handleQueueChange);
    };
  }, [pontoId]);

  if (data === undefined) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#F8FAFC]">
        <Loader2 className="w-8 h-8 text-[#FF5000] animate-spin" />
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="p-6 text-center bg-[#F8FAFC] h-screen flex flex-col items-center justify-center">
        <h1 className="text-xl font-bold text-slate-800 mb-2">Ponto não encontrado</h1>
        <p className="text-slate-500 text-sm mb-4">Este ponto não existe ou não pertence à sua ordem de serviço.</p>
        <Link href={`/campo/${token}`} className="text-[#FF5000] font-semibold underline">
          Voltar para a lista de pontos
        </Link>
      </div>
    );
  }

  const { ponto, atividades } = data;

  const totalAtividades = atividades?.length || 0;
  const atividadesConcluidas = atividades?.filter((a: any) => a.concluida).length || 0;
  
  // Se houver override offline local, ele tem prioridade sobre os dados do servidor até a sincronização
  const isConcluidoServidor = totalAtividades > 0 ? atividadesConcluidas === totalAtividades : false;
  const isConcluido = overrideOffline !== null ? overrideOffline : isConcluidoServidor;
  const isOfflinePending = overrideOffline !== null;

  const getMapsUrl = () => {
    if (!ponto) return '#';
    if (ponto.latitude && ponto.longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${ponto.latitude},${ponto.longitude}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ponto.endereco || '')}`;
  };

  const handleConcluirPonto = async () => {
    try {
      setConcluindo(true);

      if (!navigator.onLine) {
        // Enfileira offline
        enfileirarAcaoOffline({
          tipo: 'concluir_ponto',
          token,
          pontoId,
        });
        setOverrideOffline(true);
        return;
      }

      // Tentar online via Convex
      try {
        await markAllAtividades({ token, pontoId });
        setOverrideOffline(null);
      } catch (networkError) {
        console.warn('Erro de rede ao concluir online, salvando na fila offline:', networkError);
        enfileirarAcaoOffline({
          tipo: 'concluir_ponto',
          token,
          pontoId,
        });
        setOverrideOffline(true);
      }
    } catch (error) {
      console.error("Erro ao concluir ponto", error);
      alert("Ocorreu um erro ao concluir o ponto.");
    } finally {
      setConcluindo(false);
    }
  };

  const handleReabrirPonto = async () => {
    if (confirm("Deseja realmente reabrir este ponto de parada?")) {
      try {
        setConcluindo(true);

        if (!navigator.onLine) {
          enfileirarAcaoOffline({
            tipo: 'reabrir_ponto',
            token,
            pontoId,
          });
          setOverrideOffline(false);
          return;
        }

        try {
          await unmarkAllAtividades({ token, pontoId });
          setOverrideOffline(null);
        } catch (networkError) {
          console.warn('Erro de rede ao reabrir online, salvando na fila offline:', networkError);
          enfileirarAcaoOffline({
            tipo: 'reabrir_ponto',
            token,
            pontoId,
          });
          setOverrideOffline(false);
        }
      } catch (error) {
        console.error("Erro ao reabrir ponto", error);
        alert("Ocorreu um erro ao reabrir o ponto.");
      } finally {
        setConcluindo(false);
      }
    }
  };



  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] pb-20">
      {/* Fixed Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200/80 shadow-xs">
        <div className="flex items-center h-16 px-4">
          <Link 
            href={`/campo/${token}`}
            className="p-2 -ml-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div className="flex-1 ml-2">
            <h1 className="text-lg font-bold text-slate-900 leading-tight">
              Ponto {ponto.numeroPonto}
            </h1>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {ponto.tipo === 'abrigo' ? 'Abrigo de Ônibus' : ponto.tipo === 'totem' ? 'Totem Digital' : 'Mobiliário Urbano'}
              {ponto.modelo ? ` • ${ponto.modelo}` : ''}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 sm:space-y-5 max-w-lg mx-auto w-full">
        {/* Ponto Info Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-xl mt-0.5 shrink-0 ${isConcluido ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-[#FF5000]'}`}>
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  isConcluido ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {isConcluido ? '✓ Concluído' : 'Pendente'}
                </span>

                {ponto.rota && (
                  <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold font-mono">
                    {ponto.rota}
                  </span>
                )}

                {isOfflinePending && (
                  <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <WifiOff className="w-3 h-3" /> Salvo Offline
                  </span>
                )}
              </div>
              <p className="text-slate-900 font-bold text-base leading-snug">{ponto.endereco}</p>
              {ponto.referencia && (
                <p className="text-xs text-slate-500 mt-1">Ref / Bairro: {ponto.referencia}</p>
              )}
              {(ponto.latitude !== undefined || ponto.longitude !== undefined) && (
                <p className="text-[11px] text-slate-400 mt-1 font-mono">
                  GPS: {ponto.latitude ?? '-'}, {ponto.longitude ?? '-'}
                </p>
              )}
            </div>
          </div>
          
          <a
            href={getMapsUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-orange-50 hover:bg-orange-100 text-[#FF5000] font-bold text-sm rounded-xl transition-colors active:bg-orange-200"
          >
            <Navigation className="w-4 h-4" />
            <span>Abrir no Google Maps</span>
          </a>
        </div>



        {/* Card de Conclusão / Ação Global */}
        <div className="pt-2">
          {isConcluido ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-4 shadow-xs">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-extrabold text-emerald-950 text-lg">Ponto Concluído!</h3>
                <p className="text-xs text-emerald-700 font-medium mt-1">
                  {isOfflinePending 
                    ? 'Concluído localmente no aparelho. Será sincronizado assim que houver sinal.' 
                    : 'Este ponto de parada foi finalizado com sucesso.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleReabrirPonto}
                disabled={concluindo}
                className="text-xs text-slate-500 hover:text-[#FF5000] font-bold underline transition-colors cursor-pointer block mx-auto pt-2"
              >
                Reabrir Ponto (Desfazer conclusão)
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConcluirPonto}
              disabled={concluindo}
              className="w-full py-4 px-4 bg-[#FF5000] text-white font-bold rounded-2xl shadow-md hover:bg-[#E04700] active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-base cursor-pointer disabled:opacity-50"
            >
              {concluindo ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              <span>Concluir Ponto Completo</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

