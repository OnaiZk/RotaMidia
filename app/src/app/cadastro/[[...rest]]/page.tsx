"use client";

import { useSignUp, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Mail, Eye, EyeOff, ShieldAlert, ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function CadastroPage() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const { userId } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Redireciona automaticamente se já estiver logado
  useEffect(() => {
    if (userId) {
      router.push("/admin");
    }
  }, [userId, router]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setIsLoading(true);
    setError("");

    try {
      await signUp.create({
        emailAddress: email,
        password,
      });

      // Send the email with the verification code
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage || err.errors?.[0]?.message || "Ocorreu um erro ao criar conta.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setIsLoading(true);
    setError("");

    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (completeSignUp.status === "complete") {
        await setActive({ session: completeSignUp.createdSessionId });
        router.push("/admin");
      } else {
        console.log(JSON.stringify(completeSignUp, null, 2));
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage || err.errors?.[0]?.message || "Código de verificação inválido.");
    } finally {
      setIsLoading(false);
    }
  };

  const signUpWithProvider = (strategy: "oauth_google") => {
    if (!isLoaded) return;
    signUp.authenticateWithRedirect({
      strategy,
      redirectUrl: "/sso-callback",
      redirectUrlComplete: "/admin",
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-8 font-sans">
      <div className="w-full max-w-[1000px] bg-white rounded-[40px] flex flex-col md:flex-row overflow-hidden shadow-2xl min-h-[600px] border border-gray-100">
        
        {/* Left Form Section */}
        <div className="w-full md:w-1/2 p-8 sm:p-12 lg:p-16 flex flex-col justify-center relative">
          
          {!pendingVerification && (
            <Link href="/login" className="absolute top-8 left-8 sm:top-12 sm:left-12 text-gray-400 hover:text-[#FF5000] transition-colors flex items-center gap-2 text-sm font-medium">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </Link>
          )}

          <div className="max-w-sm w-full mx-auto mt-8 sm:mt-0">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">
                {pendingVerification ? "Verifique seu e-mail" : "Criar Conta"}
              </h1>
              <p className="text-gray-500 text-sm">
                {pendingVerification 
                  ? "Enviamos um código para o seu e-mail corporativo." 
                  : "Utilize seu e-mail corporativo @eletromidia.com.br"}
              </p>
            </div>

            {!pendingVerification ? (
              <form onSubmit={handleSignUp} className="space-y-4">
                {error && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl border border-red-100 text-center">
                    {error}
                  </div>
                )}

                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="E-mail corporativo"
                    required
                    className="w-full pl-4 pr-10 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FF5000] focus:border-transparent transition-all text-sm"
                  />
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Senha"
                    required
                    className="w-full pl-4 pr-10 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FF5000] focus:border-transparent transition-all text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isLoading || !isLoaded}
                    className="w-full bg-[#FF5000] hover:bg-[#E04700] text-white rounded-2xl py-3.5 font-bold transition-colors shadow-lg shadow-orange-500/25 disabled:opacity-70 flex items-center justify-center"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      "Criar Conta"
                    )}
                  </button>
                </div>

                <div className="mt-8">
                  <div className="relative flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-100"></div>
                    </div>
                    <span className="relative bg-white px-4 text-xs text-gray-400 uppercase tracking-wider font-semibold">ou</span>
                  </div>

                  <div className="flex items-center justify-center mt-6">
                    <button 
                      type="button"
                      onClick={() => signUpWithProvider("oauth_google")}
                      className="w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 hover:border-gray-300 transition-all"
                      title="Cadastrar com Google"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerify} className="space-y-4">
                {error && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl border border-red-100 text-center">
                    {error}
                  </div>
                )}
                
                <div className="relative">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Código de verificação"
                    required
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FF5000] focus:border-transparent transition-all text-sm text-center tracking-widest text-lg font-mono"
                  />
                </div>
                
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isLoading || !isLoaded}
                    className="w-full bg-[#FF5000] hover:bg-[#E04700] text-white rounded-2xl py-3.5 font-bold transition-colors shadow-lg shadow-orange-500/25 disabled:opacity-70 flex items-center justify-center"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      "Verificar e Concluir"
                    )}
                  </button>
                </div>
                
                <div className="mt-4 text-center">
                  <button 
                    type="button"
                    onClick={() => setPendingVerification(false)}
                    className="text-xs text-gray-500 hover:text-[#FF5000] transition-colors"
                  >
                    Voltar e alterar e-mail
                  </button>
                </div>
              </form>
            )}
            
            <div className="mt-8 pt-6 border-t border-gray-100">
              <div className="text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Após o cadastro, seu acesso precisará ser aprovado pelo administrador.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Image/Graphic Section */}
        <div className="hidden md:block md:w-1/2 p-4">
          <div className="w-full h-full rounded-[32px] overflow-hidden relative flex items-center justify-center bg-[#FF5000]">
            <Image 
              src="/eletromidia/logo-mobile.png" 
              alt="Eletromidia" 
              width={200}
              height={200}
              className="w-auto h-40 object-contain filter brightness-0 invert"
              priority
            />
          </div>
        </div>

      </div>
    </div>
  );
}
