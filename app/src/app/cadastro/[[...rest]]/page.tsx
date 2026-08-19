import { SignUp } from "@clerk/nextjs";
import Image from "next/image";
import { ShieldAlert } from "lucide-react";

export default function CadastroPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden font-sans">
      {/* Background glow */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-[#FF5000]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 flex flex-col items-center">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10 mb-3 shadow-xl">
            <Image 
              src="/eletromidia/logo-desktop.png" 
              alt="Eletromidia" 
              width={160} 
              height={34}
              className="h-8 w-auto object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Criar Conta de Gestão</h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Utilize seu e-mail corporativo <strong className="text-orange-400">@eletromidia.com.br</strong>
          </p>
        </div>

        {/* Clerk Sign Up Component */}
        <div className="w-full flex justify-center">
          <SignUp 
            routing="path" 
            path="/cadastro"
            signInUrl="/login"
            forceRedirectUrl="/admin"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-6 sm:p-8 w-full",
                headerTitle: "text-slate-900 font-extrabold text-xl",
                headerSubtitle: "text-slate-500 text-xs",
                socialButtonsBlockButton: "rounded-xl border-slate-200 text-slate-700 font-semibold hover:bg-slate-50",
                formButtonPrimary: "bg-[#FF5000] hover:bg-[#E04700] text-white font-bold rounded-xl shadow-lg shadow-orange-500/25 py-3 transition-all",
                formFieldInput: "rounded-xl border-slate-200 focus:ring-2 focus:ring-[#FF5000] focus:border-[#FF5000] text-sm py-2.5",
                formFieldLabel: "text-slate-700 font-bold text-xs uppercase tracking-wider",
                footerActionLink: "text-[#FF5000] font-bold hover:underline",
              }
            }}
          />
        </div>

        {/* Aviso de aprovação prévia */}
        <div className="mt-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2 max-w-sm">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Após o cadastro, seu acesso precisará ser aprovado pelo administrador para liberação do painel.</span>
        </div>
      </div>
    </div>
  );
}
