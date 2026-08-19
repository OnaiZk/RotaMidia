import React, { useState, useEffect } from 'react';
import { Check, MessageSquare, Clock } from 'lucide-react';

interface ChecklistItemProps {
  atividade: any;
  onToggle: (id: string, concluida: boolean) => void;
  onUpdateObservacao: (id: string, observacao: string) => void;
}

export function ChecklistItem({ atividade, onToggle, onUpdateObservacao }: ChecklistItemProps) {
  const [obsText, setObsText] = useState(atividade.observacao || '');
  const [isExpanded, setIsExpanded] = useState(false);

  // Sync state if prop changes (e.g. from server)
  useEffect(() => {
    setObsText(atividade.observacao || '');
  }, [atividade.observacao]);

  const handleToggle = () => {
    onToggle(atividade._id, !atividade.concluida);
  };

  const handleBlur = () => {
    if (obsText !== atividade.observacao) {
      onUpdateObservacao(atividade._id, obsText);
    }
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`bg-white rounded-xl border p-4 transition-colors duration-300 ${
      atividade.concluida ? 'border-green-200 bg-green-50/30' : 'border-gray-200'
    }`}>
      <div className="flex items-start gap-4">
        {/* Large touch target for checkbox */}
        <button
          onClick={handleToggle}
          className={`flex-shrink-0 w-8 h-8 mt-0.5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
            atividade.concluida 
              ? 'bg-green-500 border-green-500 text-white shadow-sm' 
              : 'border-gray-300 bg-gray-50 text-transparent hover:border-gray-400'
          }`}
          aria-label={atividade.concluida ? "Marcar como não concluída" : "Marcar como concluída"}
        >
          <Check className="w-5 h-5 stroke-[3]" />
        </button>

        <div className="flex-grow min-w-0">
          <button 
            className="w-full text-left touch-manipulation"
            onClick={handleToggle}
          >
            <p className={`text-base leading-tight transition-all duration-200 ${
              atividade.concluida ? 'text-gray-500 line-through' : 'text-gray-800 font-medium'
            }`}>
              {atividade.descricao}
            </p>
          </button>
          
          <div className="flex items-center gap-4 mt-2">
            {atividade.concluida && atividade.concluidaEm && (
              <span className="flex items-center text-xs text-green-600 font-medium gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatDate(atividade.concluidaEm)}
              </span>
            )}
            
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center text-xs text-[#FF5000] font-medium gap-1 p-1 -ml-1 rounded-md hover:bg-orange-50 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {atividade.observacao ? 'Ver/Editar observação' : 'Adicionar observação'}
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 pl-12">
          <textarea
            className="w-full text-sm p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF5000] focus:border-[#FF5000] transition-shadow bg-gray-50 outline-none"
            rows={3}
            placeholder="Adicionar observação sobre esta atividade..."
            value={obsText}
            onChange={(e) => setObsText(e.target.value)}
            onBlur={handleBlur}
          />
        </div>
      )}
    </div>
  );
}
