'use client';

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X, Download, Loader2, ArrowRight } from 'lucide-react';

interface TecnicoImportado {
  nome: string;
  email: string;
  telefone?: string;
  valido: boolean;
  motivoInvalido?: string;
}

interface ImportarTecnicosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (tecnicos: { nome: string; email: string; telefone?: string }[]) => Promise<{
    inseridos: number;
    atualizados: number;
    total: number;
    ignorados: number;
  }>;
}

// Normaliza strings para comparação flexível de cabeçalhos
function normalizarTexto(txt: string): string {
  return txt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export default function ImportarTecnicosModal({
  isOpen,
  onClose,
  onImport,
}: ImportarTecnicosModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [arquivoNome, setArquivoNome] = useState<string | null>(null);
  const [tecnicosParsed, setTecnicosParsed] = useState<TecnicoImportado[]>([]);
  const [carregandoArquivo, setCarregandoArquivo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [resultado, setResultado] = useState<{
    inseridos: number;
    atualizados: number;
    total: number;
  } | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setArquivoNome(null);
    setTecnicosParsed([]);
    setCarregandoArquivo(false);
    setSalvando(false);
    setResultado(null);
    setErroGeral(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const processarArquivo = async (file: File) => {
    setCarregandoArquivo(true);
    setErroGeral(null);
    setResultado(null);
    setArquivoNome(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });

      if (!workbook.SheetNames.length) {
        throw new Error('A planilha está vazia ou ilegível.');
      }

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (!rawData || rawData.length === 0) {
        throw new Error('Nenhum dado encontrado na primeira aba da planilha.');
      }

      // Procurar linha de cabeçalho
      let headerRowIndex = 0;
      let colNomeIdx = -1;
      let colEmailIdx = -1;
      let colTelefoneIdx = -1;

      // Percorrer as primeiras 5 linhas para detectar os cabeçalhos
      for (let r = 0; r < Math.min(5, rawData.length); r++) {
        const row = rawData[r];
        if (!Array.isArray(row)) continue;

        for (let c = 0; c < row.length; c++) {
          const val = normalizarTexto(String(row[c] || ''));
          if (colNomeIdx === -1 && (val.includes('nome') || val.includes('tecnico') || val.includes('operador') || val.includes('colaborador') || val.includes('funcionario'))) {
            colNomeIdx = c;
          } else if (colEmailIdx === -1 && (val.includes('email') || val.includes('e-mail') || val.includes('mail'))) {
            colEmailIdx = c;
          } else if (colTelefoneIdx === -1 && (val.includes('tel') || val.includes('cel') || val.includes('whats') || val.includes('fone') || val.includes('contato'))) {
            colTelefoneIdx = c;
          }
        }

        if (colNomeIdx !== -1 && colEmailIdx !== -1) {
          headerRowIndex = r;
          break;
        }
      }

      // Se não encontrou cabeçalho explícito, assume coluna 0 = Nome, coluna 1 = Email
      if (colNomeIdx === -1 || colEmailIdx === -1) {
        colNomeIdx = 0;
        colEmailIdx = 1;
        // Se a primeira linha contiver texto sem cara de email, começamos da linha 1
        const primeiraLinhaCol1 = String(rawData[0]?.[1] || '');
        headerRowIndex = primeiraLinhaCol1.includes('@') ? -1 : 0;
      }

      const listaParsed: TecnicoImportado[] = [];

      for (let r = headerRowIndex + 1; r < rawData.length; r++) {
        const row = rawData[r];
        if (!row || !Array.isArray(row)) continue;

        const nomeBruto = String(row[colNomeIdx] || '').trim();
        const emailBruto = String(row[colEmailIdx] || '').trim();
        const telefoneBruto = colTelefoneIdx !== -1 ? String(row[colTelefoneIdx] || '').trim() : undefined;

        // Pular linhas completamente vazias
        if (!nomeBruto && !emailBruto) continue;

        let valido = true;
        let motivoInvalido: string | undefined;

        if (!nomeBruto) {
          valido = false;
          motivoInvalido = 'Nome ausente';
        } else if (!emailBruto) {
          valido = false;
          motivoInvalido = 'E-mail ausente';
        } else if (!emailBruto.includes('@') || !emailBruto.includes('.')) {
          valido = false;
          motivoInvalido = 'E-mail com formato inválido';
        }

        listaParsed.push({
          nome: nomeBruto,
          email: emailBruto.toLowerCase(),
          telefone: telefoneBruto || undefined,
          valido,
          motivoInvalido,
        });
      }

      if (listaParsed.length === 0) {
        throw new Error('Nenhum registro de técnico válido encontrado no arquivo.');
      }

      setTecnicosParsed(listaParsed);
    } catch (err: any) {
      console.error('Erro ao processar planilha:', err);
      setErroGeral(err.message || 'Erro ao processar o arquivo. Verifique o formato.');
      setTecnicosParsed([]);
    } finally {
      setCarregandoArquivo(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processarArquivo(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processarArquivo(file);
    }
  };

  const handleConfirmarImportacao = async () => {
    const validos = tecnicosParsed.filter((t) => t.valido);
    if (validos.length === 0) {
      setErroGeral('Nenhum técnico válido para importar.');
      return;
    }

    try {
      setSalvando(true);
      setErroGeral(null);

      const res = await onImport(
        validos.map((t) => ({
          nome: t.nome,
          email: t.email,
          telefone: t.telefone,
        }))
      );

      setResultado({
        inseridos: res.inseridos,
        atualizados: res.atualizados,
        total: validos.length,
      });
    } catch (err: any) {
      console.error('Erro ao salvar técnicos:', err);
      setErroGeral(err.message || 'Falha ao importar técnicos para o banco de dados.');
    } finally {
      setSalvando(false);
    }
  };

  const handleDownloadModelo = () => {
    const wsData = [
      ['Nome do Técnico', 'Email', 'Telefone'],
      ['João da Silva', 'joao.silva@exemplo.com.br', '(11) 98765-4321'],
      ['Maria Oliveira', 'maria.oliveira@exemplo.com.br', '(11) 91234-5678'],
      ['Carlos Pereira', 'carlos.pereira@exemplo.com.br', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Técnicos');
    XLSX.writeFile(wb, 'modelo_importacao_tecnicos.xlsx');
  };

  const validosCount = tecnicosParsed.filter((t) => t.valido).length;
  const invalidosCount = tecnicosParsed.length - validosCount;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 border border-slate-100 max-h-[90vh] flex flex-col">
        {/* Cabeçalho */}
        <div className="flex justify-between items-start pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-[#FF5000]">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Importar Técnicos via Planilha</h2>
              <p className="text-xs text-slate-500">
                Suporta planilhas Excel (.xlsx, .xls) e arquivos CSV
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {resultado ? (
            /* Tela de Sucesso */
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Importação Concluída com Sucesso!</h3>
                <p className="text-sm text-slate-600 mt-2">
                  Total de <strong>{resultado.total}</strong> técnicos processados:
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto pt-2">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                  <p className="text-2xl font-extrabold text-emerald-700">{resultado.inseridos}</p>
                  <p className="text-xs font-semibold text-emerald-600 uppercase mt-0.5">Novos Cadastrados</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                  <p className="text-2xl font-extrabold text-blue-700">{resultado.atualizados}</p>
                  <p className="text-xs font-semibold text-blue-600 uppercase mt-0.5">Atualizados</p>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={handleClose}
                  className="px-6 py-2.5 bg-[#FF5000] hover:bg-[#E04700] text-white rounded-xl font-semibold shadow-sm transition-colors text-sm"
                >
                  Concluir e Ver Técnicos
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Área de Upload / Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-[#FF5000] bg-orange-50/60 scale-[0.99]'
                    : arquivoNome
                    ? 'border-emerald-300 bg-emerald-50/30'
                    : 'border-slate-300 hover:border-orange-300 hover:bg-slate-50/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-orange-100/80 text-[#FF5000] flex items-center justify-center shadow-xs">
                    {carregandoArquivo ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <Upload className="w-6 h-6" />
                    )}
                  </div>

                  {arquivoNome ? (
                    <div>
                      <p className="text-sm font-bold text-slate-800 flex items-center justify-center gap-1.5">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        {arquivoNome}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Clique ou arraste outro arquivo para substituir
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-slate-700">
                        Clique para selecionar ou arraste o arquivo da planilha aqui
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Formatos suportados: .xlsx, .xls, .csv
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Botão de Download de Modelo e Dica */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs">
                <div className="text-slate-600">
                  <span className="font-semibold text-slate-800">Formato esperado:</span> Colunas com{' '}
                  <code className="bg-slate-200/70 px-1 py-0.5 rounded text-slate-800 font-mono">Nome do Técnico</code> e{' '}
                  <code className="bg-slate-200/70 px-1 py-0.5 rounded text-slate-800 font-mono">Email</code> (Telefone opcional).
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadModelo();
                  }}
                  className="inline-flex items-center gap-1.5 text-[#FF5000] hover:text-[#E04700] font-semibold text-xs transition-colors shrink-0"
                >
                  <Download className="w-3.5 h-3.5" /> Baixar Modelo Exemplo
                </button>
              </div>

              {/* Mensagem de Erro Geral */}
              {erroGeral && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Atenção no arquivo</p>
                    <p>{erroGeral}</p>
                  </div>
                </div>
              )}

              {/* Pré-visualização dos Registros Parseados */}
              {tecnicosParsed.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-slate-900">
                        Pré-visualização ({tecnicosParsed.length} encontrados)
                      </h3>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full">
                        {validosCount} válidos
                      </span>
                      {invalidosCount > 0 && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[11px] font-bold rounded-full">
                          {invalidosCount} com pendência
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Nome</th>
                          <th className="py-2.5 px-3">E-mail</th>
                          <th className="py-2.5 px-3">Telefone</th>
                          <th className="py-2.5 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {tecnicosParsed.slice(0, 50).map((tec, idx) => (
                          <tr
                            key={idx}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              !tec.valido ? 'bg-amber-50/50' : ''
                            }`}
                          >
                            <td className="py-2 px-3 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-2 px-3 font-medium text-slate-800">
                              {tec.nome || <span className="text-red-400 italic">Vazio</span>}
                            </td>
                            <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">
                              {tec.email || <span className="text-red-400 italic">Vazio</span>}
                            </td>
                            <td className="py-2 px-3 text-slate-500">
                              {tec.telefone || <span className="text-slate-300">-</span>}
                            </td>
                            <td className="py-2 px-3 text-right">
                              {tec.valido ? (
                                <span className="text-emerald-600 font-semibold inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Válido
                                </span>
                              ) : (
                                <span className="text-amber-600 font-semibold inline-flex items-center gap-1" title={tec.motivoInvalido}>
                                  <AlertTriangle className="w-3.5 h-3.5" /> {tec.motivoInvalido}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {tecnicosParsed.length > 50 && (
                    <p className="text-[11px] text-slate-400 text-center italic">
                      Mostrando os primeiros 50 registros de {tecnicosParsed.length}.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Rodapé de Ações */}
        {!resultado && (
          <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={salvando}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-50 transition-colors text-sm"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleConfirmarImportacao}
              disabled={salvando || validosCount === 0 || carregandoArquivo}
              className="px-5 py-2 bg-[#FF5000] hover:bg-[#E04700] text-white rounded-xl font-semibold disabled:opacity-50 flex items-center gap-2 transition-colors shadow-sm text-sm"
            >
              {salvando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  Importar {validosCount > 0 ? `(${validosCount})` : ''}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
