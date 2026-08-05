import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Receipt, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/notas-fiscais")({
  head: () => ({
    meta: [
      { title: "Notas Fiscais — Oficina" },
      { name: "description", content: "Emissão e gestão de notas fiscais." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NotasFiscais,
});

function NotasFiscais() {
  return (
    <AppShell title="Notas Fiscais" subtitle="Emissão e gestão de notas fiscais">
      <div className="panel p-12 text-center flex flex-col items-center justify-center gap-4 max-w-2xl mx-auto mt-12">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
          <Receipt className="size-8 text-primary" />
        </div>
        <h2 className="text-2xl font-display font-semibold text-slate-100">Área em construção</h2>
        <p className="text-muted-foreground text-sm max-w-md">
          A integração e configuração de Notas Fiscais estará disponível em breve. Aqui você poderá emitir e gerenciar todas as NFs da oficina.
        </p>
        <Button variant="outline" className="mt-4 gap-2" disabled>
          <Wrench className="size-4" /> Configurar Integração
        </Button>
      </div>
    </AppShell>
  );
}
