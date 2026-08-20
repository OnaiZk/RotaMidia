'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { MapPin, Navigation, WifiOff } from 'lucide-react';
import { obterStatusPontoOffline } from '@/lib/offline-sync';

interface PontoCardProps {
  ponto: any;
  token: string;
}

export function PontoCard({ ponto, token }: PontoCardProps) {
  const [offlineStatus, setOfflineStatus] = useState<boolean | null>(null);

  useEffect(() => {
    setOfflineStatus(obterStatusPontoOffline(ponto._id));

    const handleQueueChange = () => {
      setOfflineStatus(obterStatusPontoOffline(ponto._id));
    };

    window.addEventListener('offline-queue-changed', handleQueueChange);
    return () => {
      window.removeEventListener('offline-queue-changed', handleQueueChange);
    };
  }, [ponto._id]);

  const totalAtividades = ponto.atividades?.length || 0;
  const atividadesConcluidas = ponto.atividades?.filter((a: any) => a.concluida).length || 0;
  
  const isConcluidoServidor = totalAtividades > 0 && atividadesConcluidas === totalAtividades;
  const isConcluido = offlineStatus !== null ? offlineStatus : isConcluidoServidor;
  const isOfflinePending = offlineStatus !== null;
  const numeroExibicao = ponto.numeroPonto || ponto.numero || '';
  
  const getMapsUrl = () => {
    if (ponto.latitude && ponto.longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${ponto.latitude},${ponto.longitude}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ponto.endereco)}`;
  };

  return (
    <Link href={`/campo/${token}/ponto/${ponto._id}`} className="block group">
      <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all duration-200 group-hover:shadow-md group-hover:border-orange-200 active:scale-[0.99] ${isConcluido ? 'border-emerald-200 bg-emerald-50/10' : 'border-gray-200'}`}>
        <div className="p-4 sm:p-5">
          <div className="flex justify-between items-start mb-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                {ponto.ordem && (
                  <span className="text-xs font-mono font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                    #{ponto.ordem}
                  </span>
                )}
                <span className="text-lg font-bold text-gray-900 group-hover:text-[#FF5000] transition-colors">
                  {numeroExibicao}
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold w-fit uppercase tracking-wider ${
                  ponto.tipo === 'abrigo' 
                    ? 'bg-slate-100 text-slate-700 border border-slate-200' 
                    : ponto.tipo === 'totem'
                    ? 'bg-orange-100 text-[#FF5000] border border-orange-200'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {ponto.tipo === 'abrigo' ? 'Abrigo' : ponto.tipo === 'totem' ? 'Totem' : 'Mobiliário'}
                </span>

                {ponto.modelo && (
                  <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                    {ponto.modelo}
                  </span>
                )}

                {isOfflinePending && (
                  <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                    <WifiOff className="w-2.5 h-2.5" /> Offline
                  </span>
                )}
              </div>
            </div>
            
            <a 
              href={getMapsUrl()} 
              target="_blank" 
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-2.5 bg-orange-50 text-[#FF5000] rounded-xl hover:bg-orange-100 transition-colors shadow-xs"
              aria-label="Abrir no Google Maps"
              title="Abrir no Google Maps"
            >
              <Navigation className="w-4 h-4" />
            </a>
          </div>

          <div className="space-y-1.5 mb-4">
            <div className="flex items-start gap-2 text-sm text-gray-700 font-normal">
              <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#FF5000]" />
              <span className="line-clamp-2 leading-snug">{ponto.endereco}</span>
            </div>
            {ponto.referencia && (
              <div className="flex items-start gap-2 text-xs text-gray-500 pl-6">
                <span className="italic line-clamp-1">Ref: {ponto.referencia}</span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3.5 border-t border-gray-100 flex items-center justify-between">
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${
              isConcluido 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {isConcluido ? '✓ Ponto Concluído' : 'Ponto Pendente'}
            </span>
            <span className="text-xs font-semibold text-[#FF5000] group-hover:underline">
              {isConcluido ? 'Ver detalhes →' : 'Abrir e Concluir →'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

