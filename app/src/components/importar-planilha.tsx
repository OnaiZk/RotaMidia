'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  X, 
  AlertCircle, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Download, 
  Layers, 
  MapPin, 
  Search, 
  Filter, 
  Calendar, 
  CheckSquare, 
  Square, 
  Sparkles, 
  Loader2, 
  Users, 
  ArrowRight,
  ListFilter
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Id } from '@convex/_generated/dataModel';
import { useRouter } from 'next/navigation';

export interface PontoImportado {
  numeroPonto: string;
  numeroEletro?: string;
  numeroParada?: string;
  rota?: string;
  modelo?: string;
  endereco: string;
  referencia: string;
  tipo: 'totem' | 'abrigo' | 'outro';
  latitude?: number;
  longitude?: number;
  ordem?: number;
}

export interface RotaAgrupada {
  rota: string;
  pontos: PontoImportado[];
  semana?: string;
  area?: string;
  filial?: string;
  bairros: string[];
  totalPontos: number;
  totalTotens: number;
  totalAbrigos: number;
}

interface ImportarPlanilhaProps {
  onImportar?: (pontos: PontoImportado[], atividades: string[], tituloSugerido?: string) => void;
  modoLoteDireto?: boolean;
  botaoTexto?: string;
  botaoClass?: string;
}

// Mapeamento flexível de nomes de colunas da planilha → campos do sistema
const MAPEAMENTO_COLUNAS: Record<string, string[]> = {
  numeroEletro: [
    'n° eletro', 'nº eletro', 'n eletro', 'eletro', 'num eletro', 'cod eletro',
    'ativo', 'equipamento', 'codigo eletro', 'código eletro'
  ],
  numeroParada: [
    'n° parada', 'nº parada', 'n parada', 'numero da parada', 'número da parada',
    'num parada', 'parada', 'codigo parada', 'código parada', 'id parada',
  ],
  rota: [
    'rota', 'route', 'rt', 'rt-ma', 'rt-fl', 'linha', 'itinerario rota', 'itinerário rota'
  ],
  ordem: [
    'ordem', 'sequencia', 'sequência', 'seq', 'posicao', 'posição', 'pos'
  ],
  semana: [
    'semana', 'ciclo', 'week', 'fase'
  ],
  area: [
    'area de trabalho', 'área de trabalho', 'area', 'área', 'regiao', 'região', 'zona', 'setor'
  ],
  bairro: [
    'bairro', 'subprefeitura', 'distrito', 'neighborhood'
  ],
  endereco: [
    'endereco', 'endereço', 'end', 'logradouro', 'rua', 'avenida',
    'av', 'local', 'localização', 'localizacao', 'address',
  ],
  referencia: [
    'referencia', 'referência', 'ref', 'ponto de referencia', 'ponto de referência',
    'itinerario', 'itinerário', 'observacao', 'observação', 'obs', 'complemento', 'detalhe', 'detalhes'
  ],
  filial: [
    'filial', 'base', 'unidade', 'posto'
  ],
  tipo: [
    'modelo de abrigo', 'modelo abrigo', 'modelo', 'tipo', 'type',
    'mobiliario', 'mobiliário', 'tipo de equipamento', 'tipo equipamento', 'categoria',
  ],
  latitude: [
    'latitude', 'lat', 'coordenada y', 'coord y', 'y',
  ],
  longitude: [
    'longitude', 'long', 'lng', 'lon', 'coordenada x', 'coord x', 'x',
  ],
};

const PALAVRAS_ATIVIDADE = [
  'limpeza', 'limpar', 'lavagem', 'verificar', 'checar', 'inspecionar',
  'trocar', 'instalar', 'reparar', 'pintar', 'pintura', 'iluminação', 'iluminacao',
  'vidro', 'vidros', 'banco', 'assento', 'cobertura', 'telhado',
  'sinalização', 'sinalizacao', 'painel', 'estrutura', 'elétrica', 'eletrica',
  'poste', 'luminária', 'luminaria', 'manutenção', 'manutencao',
  'adesivo', 'envelopamento', 'backlight', 'display', 'vistoria',
];

const CHECKLIST_PREVENTIVA_PADRAO = [
  'Manutenção Preventiva do Endereço/Ponto'
];

function normalizarTexto(texto: string): string {
  return String(texto || '')
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

function detectarTipo(valor: string, numeroEletro?: string): 'totem' | 'abrigo' | 'outro' {
  const v = normalizarTexto(valor);
  if (v.includes('totem') || v.includes('mup') || v.includes('digital')) return 'totem';
  if (
    v.includes('abrigo') || 
    v.includes('minimalista') || 
    v.includes('brutalista') || 
    v.includes('caos') || 
    v.includes('corbucci') || 
    v.includes('tech') || 
    v.includes('estacao') || 
    v.includes('onibus') || 
    v.includes('parada') || 
    v.includes('leve')
  ) return 'abrigo';

  if (numeroEletro) {
    const e = numeroEletro.trim().toUpperCase();
    if (e.startsWith('T')) return 'totem';
    if (e.startsWith('A')) return 'abrigo';
  }

  return 'abrigo';
}

function parseFloat2(val: any): number | undefined {
  if (val === null || val === undefined || val === '') return undefined;
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  return isNaN(num) ? undefined : num;
}

export default function ImportarPlanilha({ 
  onImportar, 
  modoLoteDireto = false,
  botaoTexto,
  botaoClass 
}: ImportarPlanilhaProps) {
  const router = useRouter();
  const tecnicos = useQuery(api.tecnicos.list, {}) || [];
  const createBatchOrdens = useMutation(api.ordensServico.createBatchOrdens);

  const [modalAberto, setModalAberto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gerandoLote, setGerandoLote] = useState(false);
  const [progressoLote, setProgressoLote] = useState<{ atual: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dados brutos lidos
  const [workbookData, setWorkbookData] = useState<{ [sheetName: string]: any[] } | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');

  // Rotas agrupadas e pontos avulsos
  const [rotasAgrupadas, setRotasAgrupadas] = useState<RotaAgrupada[]>([]);
  const [pontosAvulsos, setPontosAvulsos] = useState<PontoImportado[]>([]);
  const [atividadesDetectadas, setAtividadesDetectadas] = useState<string[]>(CHECKLIST_PREVENTIVA_PADRAO);
  const [erros, setErros] = useState<string[]>([]);

  // Filtros de seleção
  const [filtroSemana, setFiltroSemana] = useState<string>('todas');
  const [filtroArea, setFiltroArea] = useState<string>('todas');
  const [filtroFilial, setFiltroFilial] = useState<string>('todas');
  const [buscaTexto, setBuscaTexto] = useState<string>('');

  // Rota selecionada para visualização/importação individual
  const [rotaVisualizada, setRotaVisualizada] = useState<RotaAgrupada | null>(null);
  const [previewExpanded, setPreviewExpanded] = useState<boolean>(true);

  // Seleção de múltiplas rotas para criação em lote
  const [rotasSelecionadasLote, setRotasSelecionadasLote] = useState<string[]>([]);
  const [dataLimiteLote, setDataLimiteLote] = useState<string>('');
  const [statusLote, setStatusLote] = useState<'rascunho' | 'ativa'>('rascunho');
  const [tecnicosLote, setTecnicosLote] = useState<string[]>([]);

  // Extrair semanas, áreas e filiais únicas
  const semanasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    rotasAgrupadas.forEach(r => { if (r.semana) set.add(r.semana); });
    return Array.from(set).sort();
  }, [rotasAgrupadas]);

  const areasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    rotasAgrupadas.forEach(r => { if (r.area) set.add(r.area); });
    return Array.from(set).sort();
  }, [rotasAgrupadas]);

  const filiaisDisponiveis = useMemo(() => {
    const set = new Set<string>();
    rotasAgrupadas.forEach(r => { if (r.filial) set.add(r.filial); });
    return Array.from(set).sort();
  }, [rotasAgrupadas]);

  // Rotas filtradas para listagem
  const rotasFiltradas = useMemo(() => {
    return rotasAgrupadas.filter(r => {
      if (filtroSemana !== 'todas' && r.semana !== filtroSemana) return false;
      if (filtroArea !== 'todas' && r.area !== filtroArea) return false;
      if (filtroFilial !== 'todas' && r.filial !== filtroFilial) return false;
      if (buscaTexto.trim()) {
        const query = normalizarTexto(buscaTexto);
        const matchRota = normalizarTexto(r.rota).includes(query);
        const matchBairro = r.bairros.some(b => normalizarTexto(b).includes(query));
        const matchPonto = r.pontos.some(p => 
          normalizarTexto(p.endereco).includes(query) || 
          normalizarTexto(p.numeroPonto).includes(query) ||
          (p.numeroEletro && normalizarTexto(p.numeroEletro).includes(query)) ||
          (p.numeroParada && normalizarTexto(p.numeroParada).includes(query))
        );
        if (!matchRota && !matchBairro && !matchPonto) return false;
      }
      return true;
    });
  }, [rotasAgrupadas, filtroSemana, filtroArea, filtroFilial, buscaTexto]);

  // Processar dados da sheet selecionada
  const processarSheet = useCallback((rawData: any[]) => {
    if (!rawData || rawData.length === 0) {
      setRotasAgrupadas([]);
      setPontosAvulsos([]);
      setErros(['A aba selecionada não possui dados legíveis.']);
      return;
    }

    const colunas = Object.keys(rawData[0]);
    const mapeamento: Record<string, string> = {};
    const colunasAtividade: string[] = [];
    const errosDetectados: string[] = [];

    for (const col of colunas) {
      const campo = detectarCampo(col);
      if (campo) {
        mapeamento[col] = campo;
      } else {
        const norm = normalizarTexto(col);
        if (PALAVRAS_ATIVIDADE.some(p => norm.includes(normalizarTexto(p)))) {
          colunasAtividade.push(col);
        }
      }
    }

    // Verificar se tem endereço
    const camposMapeados = Object.values(mapeamento);
    if (!camposMapeados.includes('endereco')) {
      const possiveisEnderecos = colunas.filter(c => {
        const valores = rawData.slice(0, 5).map(r => String(r[c] || ''));
        return valores.some(v => v.length > 8 && (v.includes(',') || v.toLowerCase().includes('rua') || v.toLowerCase().includes('av')));
      });
      if (possiveisEnderecos.length > 0) {
        mapeamento[possiveisEnderecos[0]] = 'endereco';
      } else {
        errosDetectados.push('Não foi encontrada uma coluna de Endereço com clareza.');
      }
    }

    // Extrair pontos
    const mapaRotas: Record<string, PontoImportado[]> = {};
    const metaRotas: Record<string, { semana?: string; area?: string; filial?: string; bairros: Set<string> }> = {};
    const listaPontosGeral: PontoImportado[] = [];

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      
      let endereco = '';
      let numeroEletro = '';
      let numeroParada = '';
      let rota = '';
      let semana = '';
      let area = '';
      let bairro = '';
      let filial = '';
      let modeloStr = '';
      let referencia = '';
      let lat: number | undefined;
      let lng: number | undefined;
      let ordemNum: number | undefined;

      for (const [colName, campo] of Object.entries(mapeamento)) {
        const valor = String(row[colName] ?? '').trim();
        switch (campo) {
          case 'endereco': endereco = valor; break;
          case 'numeroEletro': numeroEletro = valor; break;
          case 'numeroParada': numeroParada = valor; break;
          case 'rota': rota = valor; break;
          case 'semana': semana = valor; break;
          case 'area': area = valor; break;
          case 'bairro': bairro = valor; break;
          case 'filial': filial = valor; break;
          case 'tipo': modeloStr = valor; break;
          case 'referencia': referencia = valor; break;
          case 'ordem': {
            const parsed = parseInt(valor, 10);
            if (!isNaN(parsed)) ordemNum = parsed;
            break;
          }
          case 'latitude': lat = parseFloat2(row[colName]); break;
          case 'longitude': lng = parseFloat2(row[colName]); break;
        }
      }

      if (!endereco && !numeroEletro && !numeroParada) continue;
      if (!endereco) {
        endereco = `Ponto ${numeroEletro || numeroParada || i + 1}`;
      }

      let numeroPonto = '';
      if (numeroEletro && numeroParada) {
        numeroPonto = `${numeroEletro} (${numeroParada})`;
      } else if (numeroEletro) {
        numeroPonto = numeroEletro;
      } else if (numeroParada) {
        numeroPonto = numeroParada;
      } else {
        numeroPonto = `P-${i + 1}`;
      }

      // Montar referência rica
      const partesRef: string[] = [];
      if (bairro) partesRef.push(bairro);
      if (area) partesRef.push(area);
      if (filial && filial !== area) partesRef.push(filial);
      if (semana) partesRef.push(semana);
      if (referencia) partesRef.push(referencia);

      const pontoObj: PontoImportado = {
        numeroPonto,
        numeroEletro: numeroEletro || undefined,
        numeroParada: numeroParada || undefined,
        rota: rota || undefined,
        modelo: modeloStr || undefined,
        endereco,
        referencia: partesRef.join(' • '),
        tipo: detectarTipo(modeloStr, numeroEletro),
        latitude: lat,
        longitude: lng,
        ordem: ordemNum ?? (i + 1),
      };

      listaPontosGeral.push(pontoObj);

      const rotaChave = rota || 'SEM_ROTA';
      if (!mapaRotas[rotaChave]) {
        mapaRotas[rotaChave] = [];
        metaRotas[rotaChave] = {
          semana: semana || undefined,
          area: area || undefined,
          filial: filial || undefined,
          bairros: new Set<string>(),
        };
      }
      mapaRotas[rotaChave].push(pontoObj);
      if (bairro) metaRotas[rotaChave].bairros.add(bairro);
    }

    // Organizar rotas agrupadas
    const rotasArray: RotaAgrupada[] = Object.entries(mapaRotas).map(([nomeRota, pontosDaRota]) => {
      pontosDaRota.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
      const meta = metaRotas[nomeRota];
      const totalTotens = pontosDaRota.filter(p => p.tipo === 'totem').length;
      const totalAbrigos = pontosDaRota.filter(p => p.tipo === 'abrigo').length;

      return {
        rota: nomeRota,
        pontos: pontosDaRota,
        semana: meta?.semana,
        area: meta?.area,
        filial: meta?.filial,
        bairros: meta ? Array.from(meta.bairros) : [],
        totalPontos: pontosDaRota.length,
        totalTotens,
        totalAbrigos,
      };
    });

    // Ordenar rotas por nome
    rotasArray.sort((a, b) => a.rota.localeCompare(b.rota));

    setRotasAgrupadas(rotasArray);
    setPontosAvulsos(listaPontosGeral);
    setErros(errosDetectados);

    if (colunasAtividade.length > 0) {
      setAtividadesDetectadas(Array.from(new Set([...CHECKLIST_PREVENTIVA_PADRAO, ...colunasAtividade])));
    } else {
      setAtividadesDetectadas(CHECKLIST_PREVENTIVA_PADRAO);
    }

    // Se tiver apenas 1 rota (ou poucas), pré-selecionar a primeira
    if (rotasArray.length === 1) {
      setRotaVisualizada(rotasArray[0]);
    } else {
      setRotaVisualizada(null);
    }
  }, []);

  const processarArquivo = useCallback(async (file: File) => {
    setLoading(true);
    setErros([]);
    setRotasAgrupadas([]);
    setPontosAvulsos([]);
    setRotaVisualizada(null);
    setRotasSelecionadasLote([]);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      
      const sheetsData: { [sheetName: string]: any[] } = {};
      let maiorSheet = workbook.SheetNames[0];
      let maiorQtdLinhas = 0;

      for (const name of workbook.SheetNames) {
        const sheet = workbook.Sheets[name];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        sheetsData[name] = json;
        if (json.length > maiorQtdLinhas) {
          maiorQtdLinhas = json.length;
          maiorSheet = name;
        }
      }

      setWorkbookData(sheetsData);
      setSheetNames(workbook.SheetNames);
      setSelectedSheet(maiorSheet);
      processarSheet(sheetsData[maiorSheet] || []);
    } catch (err: any) {
      setErros([`Erro ao processar planilha: ${err.message || 'Arquivo inválido'}`]);
    } finally {
      setLoading(false);
    }
  }, [processarSheet]);

  const handleTrocaSheet = (sheetName: string) => {
    setSelectedSheet(sheetName);
    if (workbookData && workbookData[sheetName]) {
      processarSheet(workbookData[sheetName]);
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
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      processarArquivo(file);
    }
  };

  // Importar Rota Individual no Formulário
  const handleConfirmarRotaIndividual = (rotaObj: RotaAgrupada) => {
    if (!onImportar) return;

    const primeiroBairro = rotaObj.bairros[0] || rotaObj.area || '';
    const semanaDesc = rotaObj.semana ? ` - ${rotaObj.semana}` : '';
    const tituloSugerido = rotaObj.rota !== 'SEM_ROTA'
      ? `Preventiva - ${rotaObj.rota} - ${primeiroBairro}${semanaDesc} (${rotaObj.totalPontos} pontos)`
      : `Manutenção Preventiva - ${primeiroBairro} (${rotaObj.totalPontos} pontos)`;

    onImportar(rotaObj.pontos, atividadesDetectadas, tituloSugerido);
    setModalAberto(false);
  };

  // Alternar seleção de rota no lote
  const toggleSelecaoRotaLote = (nomeRota: string) => {
    setRotasSelecionadasLote(prev => 
      prev.includes(nomeRota)
        ? prev.filter(r => r !== nomeRota)
        : [...prev, nomeRota]
    );
  };

  const toggleSelecionarTodas = () => {
    if (rotasSelecionadasLote.length === rotasFiltradas.length) {
      setRotasSelecionadasLote([]);
    } else {
      setRotasSelecionadasLote(rotasFiltradas.map(r => r.rota));
    }
  };

  // Executar criação em lote
  const handleCriarOrdensEmLote = async () => {
    if (rotasSelecionadasLote.length === 0) {
      alert('Selecione ao menos uma rota para gerar as Ordens de Serviço.');
      return;
    }

    const confirmMsg = `Deseja realmente criar ${rotasSelecionadasLote.length} Ordens de Serviço preventivas no sistema?`;
    if (!confirm(confirmMsg)) return;

    try {
      setGerandoLote(true);
      setProgressoLote({ atual: 0, total: rotasSelecionadasLote.length });

      const rotasParaCriar = rotasAgrupadas.filter(r => rotasSelecionadasLote.includes(r.rota));
      
      // Dividir em lotes de 5 ordens para manter requisições atômicas e ágeis
      const tamanhoChunk = 5;
      let criadasCount = 0;

      for (let i = 0; i < rotasParaCriar.length; i += tamanhoChunk) {
        const chunk = rotasParaCriar.slice(i, i + tamanhoChunk);
        
        const payloadOrdens = chunk.map(r => {
          const primeiroBairro = r.bairros[0] || r.area || '';
          const semanaDesc = r.semana ? ` - ${r.semana}` : '';
          const titulo = r.rota !== 'SEM_ROTA'
            ? `Preventiva - ${r.rota} - ${primeiroBairro}${semanaDesc} (${r.totalPontos} pontos)`
            : `Manutenção Preventiva - ${primeiroBairro} (${r.totalPontos} pontos)`;

          return {
            titulo,
            descricao: `Manutenção preventiva periódica de mobiliário urbano.\nRota: ${r.rota} | Região: ${r.area || '-'} | Filial: ${r.filial || '-'} | Ciclo: ${r.semana || '-'}\nTotal de equipamentos: ${r.totalPontos} (${r.totalAbrigos} abrigos / ${r.totalTotens} totens).`,
            dataLimite: dataLimiteLote || undefined,
            status: statusLote,
            tecnicosIds: tecnicosLote.map(id => id as Id<"tecnicos">),
            atividadesPadrao: atividadesDetectadas,
            pontos: r.pontos.map((p, idx) => ({
              numeroPonto: p.numeroPonto,
              numeroEletro: p.numeroEletro,
              numeroParada: p.numeroParada,
              rota: p.rota,
              modelo: p.modelo,
              endereco: p.endereco,
              referencia: p.referencia,
              tipo: p.tipo,
              latitude: p.latitude,
              longitude: p.longitude,
              ordem: p.ordem ?? (idx + 1),
            })),
          };
        });

        await createBatchOrdens({ ordens: payloadOrdens });
        criadasCount += chunk.length;
        setProgressoLote({ atual: criadasCount, total: rotasParaCriar.length });
      }

      alert(`Sucesso! ${rotasParaCriar.length} Ordens de Serviço preventivas foram criadas.`);
      setModalAberto(false);
      router.push('/admin/ordens');
    } catch (err: any) {
      console.error('Erro ao gerar ordens em lote:', err);
      alert(`Erro na criação em lote: ${err.message || 'Ocorreu um erro inesperado'}`);
    } finally {
      setGerandoLote(false);
      setProgressoLote(null);
    }
  };

  const baixarModelo = () => {
    const dadosModelo = [
      {
        'Nº Eletro': 'A02561',
        'Nº Parada': '820012561',
        'ROTA': 'RT-FL-001',
        'ORDEM': 1,
        'SEMANA': '1º SEMANA',
        'Área de Trabalho': 'LESTE',
        'Bairro': 'TATUAPE',
        'Endereço': 'AVENIDA CONDESSA ELISABETH DE ROBIANO, 1880',
        'Latitude': -23.527869,
        'Longitude': -46.580245,
        'Filial': 'FILIAL LESTE',
        'Modelo de Abrigo': 'BRUTALISTA',
        'ITINERARIO': 'OK',
      },
      {
        'Nº Eletro': 'T11304',
        'Nº Parada': '820005098',
        'ROTA': 'RT-FL-001',
        'ORDEM': 2,
        'SEMANA': '1º SEMANA',
        'Área de Trabalho': 'LESTE',
        'Bairro': 'TATUAPE',
        'Endereço': 'RUA TUIUTI, 278',
        'Latitude': -23.52754,
        'Longitude': -46.575809,
        'Filial': 'FILIAL LESTE',
        'Modelo de Abrigo': 'TOTEM MARROM',
        'ITINERARIO': 'OK',
      },
      {
        'Nº Eletro': 'A00031',
        'Nº Parada': '630014982',
        'ROTA': 'RT-MA-010',
        'ORDEM': 1,
        'SEMANA': '5º SEMANA',
        'Área de Trabalho': 'OESTE',
        'Bairro': 'PINHEIROS',
        'Endereço': 'TERMINAL VILA MADALENA, SN',
        'Latitude': -23.547324,
        'Longitude': -46.690055,
        'Filial': 'MATRIZ',
        'Modelo de Abrigo': 'BRUTALISTA',
        'ITINERARIO': 'OK',
      }
    ];

    const ws = XLSX.utils.json_to_sheet(dadosModelo);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BASE');
    XLSX.writeFile(wb, 'modelo_base_preventivas.xlsx');
  };

  const ehBaseMultiRotas = rotasAgrupadas.length > 1 && rotasAgrupadas[0]?.rota !== 'SEM_ROTA';

  return (
    <>
      <button
        type="button"
        onClick={() => setModalAberto(true)}
        className={botaoClass || "text-sm text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-semibold flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all border border-emerald-200 shadow-xs cursor-pointer active:scale-[0.98]"}
      >
        <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>{botaoTexto || (modoLoteDireto ? 'Importar Preventivas em Lote' : 'Importar da Planilha Base')}</span>
      </button>

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl shadow-2xs">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">Importador de Preventivas & Rotas</h2>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full">
                      Base Eletromidia
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Suporta planilhas completas com milhares de pontos, rotas, semanas e equipamentos
                  </p>
                </div>
              </div>
              <button 
                onClick={() => { setModalAberto(false); }}
                className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
              {/* Upload Zone (se ainda não carregou ou para trocar) */}
              {rotasAgrupadas.length === 0 && !loading && (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-8 sm:p-10 text-center bg-slate-50/60 hover:bg-emerald-50/30 transition-all cursor-pointer group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center mx-auto mb-3.5 group-hover:scale-105 transition-transform text-slate-500 group-hover:text-emerald-600">
                    <Upload className="w-7 h-7" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-base">
                    Arraste a planilha de preventivas aqui
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
                    Selecione o arquivo <strong>BASE PREVENTIVAS.xlsx</strong> ou qualquer planilha com pontos e rotas (.xlsx, .xls ou .csv)
                  </p>
                </div>
              )}

              {loading && (
                <div className="py-14 text-center space-y-3">
                  <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mx-auto" />
                  <p className="font-bold text-slate-800 text-sm">Lendo e indexando rotas da planilha...</p>
                  <p className="text-xs text-slate-400">Processando coordenadas, equipamentos e checklist</p>
                </div>
              )}

              {/* Box de instruções e download modelo quando vazio */}
              {rotasAgrupadas.length === 0 && !loading && (
                <div className="p-4 bg-blue-50/70 rounded-xl border border-blue-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      Compatibilidade Automática com a Base de Campo:
                    </p>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      Reconhece automaticamente colunas: <strong>Nº Eletro, Nº Parada, ROTA, ORDEM, SEMANA, Área, Bairro, Endereço, Latitude, Longitude e Modelo</strong>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={baixarModelo}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-blue-50 text-blue-700 font-semibold text-xs rounded-lg border border-blue-200 transition-colors shrink-0 shadow-2xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar Planilha Modelo
                  </button>
                </div>
              )}

              {/* Erros / Alertas */}
              {erros.length > 0 && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                  {erros.map((erro, i) => (
                    <p key={i} className="text-xs text-amber-800 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                      <span>{erro}</span>
                    </p>
                  ))}
                </div>
              )}

              {/* CONTEÚDO QUANDO A PLANILHA FOI CARREGADA */}
              {rotasAgrupadas.length > 0 && (
                <div className="space-y-5">
                  {/* Top Bar: Seleção de Sheet + Botão Trocar Arquivo + Estatísticas */}
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                    <div className="flex flex-wrap items-center gap-3">
                      {sheetNames.length > 1 && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-slate-500" />
                            Aba:
                          </span>
                          <select
                            value={selectedSheet}
                            onChange={(e) => handleTrocaSheet(e.target.value)}
                            className="bg-white border border-slate-200 text-slate-800 text-xs font-bold rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            {sheetNames.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                        <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg shadow-2xs">
                          <strong>{pontosAvulsos.length.toLocaleString('pt-BR')}</strong> pontos
                        </span>
                        {ehBaseMultiRotas && (
                          <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg shadow-2xs">
                            <strong>{rotasAgrupadas.length}</strong> rotas detectadas
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-slate-600 hover:text-slate-900 underline font-medium cursor-pointer"
                    >
                      Trocar arquivo de planilha
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>

                  {/* SE FOR UMA BASE MULTI-ROTAS */}
                  {ehBaseMultiRotas && (
                    <div className="space-y-4">
                      {/* Filtros dinâmicos */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Ciclo / Semana
                          </label>
                          <select
                            value={filtroSemana}
                            onChange={(e) => setFiltroSemana(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="todas">Todas as Semanas</option>
                            {semanasDisponiveis.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Região / Área
                          </label>
                          <select
                            value={filtroArea}
                            onChange={(e) => setFiltroArea(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="todas">Todas as Áreas</option>
                            {areasDisponiveis.map(a => (
                              <option key={a} value={a}>{a}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Filial
                          </label>
                          <select
                            value={filtroFilial}
                            onChange={(e) => setFiltroFilial(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="todas">Todas as Filiais</option>
                            {filiaisDisponiveis.map(f => (
                              <option key={f} value={f}>{f}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Busca Rota / Bairro
                          </label>
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              placeholder="Ex: RT-FL-001..."
                              value={buscaTexto}
                              onChange={(e) => setBuscaTexto(e.target.value)}
                              className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Header da lista de rotas com Ação em Lote */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-1">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={toggleSelecionarTodas}
                            className="text-xs font-bold text-slate-700 flex items-center gap-1.5 hover:text-emerald-700 cursor-pointer"
                          >
                            {rotasSelecionadasLote.length > 0 && rotasSelecionadasLote.length === rotasFiltradas.length ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                            <span>
                              {rotasSelecionadasLote.length > 0 && rotasSelecionadasLote.length === rotasFiltradas.length
                                ? 'Desmarcar todas'
                                : `Selecionar todas visíveis (${rotasFiltradas.length})`}
                            </span>
                          </button>

                          {rotasSelecionadasLote.length > 0 && (
                            <span className="text-xs px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-full">
                              {rotasSelecionadasLote.length} rotas marcadas
                            </span>
                          )}
                        </div>

                        {/* Botão de Criação em Lote (se tiver rotas selecionadas) */}
                        {rotasSelecionadasLote.length > 0 && (
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <input
                              type="date"
                              value={dataLimiteLote}
                              onChange={(e) => setDataLimiteLote(e.target.value)}
                              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-500"
                              title="Data limite para o lote de ordens"
                            />
                            <button
                              type="button"
                              onClick={handleCriarOrdensEmLote}
                              disabled={gerandoLote}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                            >
                              {gerandoLote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                              <span>Gerar {rotasSelecionadasLote.length} OSs em Lote</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Progresso de geração em lote */}
                      {gerandoLote && progressoLote && (
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 animate-in fade-in">
                          <div className="flex justify-between text-xs font-bold text-emerald-900">
                            <span>Criando Ordens de Serviço Preventivas...</span>
                            <span>{progressoLote.atual} de {progressoLote.total}</span>
                          </div>
                          <div className="w-full h-2 bg-emerald-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
                              style={{ width: `${(progressoLote.atual / progressoLote.total) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Grid de Cards de Rotas */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
                        {rotasFiltradas.map((r) => {
                          const isSelectedLote = rotasSelecionadasLote.includes(r.rota);
                          const isVisualizada = rotaVisualizada?.rota === r.rota;

                          return (
                            <div
                              key={r.rota}
                              className={`p-3.5 rounded-xl border transition-all text-left flex flex-col justify-between gap-3 ${
                                isVisualizada 
                                  ? 'border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-500/20' 
                                  : isSelectedLote
                                  ? 'border-emerald-300 bg-emerald-50/20'
                                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs'
                              }`}
                            >
                              <div>
                                <div className="flex items-start justify-between gap-2">
                                  <label 
                                    className="flex items-center gap-2 cursor-pointer"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelectedLote}
                                      onChange={() => toggleSelecaoRotaLote(r.rota)}
                                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 accent-emerald-600"
                                    />
                                    <span className="font-extrabold text-sm text-slate-900 font-mono">
                                      {r.rota}
                                    </span>
                                  </label>
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-bold rounded-full">
                                    {r.totalPontos} pts
                                  </span>
                                </div>

                                <div className="mt-2 space-y-1 text-xs text-slate-500">
                                  {r.area && (
                                    <p className="font-semibold text-slate-700">
                                      📍 {r.area} {r.filial ? `• ${r.filial}` : ''}
                                    </p>
                                  )}
                                  {r.semana && (
                                    <p className="text-slate-600">
                                      🗓️ {r.semana}
                                    </p>
                                  )}
                                  {r.bairros.length > 0 && (
                                    <p className="truncate text-slate-500 text-[11px]">
                                      {r.bairros.slice(0, 3).join(', ')}
                                      {r.bairros.length > 3 ? ` +${r.bairros.length - 3}` : ''}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                                <span className="text-[11px] text-slate-400">
                                  {r.totalAbrigos} abrigos / {r.totalTotens} totens
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setRotaVisualizada(r)}
                                  className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
                                >
                                  Ver Detalhes →
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {rotasFiltradas.length === 0 && (
                          <div className="col-span-full py-8 text-center text-slate-500 text-xs bg-slate-50 rounded-xl">
                            Nenhuma rota encontrada para os filtros selecionados.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* PRÉVIA DOS PONTOS DA ROTA OU LISTA GERAL */}
                  {((ehBaseMultiRotas && rotaVisualizada) || (!ehBaseMultiRotas && pontosAvulsos.length > 0)) && (
                    <div className="space-y-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-200">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <span>
                              {rotaVisualizada ? `Rota ${rotaVisualizada.rota}` : 'Lista de Pontos Importados'}
                            </span>
                            <span className="text-xs font-normal text-slate-500">
                              ({rotaVisualizada ? rotaVisualizada.totalPontos : pontosAvulsos.length} pontos)
                            </span>
                          </h4>
                          {rotaVisualizada && (
                            <p className="text-xs text-slate-500">
                              {rotaVisualizada.area} • {rotaVisualizada.semana || 'Semana padrão'} • {rotaVisualizada.bairros.join(', ')}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPreviewExpanded(!previewExpanded)}
                            className="text-xs text-slate-600 font-semibold flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
                          >
                            <span>{previewExpanded ? 'Recolher tabela' : 'Expandir tabela'}</span>
                            {previewExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>

                          {onImportar && (
                            <button
                              type="button"
                              onClick={() => handleConfirmarRotaIndividual(rotaVisualizada || {
                                rota: 'IMPORTADA',
                                pontos: pontosAvulsos,
                                bairros: [],
                                totalPontos: pontosAvulsos.length,
                                totalTotens: pontosAvulsos.filter(p => p.tipo === 'totem').length,
                                totalAbrigos: pontosAvulsos.filter(p => p.tipo === 'abrigo').length,
                              })}
                              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Carregar nesta Ordem de Serviço</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {previewExpanded && (
                        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs max-h-60 overflow-y-auto">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                              <tr>
                                <th className="py-2 px-3">#</th>
                                <th className="py-2 px-3">Nº Eletro / Parada</th>
                                <th className="py-2 px-3">Endereço</th>
                                <th className="py-2 px-3">Bairro / Ref</th>
                                <th className="py-2 px-3">Modelo</th>
                                <th className="py-2 px-3">GPS</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                              {(rotaVisualizada ? rotaVisualizada.pontos : pontosAvulsos).slice(0, 100).map((p, i) => (
                                <tr key={i} className="hover:bg-slate-50/80">
                                  <td className="py-2 px-3 text-slate-400 font-mono">{p.ordem ?? i + 1}</td>
                                  <td className="py-2 px-3 font-semibold text-slate-900 font-mono">
                                    {p.numeroPonto}
                                  </td>
                                  <td className="py-2 px-3 max-w-[220px] truncate" title={p.endereco}>
                                    {p.endereco}
                                  </td>
                                  <td className="py-2 px-3 text-slate-500 max-w-[160px] truncate" title={p.referencia}>
                                    {p.referencia || '-'}
                                  </td>
                                  <td className="py-2 px-3">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                      p.tipo === 'totem' 
                                        ? 'bg-orange-100 text-[#FF5000]' 
                                        : 'bg-slate-100 text-slate-700'
                                    }`}>
                                      {p.tipo === 'totem' ? 'Totem' : 'Abrigo'}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 font-mono text-[11px] text-slate-400">
                                    {p.latitude && p.longitude ? '✓ GPS' : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {(rotaVisualizada ? rotaVisualizada.pontos.length : pontosAvulsos.length) > 100 && (
                            <p className="text-center text-xs text-slate-400 py-2 bg-slate-50">
                              ... e mais {(rotaVisualizada ? rotaVisualizada.pontos.length : pontosAvulsos.length) - 100} pontos na rota
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Checklist preventivo detectado / configurado */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                    <p className="text-xs font-bold text-slate-800">
                      Checklist preventivo padrão aplicado às OSs:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {atividadesDetectadas.map((a, i) => (
                        <span key={i} className="px-2.5 py-1 bg-white text-slate-700 text-xs font-medium rounded-lg border border-slate-200 shadow-2xs">
                          ✓ {a}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80">
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                Fechar
              </button>

              {onImportar && rotaVisualizada && (
                <button
                  type="button"
                  onClick={() => handleConfirmarRotaIndividual(rotaVisualizada)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  Preencher Formulário com {rotaVisualizada.totalPontos} Pontos da Rota {rotaVisualizada.rota}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
