'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Plus, Trash2, Mail, Phone, Loader2, Users, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { Id } from '@convex/_generated/dataModel';
import ImportarTecnicosModal from '@/components/importar-tecnicos-modal';

export default function TecnicosPage() {
  const tecnicos = useQuery(api.tecnicos.list, {}) || [];
  const createTecnico = useMutation(api.tecnicos.create);
  const removeTecnico = useMutation(api.tecnicos.remove);
  const importTecnicosBatch = useMutation(api.tecnicos.importBatch);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
  });

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim() || !formData.email.trim()) return;

    try {
      setSalvando(true);
      await createTecnico({
        nome: formData.nome.trim(),
        email: formData.email.trim().toLowerCase(),
        telefone: formData.telefone.trim() || undefined,
      });
      setFormData({ nome: '', email: '', telefone: '' });
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Erro ao criar técnico:', error);
      alert('Erro ao salvar técnico: ' + (error.message || 'Verifique os dados'));
    } finally {
      setSalvando(false);
    }
  };

  const handleRemover = async (id: Id<"tecnicos">, nome: string) => {
    if (confirm(`Deseja realmente remover o técnico "${nome}"?`)) {
      try {
        await removeTecnico({ id });
      } catch (err: any) {
        alert('Erro ao remover: ' + err.message);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Técnicos de Campo ({tecnicos.length})</h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie a equipe responsável pelas manutenções em campo</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-xs hover:border-orange-200 text-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#FF5000]" />
            Importar Planilha
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-[#FF5000] hover:bg-[#E04700] text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm text-sm"
          >
            <Plus className="w-4 h-4" />
            Novo Técnico
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tecnicos.map((tecnico: any) => (
          <div key={tecnico._id} className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6 flex flex-col justify-between hover:shadow-sm hover:border-orange-200 transition-all">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-orange-100 text-[#FF5000] rounded-2xl flex items-center justify-center font-extrabold text-xl shadow-xs">
                  {tecnico.nome.charAt(0).toUpperCase()}
                </div>
                <button 
                  onClick={() => handleRemover(tecnico._id, tecnico.nome)}
                  className="text-slate-300 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                  title="Remover Técnico"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              <h3 className="font-bold text-lg text-slate-900 mb-1">{tecnico.nome}</h3>
              
              <div className="space-y-2 mt-4 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2.5 text-sm text-slate-600">
                  <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="truncate">{tecnico.email}</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-slate-600">
                  <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span>{tecnico.telefone || 'Sem telefone informado'}</span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {tecnicos.length === 0 && (
          <div className="col-span-full bg-white p-16 rounded-2xl border border-dashed border-slate-200 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900 mb-1">Nenhum técnico cadastrado</h3>
            <p className="text-slate-400 text-sm mb-5">Cadastre ou importe a lista de técnicos para envio das ordens de serviço por e-mail com acesso instantâneo.</p>
            <div className="flex items-center justify-center gap-3">
              <button 
                onClick={() => setIsImportModalOpen(true)}
                className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-xs flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4 text-[#FF5000]" />
                Importar Planilha (.xlsx, .csv)
              </button>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-[#FF5000] hover:bg-[#E04700] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Cadastrar Manualmente
              </button>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Adicionar Técnico</h2>
            <form onSubmit={handleSalvar} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Nome Completo *</label>
                <input 
                  required
                  type="text" 
                  placeholder="Ex: João da Silva"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-[#FF5000] focus:border-[#FF5000] text-sm outline-none"
                  value={formData.nome}
                  onChange={e => setFormData({...formData, nome: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Email * (para envio do link)</label>
                <input 
                  required
                  type="email" 
                  placeholder="Ex: joao.silva@eletromidia.com.br"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-[#FF5000] focus:border-[#FF5000] text-sm outline-none"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Telefone / WhatsApp</label>
                <input 
                  type="text" 
                  placeholder="Ex: (11) 98765-4321"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-[#FF5000] focus:border-[#FF5000] text-sm outline-none"
                  value={formData.telefone}
                  onChange={e => setFormData({...formData, telefone: e.target.value})}
                />
              </div>
              
              <div className="flex justify-end gap-3 mt-6 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-50 transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={salvando}
                  className="px-5 py-2 bg-[#FF5000] hover:bg-[#E04700] text-white rounded-xl font-semibold disabled:opacity-50 flex items-center gap-2 transition-colors shadow-sm text-sm"
                >
                  {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
                  Salvar Técnico
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Importação de Planilha */}
      <ImportarTecnicosModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={async (lista) => {
          return await importTecnicosBatch({ tecnicos: lista });
        }}
      />
    </div>
  );
}
