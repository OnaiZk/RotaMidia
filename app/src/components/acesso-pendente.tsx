'use client';

import { useClerk } from '@clerk/nextjs';
import Image from 'next/image';
import { Clock, ShieldAlert, LogOut, RefreshCw, XCircle, Mail } from 'lucide-react';
import { useState } from 'react';

interface AcessoPendenteProps {
  tipo: 'pendente' | 'dominio_invalido' | 'rejeitado';
  email?: string;
  nome?: string;
  onRefresh?: () => void;
}

export function AcessoPendente({ tipo, email, nome, onRefresh }: AcessoPendenteProps) {
  const { signOut } = useClerk();
  const [verificando, setVerificando] = useState(false);

  const handleRefresh = async () => {
    if (onRefresh) {
      setVerificando(true);
      await onRefresh();
      setTimeout(() => setVerificando(false), 1000);
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden font-sans">
      {/* Background glow */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-[#FF5000]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        {/* Header Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10 mb-4 shadow-xl">
            <Image 
              src="/eletromidia/logo-desktop.png" 
              alt="Eletromidia" 
              width={160} 
              height={34}
              className="h-8 w-auto object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Controle de Acesso Administrativo
          </h1>
        </div>

        {/* Card Principal */}
        <div className="bg-white/95 backdrop-blur-xl p-7 sm:p-9 rounded-3xl shadow-2xl border border-white/20 text-center space-y-6">
          {/* Ícone e Título por Tipo */}
          {tipo === 'pendente' && (
            <>
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                <Clock className="w-8 h-8 animate-pulse" />
              </div>
              <div>
                <span className="inline-block px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold rounded-full uppercase tracking-wider mb-2">
                  Aguardando Aprovação
                </span>
                <h2 className="text-xl font-extrabold text-slate-900">
                  Olá, {nome || 'Líder'}!
                </h2>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                  Sua conta com o e-mail corporativo <strong className="text-slate-900">{email}</strong> foi cadastrada com sucesso.
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  Para garantir a segurança das operações de campo, o <strong>administrador geral da Eletromidia</strong> precisa liberar seu acesso ao painel de gestão.
                </p>
              </div>
            </>
          )}

          {tipo === 'dominio_invalido' && (
            <>
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div>
                <span className="inline-block px-3 py-1 bg-red-50 text-red-800 border border-red-200 text-xs font-bold rounded-full uppercase tracking-wider mb-2">
                  Domínio Não Autorizado
                </span>
                <h2 className="text-xl font-extrabold text-slate-900">
                  E-mail Não Permitido
                </h2>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                  A conta <strong className="text-slate-900">{email}</strong> não possui o domínio oficial da Eletromidia.
                </p>
                <p className="text-xs text-red-600 font-semibold mt-2">
                  Apenas e-mails terminados em <strong>@eletromidia.com.br</strong> têm autorização de acesso ao painel de gestão.
                </p>
              </div>
            </>
          )}

          {tipo === 'rejeitado' && (
            <>
              <div className="w-16 h-16 bg-slate-100 text-slate-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <span className="inline-block px-3 py-1 bg-red-50 text-red-800 border border-red-200 text-xs font-bold rounded-full uppercase tracking-wider mb-2">
                  Acesso Não Autorizado
                </span>
                <h2 className="text-xl font-extrabold text-slate-900">
                  Acesso Revogado
                </h2>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                  O acesso para o e-mail <strong className="text-slate-900">{email}</strong> não foi aprovado pelo administrador.
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  Se você acredita que isso é um engano, entre em contato diretamente com o responsável pelas operações.
                </p>
              </div>
            </>
          )}

          {/* Botões de Ação */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3 justify-center">
            {tipo === 'pendente' && (
              <button
                onClick={handleRefresh}
                disabled={verificando}
                className="px-5 py-2.5 bg-[#FF5000] hover:bg-[#E04700] text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${verificando ? 'animate-spin' : ''}`} />
                <span>Verificar se Fui Aprovado</span>
              </button>
            )}

            <button
              onClick={() => signOut({ redirectUrl: '/login' })}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair da Conta</span>
            </button>
          </div>
        </div>

        {/* Rodapé */}
        <p className="text-center text-xs text-slate-500 mt-6">
          © {new Date().getFullYear()} Eletromidia S.A. • Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
