'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, ClipboardList, Users, BarChart3, Menu, X, Loader2, UserCheck } from 'lucide-react';
import { useUser, UserButton } from '@clerk/nextjs';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { AcessoPendente } from '@/components/acesso-pendente';
import { ModalGestaoAcessos } from '@/components/modal-gestao-acessos';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [gestaoAcessosOpen, setGestaoAcessosOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'loading' | 'aprovado' | 'pendente' | 'rejeitado' | 'dominio_invalido'>('loading');

  const sincronizarUsuario = useMutation(api.auth.sincronizarUsuario);
  const meuUsuario = useQuery(api.auth.getMeuUsuario, { clerkId: user?.id });
  const todosUsuarios = useQuery(api.auth.listarUsuariosAdmin, { clerkId: user?.id || '' }) || [];

  const [sliderStyle, setSliderStyle] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    opacity: 0,
  });

  const navItems = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Ordens de Serviço', href: '/admin/ordens', icon: ClipboardList },
    { name: 'Técnicos', href: '/admin/tecnicos', icon: Users },
    { name: 'Relatórios', href: '/admin/relatorios', icon: BarChart3 },
  ];

  // 1. Redirecionar para /login se não estiver logado
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace('/login');
    }
  }, [isLoaded, isSignedIn, router]);

  // 2. Sincronizar o usuário com o Convex ao carregar
  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      const email = user.primaryEmailAddress?.emailAddress || '';
      const emailLower = email.toLowerCase();
      
      const ehValido =
        emailLower.endsWith('@eletromidia.com.br') ||
        emailLower.endsWith('@eletromidia.com') ||
        emailLower === 'cassiano.silva@eletromidia.com.br';

      if (!ehValido) {
        setSyncStatus('dominio_invalido');
        return;
      }

      const nome = user.fullName || user.firstName || email.split('@')[0];
      const fotoUrl = user.imageUrl || undefined;

      sincronizarUsuario({
        clerkId: user.id,
        nome,
        email,
        fotoUrl,
      })
        .then((res) => {
          if (res) {
            setSyncStatus(res.motivo as any);
          }
        })
        .catch((err) => {
          console.error('Erro ao sincronizar com Convex:', err);
          // Se der timeout ou erro de rede, usa o status atual do meuUsuario ou assume aprovado se for superadmin
          if (meuUsuario?.status) {
            setSyncStatus(meuUsuario.status);
          }
        });
    }
  }, [isLoaded, isSignedIn, user, sincronizarUsuario]);

  // 3. Atualizar status caso o Convex envie atualização em tempo real
  useEffect(() => {
    if (meuUsuario?.status) {
      setSyncStatus(meuUsuario.status);
    }
  }, [meuUsuario]);

  // 4. Efeito visual do slider da navbar
  useEffect(() => {
    const updateSlider = () => {
      if (!navRef.current) return;
      const activeElement = navRef.current.querySelector('[data-active="true"]') as HTMLElement;
      if (activeElement) {
        setSliderStyle({
          left: activeElement.offsetLeft,
          top: activeElement.offsetTop,
          width: activeElement.offsetWidth,
          height: activeElement.offsetHeight,
          opacity: 1,
        });
      } else {
        setSliderStyle((prev) => ({ ...prev, opacity: 0 }));
      }
    };

    updateSlider();
    const timeoutId = setTimeout(updateSlider, 50);

    window.addEventListener('resize', updateSlider);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateSlider);
    };
  }, [pathname, menuOpen, syncStatus]);

  // Se o Clerk ainda não carregou
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center">
        <Loader2 className="w-9 h-9 text-[#FF5000] animate-spin mb-3" />
        <p className="text-slate-500 font-medium text-sm">Carregando autenticação...</p>
      </div>
    );
  }

  // Se não estiver logado, redireciona
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center">
        <Loader2 className="w-9 h-9 text-[#FF5000] animate-spin mb-3" />
        <p className="text-slate-500 font-medium text-sm">Redirecionando para o login...</p>
      </div>
    );
  }

  const emailAtual = user?.primaryEmailAddress?.emailAddress || '';
  const nomeAtual = user?.fullName || user?.firstName || emailAtual.split('@')[0];

  // Se o domínio não for corporativo da Eletromidia
  if (syncStatus === 'dominio_invalido') {
    return (
      <AcessoPendente 
        tipo="dominio_invalido" 
        email={emailAtual} 
        nome={nomeAtual} 
      />
    );
  }

  // Se o cadastro estiver pendente de aprovação
  if (syncStatus === 'pendente') {
    return (
      <AcessoPendente 
        tipo="pendente" 
        email={emailAtual} 
        nome={nomeAtual} 
        onRefresh={() => {
          if (user) {
            sincronizarUsuario({
              clerkId: user.id,
              nome: nomeAtual,
              email: emailAtual,
              fotoUrl: user.imageUrl,
            }).then((res) => {
              if (res) setSyncStatus(res.motivo as any);
            });
          }
        }}
      />
    );
  }

  // Se o cadastro foi rejeitado
  if (syncStatus === 'rejeitado') {
    return (
      <AcessoPendente 
        tipo="rejeitado" 
        email={emailAtual} 
        nome={nomeAtual} 
      />
    );
  }

  // Se ainda estiver sincronizando pela primeira vez
  if (syncStatus === 'loading') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center">
        <Loader2 className="w-9 h-9 text-[#FF5000] animate-spin mb-3" />
        <p className="text-slate-500 font-medium text-sm">Validando permissões de acesso...</p>
      </div>
    );
  }

  // Total de solicitações pendentes para exibir o badge aos aprovados
  const totalPendentes = todosUsuarios.filter((u: any) => u.status === 'pendente').length;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans relative">
      {/* Floating Navbar */}
      <header className="fixed top-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-7xl bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-lg rounded-2xl z-50 transition-all duration-300">
        <div className="px-5 py-3 md:py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
          <div className="flex items-center justify-between w-full md:w-auto">
            {/* Logo Brand */}
            <Link href="/admin" className="flex items-center">
              <Image 
                src="/eletromidia/logo-desktop.png" 
                alt="Eletromidia" 
                width={130} 
                height={28}
                className="h-6 w-auto object-contain"
                priority
              />
            </Link>

            {/* Mobile Menu Button */}
            <button 
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="w-5 h-5 text-slate-700" /> : <Menu className="w-5 h-5 text-slate-700" />}
            </button>
          </div>

          {/* Desktop Navigation / Collapsible Mobile Navigation */}
          <div className={`${menuOpen ? 'flex' : 'hidden'} md:flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 transition-all w-full md:w-auto flex-1 md:ml-6`}>
            {/* Navigation links */}
            <nav ref={navRef} className="relative flex flex-col md:flex-row gap-1 w-full md:w-auto">
              {/* Sliding Orange Background */}
              <div 
                className="absolute bg-orange-50 rounded-xl transition-all duration-300 ease-out pointer-events-none z-0"
                style={{
                  left: `${sliderStyle.left}px`,
                  top: `${sliderStyle.top}px`,
                  width: `${sliderStyle.width}px`,
                  height: `${sliderStyle.height}px`,
                  opacity: sliderStyle.opacity,
                }}
              />

              {navItems.map((item) => {
                const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/admin');
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    data-active={isActive}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors duration-200 relative z-10 ${
                      isActive
                        ? 'text-[#FF5000] font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50 md:hover:bg-transparent'
                    }`}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon className={`w-4 h-4 transition-colors duration-200 ${isActive ? 'text-[#FF5000]' : 'text-slate-400'}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Perfil & Gestão de Acessos */}
            <div className="flex items-center justify-between md:justify-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
              {/* Botão de Gestão de Acessos para líderes */}
              <button
                onClick={() => setGestaoAcessosOpen(true)}
                className="relative px-3 py-1.5 bg-slate-100 hover:bg-orange-50 hover:text-[#FF5000] text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Gerenciar e aprovar acessos de líderes"
              >
                <UserCheck className="w-3.5 h-3.5 text-[#FF5000]" />
                <span className="hidden sm:inline">Acessos</span>
                {totalPendentes > 0 && (
                  <span className="px-1.5 py-0.2 bg-[#FF5000] text-white text-[10px] rounded-full animate-bounce">
                    {totalPendentes}
                  </span>
                )}
              </button>

              {/* Botão de Usuário do Clerk com Avatar e Logout Integrado */}
              <div className="flex items-center gap-2">
                <div className="hidden xl:block text-right text-xs">
                  <p className="font-bold text-slate-800 leading-none">{nomeAtual}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{emailAtual}</p>
                </div>
                <UserButton 
                  afterSignOutUrl="/login"
                  appearance={{
                    elements: {
                      avatarBox: "w-8 h-8 rounded-xl border border-slate-200 shadow-xs",
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pt-28 pb-12 px-4 md:px-8 max-w-7xl mx-auto w-full">
        {children}
      </main>

      {/* Mobile menu backdrop */}
      {menuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/10 backdrop-blur-xs z-40 md:hidden" 
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Modal de Gestão e Aprovação de Acessos */}
      {user && (
        <ModalGestaoAcessos
          isOpen={gestaoAcessosOpen}
          onClose={() => setGestaoAcessosOpen(false)}
          adminClerkId={user.id}
        />
      )}
    </div>
  );
}
