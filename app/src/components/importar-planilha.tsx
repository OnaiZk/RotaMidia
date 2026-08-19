'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, FileSpreadsheet, X, AlertCircle, Check, ChevronDown, ChevronUp, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

export interface PontoImportado {
  numeroPonto: string;
  endereco: string;
  referencia: string;
  tipo: 'totem' | 'abrigo' | 'outro';
  latitude?: number;
  longitude?: number;
}

interface ResultadoImportacao {
  pontos: PontoImportado[];
  atividades: string[];
  erros: string[];
  colunasDetectadas: string[];
  totalLinhas: number;
}

// Mapeamento flexível de nomes de colunas da planilha → campos do sistema
const MAPEAMENTO_COLUNAS: Record<string, string[]> = {
  numeroPonto: [
    'n° parada', 'nº parada', 'n parada', 'numero da parada', 'número da parada',
    'n° abrigo', 'nº abrigo', 'n abrigo', 'numero do abrigo', 'número do abrigo', 'num abrigo',
    'numero', 'número', 'num', 'codigo', 'código', 'cod', 'id',
    'ponto', 'numero do ponto', 'número do ponto', 'num ponto', 'n° ponto',
    'formulario', 'formulário', 'n° formulario', 'nº formulário',
    'rota', 'rt-ma', 'rtcc13',
  ],
  endereco: [
    'endereco', 'endereço', 'end', 'logradouro', 'rua', 'avenida',
    'av', 'local', 'localização', 'localizacao', 'address',
  ],
  referencia: [
    'bairro', 'regiao', 'região', 'referencia', 'referência', 'ref',
    'ponto de referencia', 'ponto de referência', 'itinerario', 'itinerário',
    'filial', 'semana', 'observacao', 'observação', 'obs',
    'complemento', 'detalhe', 'detalhes', 'neighborhood',
  ],
  tipo: [
    'modelo de abrigo', 'modelo abrigo', 'modelo', 'tipo', 'type',
    'equipamento', 'mobiliario', 'mobiliário', 'tipo de equipamento',
    'tipo equipamento', 'categoria',
  ],
  latitude: [
    'latitude', 'lat', 'coordenada y', 'coord y', 'y',
  ],
  longitude: [
    'longitude', 'long', 'lng', 'lon', 'coordenada x', 'coord x', 'x',
  ],
};

// Palavras-chave que indicam colunas de atividades (checklist)
const PALAVRAS_ATIVIDADE = [
  'limpeza', 'limpar', 'lavagem', 'verificar', 'checar', 'inspecionar',
  'trocar', 'instalar', 'reparar', 'pintar', 'pintura', 'iluminação', 'iluminacao',
  'vidro', 'vidros', 'banco', 'assento', 'cobertura', 'telhado',
  'sinalização', 'sinalizacao', 'painel', 'estrutura', 'elétrica', 'eletrica',
  'poste', 'luminária', 'luminaria', 'manutenção', 'manutencao',
  'adesivo', 'envelopamento', 'backlight', 'display', 'totem', 'vistoria',
];

function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function detectarCampo(nomeColuna: string): string | null {
  const normalizado = normalizarTexto(nomeColuna);
  
  for (const [campo, aliases] of Object.entries(MAPEAMENTO_COLUNAS)) {
    for (const alias of aliases) {
      if (normalizado === normalizarTexto(alias) || normalizado.includes(normalizarTexto(alias))) {
        return campo;
      }
    }
  }
  return null;
}

function detectarTipo(valor: string): 'totem' | 'abrigo' | 'outro' {
  const v = normalizarTexto(valor);
  if (v.includes('totem') || v.includes('mup') || v.includes('digital')) return 'totem';
  if (v.includes('abrigo') || v.includes('minimalista') || v.includes('onibus') || v.includes('parada') || v.includes('leve')) return 'abrigo';
  return 'outro';
}

function ehColunaAtividade(nomeColuna: string): boolean {
  const norm = normalizarTexto(nomeColuna);
  if (detectarCampo(nomeColuna)) return false;
  if (PALAVRAS_ATIVIDADE.some(p => norm.includes(normalizarTexto(p)))) return true;
  return false;
}

function parseFloat2(val: any): number | undefined {
  if (val === null || val === undefined || val === '') return undefined;
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  return isNaN(num) ? undefined : num;
}

interface ImportarPlanilhaProps {
  onImportar: (pontos: PontoImportado[], atividades: string[]) => void;
}

export default function ImportarPlanilha({ onImportar }: ImportarPlanilhaProps) {
  const [modalAberto, setModalAberto] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processarArquivo = useCallback(async (file: File) => {
    setLoading(true);
    setResultado(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      
      // Usar a primeira sheet
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      // Converter para JSON
      const rawData: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      
      if (rawData.length === 0) {
        setResultado({
          pontos: [],
          atividades: [],
          erros: ['A planilha está vazia ou não foi possível ler os dados.'],
          colunasDetectadas: [],
          totalLinhas: 0,
        });
        return;
      }

      // Detectar colunas
      const colunas = Object.keys(rawData[0]);
      const mapeamento: Record<string, string> = {};
      const colunasAtividade: string[] = [];
      const erros: string[] = [];

      for (const col of colunas) {
        const campo = detectarCampo(col);
        if (campo) {
          mapeamento[col] = campo;
        } else if (ehColunaAtividade(col)) {
          colunasAtividade.push(col);
        }
      }

      // Verificar campo de endereço
      const camposMapeados = Object.values(mapeamento);
      if (!camposMapeados.includes('endereco')) {
        const possiveisEnderecos = colunas.filter(c => {
          const valores = rawData.slice(0, 5).map(r => String(r[c] || ''));
          return valores.some(v => v.length > 10 && (v.includes(',') || v.toLowerCase().includes('rua') || v.toLowerCase().includes('av')));
        });
        if (possiveisEnderecos.length > 0) {
          mapeamento[possiveisEnderecos[0]] = 'endereco';
          erros.push(`Coluna "${possiveisEnderecos[0]}" usada como Endereço (identificada automaticamente).`);
        } else {
          erros.push('⚠️ Não foi encontrada uma coluna de Endereço. Verifique os títulos do cabeçalho.');
        }
      }

      // Se não encontrou colunas explícitas de atividades, usar colunas extras ou atividades padrão
      if (colunasAtividade.length === 0) {
        const colunasExtras = colunas.filter(c => !mapeamento[c] && c.trim().length > 1);
        for (const col of colunasExtras) {
          const norm = normalizarTexto(col);
          if (!['ordem', 'data', 'semana', 'regiao', 'filial'].includes(norm)) {
            colunasAtividade.push(col);
          }
        }
      }

      // Extrair pontos
      const pontos: PontoImportado[] = [];
      
      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        
        let endereco = '';
        let numeroPonto = '';
        let bairro = '';
        let tipoStr = '';
        let lat: number | undefined;
        let lng: number | undefined;

        for (const [colName, campo] of Object.entries(mapeamento)) {
          const valor = String(row[colName] || '').trim();
          switch (campo) {
            case 'endereco': endereco = valor; break;
            case 'numeroPonto': 
              if (!numeroPonto || numeroPonto === '') numeroPonto = valor; 
              break;
            case 'referencia': 
              bairro = bairro ? `${bairro} • ${valor}` : valor; 
              break;
            case 'tipo': tipoStr = valor; break;
            case 'latitude': lat = parseFloat2(row[colName]); break;
            case 'longitude': lng = parseFloat2(row[colName]); break;
          }
        }

        // Se o endereço estiver vazio, ignorar
        if (!endereco) continue;

        pontos.push({
          numeroPonto: numeroPonto || `P-${pontos.length + 1}`,
          endereco,
          referencia: bairro,
          tipo: tipoStr ? detectarTipo(tipoStr) : 'abrigo',
          latitude: lat,
          longitude: lng,
        });
      }

      // Formatar atividades
      const atividades = colunasAtividade.length > 0 
        ? colunasAtividade.map(col => col.trim())
        : ['Limpeza geral', 'Verificar iluminação', 'Verificar estrutura', 'Verificar sinalização'];

      setResultado({
        pontos,
        atividades,
        erros,
        colunasDetectadas: Object.entries(mapeamento).map(([col, campo]) => `${col} → ${campo}`),
        totalLinhas: rawData.length,
      });

    } catch (err: any) {
      setResultado({
        pontos: [],
        atividades: [],
        erros: [`Erro ao ler arquivo: ${err.message}`],
        colunasDetectadas: [],
        totalLinhas: 0,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processarArquivo(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      processarArquivo(file);
    }
  };

  const handleConfirmar = () => {
    if (resultado && resultado.pontos.length > 0) {
      onImportar(resultado.pontos, resultado.atividades);
      setModalAberto(false);
      setResultado(null);
    }
  };

  // Função para baixar modelo de planilha idêntico ao da folha
  const baixarModelo = () => {
    const dadosModelo = [
      {
        'N° Parada': '3900000089',
        'ROTA': 'RT-MA-018',
        'ORDEM': 1,
        'DATA': '09/08/2026',
        'SEMANA': '6ª SEMANA',
        'Região': 'NORTE',
        'Bairro': 'JARAGUÁ',
        'Endereço': 'RUA FLOR DA CACHOEIRA, 211',
        'Latitude': -23.5802137,
        'Longitude': -46.760633,
        'Filial': 'MATRIZ',
        'Modelo de Abrigo': 'MINIMALISTA LEVE',
        'ITINERÁRIO': 'OK',
        'Limpeza geral': 'OK',
        'Verificar iluminação': 'OK',
        'Verificar estrutura': 'OK',
        'Verificar vidros': 'OK',
      },
      {
        'N° Parada': '3900000088',
        'ROTA': 'RT-MA-018',
        'ORDEM': 2,
        'DATA': '09/08/2026',
        'SEMANA': '6ª SEMANA',
        'Região': 'NORTE',
        'Bairro': 'JARAGUÁ',
        'Endereço': 'RUA FLOR DA CACHOEIRA, 211',
        'Latitude': -23.580326,
        'Longitude': -46.761037,
        'Filial': 'MATRIZ',
        'Modelo de Abrigo': 'MINIMALISTA LEVE',
        'ITINERÁRIO': 'OK',
        'Limpeza geral': 'OK',
        'Verificar iluminação': 'OK',
        'Verificar estrutura': 'OK',
        'Verificar vidros': 'OK',
      },
      {
        'N° Parada': '3900000067',
        'ROTA': 'RT-MA-018',
        'ORDEM': 3,
        'DATA': '09/08/2026',
        'SEMANA': '6ª SEMANA',
        'Região': 'NORTE',
        'Bairro': 'JARAGUÁ',
        'Endereço': 'RUA NEIVA, 324',
        'Latitude': -23.5802296,
        'Longitude': -46.760561,
        'Filial': 'MATRIZ',
        'Modelo de Abrigo': 'MINIMALISTA LEVE',
        'ITINERÁRIO': 'OK',
        'Limpeza geral': 'OK',
        'Verificar iluminação': 'OK',
        'Verificar estrutura': 'OK',
        'Verificar vidros': 'OK',
      },
      {
        'N° Parada': '73010033',
        'ROTA': 'RT-MA-018',
        'ORDEM': 5,
        'DATA': '09/08/2026',
        'SEMANA': '6ª SEMANA',
        'Região': 'NORTE',
        'Bairro': 'SÃO DOMINGOS',
        'Endereço': 'RUA ISAAC FRANCISCO PIMENTA, 503',
        'Latitude': -23.4915236,
        'Longitude': -46.75673,
        'Filial': 'MATRIZ',
        'Modelo de Abrigo': 'TOTEM MARROM',
        'ITINERÁRIO': 'OK',
        'Limpeza geral': 'OK',
        'Verificar iluminação': 'OK',
        'Verificar estrutura': 'OK',
        'Verificar vidros': 'OK',
      },
      {
        'N° Parada': '73010328',
        'ROTA': 'RT-MA-018',
        'ORDEM': 9,
        'DATA': '09/08/2026',
        'SEMANA': '6ª SEMANA',
        'Região': 'NORTE',
        'Bairro': 'SÃO DOMINGOS',
        'Endereço': 'RUA BOAVENTURA PEREIRA, 76',
        'Latitude': -23.490479,
        'Longitude': -46.756467,
        'Filial': 'MATRIZ',
        'Modelo de Abrigo': 'MINIMALISTA LEVE',
        'ITINERÁRIO': 'OK',
        'Limpeza geral': 'OK',
        'Verificar iluminação': 'OK',
        'Verificar estrutura': 'OK',
        'Verificar vidros': 'OK',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(dadosModelo);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pontos_de_Atividade');
    XLSX.writeFile(wb, 'modelo_ordem_de_servico.xlsx');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setModalAberto(true)}
        className="text-sm text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-semibold flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all border border-emerald-200 shadow-xs cursor-pointer"
      >
        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
        Importar do Excel (.xlsx)
      </button>

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Importar Planilha de Atividades</h2>
                  <p className="text-xs text-slate-500">Formato idêntico à folha de campo impressa (.xlsx, .xls ou .csv)</p>
                </div>
              </div>
              <button 
                onClick={() => { setModalAberto(false); setResultado(null); }}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
              {/* Upload Zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-8 text-center bg-slate-50/60 hover:bg-emerald-50/40 transition-all cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 bg-white rounded-2xl shadow-xs border border-slate-200 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform text-slate-500 group-hover:text-emerald-600">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="font-bold text-slate-800 text-sm">
                  {loading ? 'Lendo e processando planilha...' : 'Arraste e solte o arquivo da planilha aqui'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  ou clique para selecionar do seu computador (.xlsx, .xls, .csv)
                </p>
              </div>

              {/* Box com Instruções e Botão de Download de Modelo */}
              <div className="p-4 bg-blue-50/70 rounded-xl border border-blue-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-blue-900 mb-1">📋 Layout compatível com a folha física:</p>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    O sistema reconhece automaticamente as colunas: <strong>N° Parada, Endereço, Bairro, Modelo de Abrigo, Latitude, Longitude</strong> e as tarefas de checklist.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={baixarModelo}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-blue-50 text-blue-700 font-semibold text-xs rounded-lg border border-blue-200 transition-colors shrink-0 shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar Planilha Modelo
                </button>
              </div>

              {/* Resultado da importação */}
              {resultado && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Erros / Alertas */}
                  {resultado.erros.length > 0 && (
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                      {resultado.erros.map((erro, i) => (
                        <p key={i} className="text-xs text-amber-800 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                          <span>{erro}</span>
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Resumo de Sucesso */}
                  {resultado.pontos.length > 0 && (
                    <>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-emerald-50 p-3.5 rounded-xl text-center border border-emerald-100">
                          <p className="text-2xl font-extrabold text-emerald-700">{resultado.pontos.length}</p>
                          <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wide">Pontos Identificados</p>
                        </div>
                        <div className="bg-blue-50 p-3.5 rounded-xl text-center border border-blue-100">
                          <p className="text-2xl font-extrabold text-blue-700">{resultado.atividades.length}</p>
                          <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wide">Atividades Checklist</p>
                        </div>
                        <div className="bg-slate-100 p-3.5 rounded-xl text-center border border-slate-200">
                          <p className="text-2xl font-extrabold text-slate-700">{resultado.colunasDetectadas.length}</p>
                          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Colunas Mapeadas</p>
                        </div>
                      </div>

                      {/* Atividades detectadas */}
                      {resultado.atividades.length > 0 && (
                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                          <p className="text-xs font-bold text-slate-700 mb-2">Checklist de atividades detectado:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {resultado.atividades.map((a, i) => (
                              <span key={i} className="px-2.5 py-1 bg-white text-slate-700 text-xs font-medium rounded-lg border border-slate-200 shadow-2xs">
                                ✓ {a}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Preview dos pontos */}
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => setPreviewExpanded(!previewExpanded)}
                          className="flex items-center justify-between w-full text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100/80 hover:bg-slate-200/70 p-2.5 rounded-xl transition-colors"
                        >
                          <span>Prévia dos dados importados ({resultado.pontos.length} pontos)</span>
                          {previewExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        
                        {previewExpanded && (
                          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                            <div className="max-h-56 overflow-y-auto">
                              <table className="w-full text-xs text-left">
                                <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 border-b border-slate-200">
                                  <tr>
                                    <th className="py-2 px-3">#</th>
                                    <th className="py-2 px-3">Nº Parada</th>
                                    <th className="py-2 px-3">Endereço</th>
                                    <th className="py-2 px-3">Bairro / Ref.</th>
                                    <th className="py-2 px-3">Modelo</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                  {resultado.pontos.slice(0, 100).map((p, i) => (
                                    <tr key={i} className="hover:bg-slate-50/80">
                                      <td className="py-2 px-3 text-slate-400 font-mono">{i + 1}</td>
                                      <td className="py-2 px-3 font-semibold text-slate-900 font-mono">{p.numeroPonto}</td>
                                      <td className="py-2 px-3 max-w-[220px] truncate">{p.endereco}</td>
                                      <td className="py-2 px-3 text-slate-500 max-w-[150px] truncate">{p.referencia || '-'}</td>
                                      <td className="py-2 px-3">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                          p.tipo === 'totem' ? 'bg-purple-100 text-purple-700' :
                                          p.tipo === 'abrigo' ? 'bg-blue-100 text-blue-700' :
                                          'bg-slate-100 text-slate-600'
                                        }`}>
                                          {p.tipo === 'totem' ? 'Totem' : p.tipo === 'abrigo' ? 'Abrigo' : 'Outro'}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {resultado.pontos.length > 100 && (
                                <p className="text-center text-xs text-slate-400 py-2.5 bg-slate-50">
                                  ... e mais {resultado.pontos.length - 100} pontos na lista
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80">
              <button
                type="button"
                onClick={() => { setModalAberto(false); setResultado(null); }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              
              {resultado && resultado.pontos.length > 0 && (
                <button
                  type="button"
                  onClick={handleConfirmar}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  Preencher Formulário com {resultado.pontos.length} Pontos
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
