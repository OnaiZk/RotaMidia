"use client";

import { ReactNode, useMemo } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ClerkProvider } from "@clerk/nextjs";
import { ptBR } from "@clerk/localizations";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "https://placeholder.convex.cloud";

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  const convex = useMemo(() => new ConvexReactClient(convexUrl), []);

  return (
    <ClerkProvider
      localization={ptBR}
      appearance={{
        layout: {
          logoImageUrl: "/eletromidia/logo-desktop.png",
          socialButtonsPlacement: "bottom",
          showOptionalFields: false,
        },
        variables: {
          colorPrimary: "#FF5000",
          colorText: "#0F172A",
          colorInputBackground: "#F8FAFC",
          borderRadius: "0.75rem",
        },
      }}
    >
      <ConvexProvider client={convex}>
        {children}
      </ConvexProvider>
    </ClerkProvider>
  );
}
