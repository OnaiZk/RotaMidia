'use client';

export interface OfflineAction {
  id: string;
  tipo: 'concluir_ponto' | 'reabrir_ponto' | 'toggle_atividade';
  token: string;
  pontoId: string;
  atividadeId?: string;
  concluida?: boolean;
  timestamp: number;
}

const QUEUE_KEY = 'eletromidia_offline_queue';

/**
 * Obtém a lista de ações pendentes de sincronização
 */
export function obterFilaOffline(): OfflineAction[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Erro ao ler fila offline:', err);
    return [];
  }
}

/**
 * Salva a fila no localStorage e notifica a aplicação
 */
function salvarFila(fila: OfflineAction[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(fila));
    window.dispatchEvent(new CustomEvent('offline-queue-changed', { detail: { fila } }));
  } catch (err) {
    console.error('Erro ao salvar fila offline:', err);
  }
}

/**
 * Adiciona uma nova ação na fila offline
 */
export function enfileirarAcaoOffline(
  acao: Omit<OfflineAction, 'id' | 'timestamp'>
): OfflineAction {
  const novaAcao: OfflineAction = {
    ...acao,
    id: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
  };

  const fila = obterFilaOffline();
  // Se já houver ação para o mesmo ponto, substitui pela mais recente
  const filaFiltrada = fila.filter(
    (item) => !(item.pontoId === acao.pontoId && item.tipo.includes('ponto'))
  );
  filaFiltrada.push(novaAcao);
  salvarFila(filaFiltrada);
  return novaAcao;
}

/**
 * Remove uma ação da fila após ser processada com sucesso
 */
export function removerAcaoOffline(id: string) {
  const fila = obterFilaOffline();
  const novaFila = fila.filter((item) => item.id !== id);
  salvarFila(novaFila);
}

/**
 * Retorna o status de um ponto baseado na fila local (se houver alteração offline pendente)
 * Retorna true se marcado como concluído offline, false se reaberto offline, ou null se não houver pendência
 */
export function obterStatusPontoOffline(pontoId: string): boolean | null {
  const fila = obterFilaOffline();
  const acao = [...fila].reverse().find((item) => item.pontoId === pontoId);
  if (!acao) return null;
  if (acao.tipo === 'concluir_ponto') return true;
  if (acao.tipo === 'reabrir_ponto') return false;
  return null;
}

/**
 * Executa o envio de todas as ações pendentes para o Convex
 */
export async function sincronizarFilaComServidor(mutations: {
  markAllAtividades: (args: { token: string; pontoId: string }) => Promise<any>;
  unmarkAllAtividades: (args: { token: string; pontoId: string }) => Promise<any>;
  toggleAtividade?: (args: { token: string; pontoId: string; atividadeId: string; concluida: boolean }) => Promise<any>;
}): Promise<{ sincronizados: number; erros: number }> {
  const fila = obterFilaOffline();
  if (fila.length === 0) return { sincronizados: 0, erros: 0 };

  let sincronizados = 0;
  let erros = 0;

  for (const acao of fila) {
    try {
      if (acao.tipo === 'concluir_ponto') {
        await mutations.markAllAtividades({
          token: acao.token,
          pontoId: acao.pontoId,
        });
      } else if (acao.tipo === 'reabrir_ponto') {
        await mutations.unmarkAllAtividades({
          token: acao.token,
          pontoId: acao.pontoId,
        });
      } else if (acao.tipo === 'toggle_atividade' && mutations.toggleAtividade && acao.atividadeId) {
        await mutations.toggleAtividade({
          token: acao.token,
          pontoId: acao.pontoId,
          atividadeId: acao.atividadeId,
          concluida: acao.concluida ?? true,
        });
      }
      removerAcaoOffline(acao.id);
      sincronizados++;
    } catch (err) {
      console.error(`Erro ao sincronizar ação offline ${acao.id}:`, err);
      erros++;
    }
  }

  if (sincronizados > 0) {
    window.dispatchEvent(
      new CustomEvent('offline-sync-finished', { detail: { sincronizados, erros } })
    );
  }

  return { sincronizados, erros };
}
