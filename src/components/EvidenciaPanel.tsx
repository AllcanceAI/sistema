import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, Loader2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import * as htmlToImage from "html-to-image";
import { MediaSection } from "@/components/MediaSection";

export function EvidenciaPanel({ serviceOrderId }: { serviceOrderId: string }) {
  const [downloading, setDownloading] = useState(false);

  const order = useQuery({
    queryKey: ["order-evidencia", serviceOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select("*, vehicles(plate, brand, model, year, km), clients(name), companies(name)")
        .eq("id", serviceOrderId)
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const quotes = useQuery({
    queryKey: ["quotes-evidencia", serviceOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*, quote_items(*)")
        .eq("service_order_id", serviceOrderId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const media = useQuery({
    queryKey: ["media-evidencia", serviceOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media")
        .select("id, storage_path, description, stage")
        .eq("service_order_id", serviceOrderId);
      if (error) throw new Error(error.message);

      const rows = data ?? [];
      return rows.map((row) => {
        const { data: urlData } = supabase.storage
          .from("oficina-media")
          .getPublicUrl(row.storage_path);
        return { ...row, url: urlData.publicUrl };
      });
    },
  });

  const exportAsImage = async () => {
    const el = document.getElementById("evidencia-report-content");
    if (!el) return;
    setDownloading(true);
    try {
      // Use html-to-image to render the DOM node to an image (supports oklch CSS)
      const dataUrl = await htmlToImage.toPng(el, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });
      const link = document.createElement("a");
      link.download = `Evidencias_OS_${order.data?.number ?? ""}_HM_Auto_Eletrica.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Imagem de evidência baixada!");
    } catch (e: any) {
      toast.error("Erro ao gerar imagem: " + e.message);
    } finally {
      setDownloading(false);
    }
  };

  if (order.isLoading || media.isLoading) {
    return <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground my-8" />;
  }

  const os = order.data;
  const listMedia = media.data ?? [];
  const activeQuote = quotes.data?.[0];

  // Group media by stages to show before (entrada/defeito) and after (peca_nova/servico_concluido)
  const mediaBefore = listMedia.filter(m => ["entrada", "defeito", "checklist"].includes(m.stage));
  const mediaAfter = listMedia.filter(m => ["peca_nova", "servico_concluido"].includes(m.stage));

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <MediaSection serviceOrderId={serviceOrderId} stage="defeito" title="Adicionar fotos Antes (Defeito)" />
        <MediaSection serviceOrderId={serviceOrderId} stage="servico_concluido" title="Adicionar fotos Depois (Serviço)" />
      </div>

      <div className="flex justify-between items-center bg-secondary/10 p-3 rounded-lg border">
        <div>
          <h3 className="font-bold text-sm">Relatório de Evidências (Locadora / Seguradora)</h3>
          <p className="text-xs text-muted-foreground">Gere um comprovante visual com fotos de Antes/Depois e itens do orçamento.</p>
        </div>
        <Button onClick={exportAsImage} disabled={downloading} className="gap-2 shrink-0">
          {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Baixar PNG
        </Button>
      </div>

      {/* RENDER CONTAINER FOR IMAGE EXPORT */}
      <div className="border rounded-xl overflow-x-auto bg-slate-100 p-4">
        <div 
          id="evidencia-report-content" 
          className="w-[800px] min-h-[900px] bg-white text-slate-900 p-8 flex flex-col font-sans border shadow-md"
        >
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-center">
            <div>
              <h1 className="font-extrabold text-2xl tracking-wide uppercase">HM AUTO ELÉTRICA</h1>
              <p className="text-[11px] text-slate-500 font-bold">LAUDO E COMPROVANTE DE EVIDÊNCIAS DE SERVIÇO</p>
            </div>
            <div className="text-right">
              <span className="bg-slate-950 text-white font-mono font-bold text-lg px-3 py-1 rounded">
                OS #{os?.number}
              </span>
              <p className="text-[10px] text-slate-400 mt-1">Data: {new Date(os?.created_at ?? "").toLocaleDateString()}</p>
            </div>
          </div>

          {/* Vehicle Info */}
          <div className="grid grid-cols-4 gap-4 py-4 text-xs border-b">
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">PLACA</span>
              <strong className="text-sm font-bold uppercase">{os?.vehicles?.plate ?? "—"}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">VEÍCULO</span>
              <strong className="text-sm font-bold">{os?.vehicles?.brand} {os?.vehicles?.model} ({os?.vehicles?.year})</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">KM ENTRADA</span>
              <strong className="text-sm font-bold">{os?.vehicles?.km ? `${os.vehicles.km} km` : "—"}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">CLIENTE</span>
              <strong className="text-sm font-bold truncate block">{os?.companies?.name ?? os?.clients?.name ?? "—"}</strong>
            </div>
          </div>

          {/* Diagnosis & Report */}
          <div className="py-4 border-b grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold uppercase mb-1">RECLAMAÇÃO / DEFEITO</span>
              <p className="text-slate-800 leading-relaxed italic">"{os?.complaint || "Sem detalhes"}"</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold uppercase mb-1">LAUDO TÉCNICO</span>
              <p className="text-slate-800 leading-relaxed font-medium">{os?.diagnosis || "Diagnóstico pendente"}</p>
            </div>
          </div>

          {/* Photos Grid Before / After */}
          <div className="py-5 flex-1 space-y-6">
            <h3 className="text-xs font-bold uppercase text-slate-500 border-b pb-1">EVIDÊNCIAS FOTOGRÁFICAS (ANTES / DEPOIS)</h3>
            
            <div className="grid grid-cols-2 gap-6">
              {/* Column 1: Antes */}
              <div className="space-y-3">
                <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-wider block text-center">
                  Constatação do Defeito (Antes)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {mediaBefore.slice(0, 4).map(m => (
                    <div key={m.id} className="flex flex-col border rounded bg-slate-50 overflow-hidden">
                      <div className="relative aspect-square">
                        <img src={m.url} alt="Antes" className="w-full h-full object-cover" />
                      </div>
                      {m.description && (
                        <div className="p-2 text-xs text-slate-700 font-medium break-words leading-tight bg-white border-t">
                          {m.description}
                        </div>
                      )}
                    </div>
                  ))}
                  {mediaBefore.length === 0 && (
                    <p className="col-span-2 text-center text-xs py-8 text-slate-400 italic">Nenhuma foto registrada de constatação.</p>
                  )}
                </div>
              </div>

              {/* Column 2: Depois */}
              <div className="space-y-3">
                <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-wider block text-center">
                  Serviço Concluído / Peça Nova (Depois)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {mediaAfter.slice(0, 4).map(m => (
                    <div key={m.id} className="flex flex-col border rounded bg-slate-50 overflow-hidden">
                      <div className="relative aspect-square">
                        <img src={m.url} alt="Depois" className="w-full h-full object-cover" />
                      </div>
                      {m.description && (
                        <div className="p-2 text-xs text-slate-700 font-medium break-words leading-tight bg-white border-t">
                          {m.description}
                        </div>
                      )}
                    </div>
                  ))}
                  {mediaAfter.length === 0 && (
                    <p className="col-span-2 text-center text-xs py-8 text-slate-400 italic">Nenhuma foto de conclusão registrada.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Budget Total Summary */}
          {activeQuote && (
            <div className="bg-slate-50 p-3 rounded-lg border text-xs mt-auto">
              <span className="text-[9px] text-slate-400 block font-bold uppercase mb-1">RESUMO DO ORÇAMENTO VINCULADO</span>
              <div className="grid grid-cols-3 gap-2 font-mono">
                <div>Peças: <strong>R$ {Number(activeQuote.parts_total ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div>
                <div>Mão de Obra: <strong>R$ {Number(activeQuote.labor_total ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div>
                <div className="text-right text-slate-900 font-bold">Total: <strong>R$ {Number(activeQuote.total ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div>
              </div>
            </div>
          )}

          {/* Footer Branding */}
          <div className="border-t text-[9px] text-slate-400 pt-3 mt-4 flex justify-between font-mono">
            <span>HM AUTO ELÉTRICA — GESTÃO DIGITAL</span>
            <span>Evidência gerada para auditoria da Locadora</span>
          </div>
        </div>
      </div>
    </div>
  );
}
