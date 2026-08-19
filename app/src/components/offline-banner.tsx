'use client';

import { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw, CheckCircle2 } from 'lucide-react';
import { obterFilaOffline, sincronizarFilaComServidor } from '@/lib/offline-sync';
import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [itensPendentes, setItensPendentes] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  const markAllAtividades = useMutation(api.campo.markAllAtividades);
  const unmarkAllAtividades = useMutation(api.campo.unmarkAllAtividades);
  const toggleAtividade = useMutation(api.campo.toggleAtividade);

  const atualizarFila = () => {
    const fila = obterFilaOffline();
    setItensPendentes(fila.length);
  };

  const executarSincronizacao = async () => {
    if (!navigator.onLine || sincronizando) return;
    const fila = obterFilaOffline();
    if (fila.length === 0) return;

    try {
      setSincronizando(true);
      const res = await sincronizarFilaComServidor({
        markAllAtividades,
        unmarkAllAtividades,
        toggleAtividade,
      });

      if (res.sincronizados > 0) {
        setMensagemSucesso(`${res.sincronizados} ação(ões) sincronizada(s) com sucesso!`);
        setTimeout(() => setMensagemSucesso(null), 4000);
      }
    } catch (err) {
      console.error('Erro ao sincronizar:', err);
    } finally {
      setSincronizando(false);
      atualizarFila();
    }
  };

  useEffect(() => {
    setIsOnline(navigator.onLine);
    atualizarFila();

    const handleOnline = () => {
      setIsOnline(true);
      executarSincronizacao();
    };

    const handleOffline = () => {
      setIsOnline(false);
      atualizarFila();
    };

    const handleQueueChanged = () => {
      atualizarFila();
      if (navigator.onLine) {
        executarSincronizacao();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-queue-changed', handleQueueChanged);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-queue-changed', handleQueueChanged);
    };
  }, []);

  // Se estiver online e sem pendências e sem mensagem de sucesso, não exibe nada
  if (isOnline && itensPendentes === 0 && !mensagemSucesso) {
    return null;
  }

  return (
    <div className="w-full transition-all duration-300 z-40 sticky top-0">
      {/* Estado Offline */}
      {!isOnline && (
        <div className="bg-amber-600 text-white px-4 py-2.5 text-xs font-semibold flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 shrink-0 animate-pulse" />
            <span>
              <strong>Modo Offline Ativo</strong> • Alterações salvas no aparelho ({itensPendentes} pendente{itensPendentes !== 1 ? 's' : ''})
            </span>
          </div>
          <span className="text-[10px] bg-amber-700/80 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
            Sem Sinal
          </span>
        </div>
      )}

      {/* Sincronizando quando a internet volta */}
      {isOnline && sincronizando && (
        <div className="bg-blue-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
            <span>Sincronizando dados com o servidor...</span>
          </div>
        </div>
      )}

      {/* Mensagem de Concluído com Sucesso */}
      {isOnline && mensagemSucesso && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-md animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{mensagemSucesso}</span>
          </div>
          <button 
            onClick={() => setMensagemSucesso(null)}
            className="text-white/80 hover:text-white font-bold text-xs"
          >
            ×
          </button>
        </div>
      )}

      {/* Se estiver online mas houver itens na fila e não estiver sincronizando */}
      {isOnline && itensPendentes > 0 && !sincronizando && !mensagemSucesso && (
        <div className="bg-orange-500 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 shrink-0" />
            <span>{itensPendentes} alteração(ões) pendente(s) de envio.</span>
          </div>
          <button
            onClick={executarSincronizacao}
            className="bg-white text-[#FF5000] px-2.5 py-1 rounded-lg text-[11px] font-bold hover:bg-orange-50 transition-colors cursor-pointer"
          >
            Sincronizar Agora
          </button>
        </div>
      )}
    </div>
  );
}
