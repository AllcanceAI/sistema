import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ListChecks, Camera, Trash2, ImagePlus, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  CHECKLIST_ENTRADA,
  CHECKLIST_DIAGNOSTICO,
  CHECK_STATE_LABELS,
} from "@/lib/checklist-templates";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MediaSection } from "@/components/MediaSection";

const STATES = ["ok", "atencao", "critico", "na"] as const;

type ItemMedia = {
  id: string;
  url: string;
  path: string;
  itemId: string;
};

export function ChecklistSection({
  serviceOrderId,
  kind,
  canEdit,
  onComplete,
}: {
  serviceOrderId: string;
  kind: "entrada" | "diagnostico";
  canEdit: boolean;
  onComplete?: () => void;
}) {
  const queryClient = useQueryClient();
  const CHECKLIST_KEY = ["checklist", serviceOrderId, kind];
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);

  // ── Fetch checklist + items ────────────────────────────────────────────────
  const checklist = useQuery({
    queryKey: CHECKLIST_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklists")
        .select("id, notes, checklist_items(id, label, state, note, position)")
        .eq("service_order_id", serviceOrderId)
        .eq("kind", kind)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  // ── Fetch per-item photos (all media linked to this checklist) ─────────────
  const PHOTOS_KEY = ["checklist-item-photos", serviceOrderId, kind];
  const itemPhotos = useQuery({
    queryKey: PHOTOS_KEY,
    enabled: !!checklist.data?.id,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media")
        .select("id, storage_path, description, checklist_id, mime_type")
        .eq("service_order_id", serviceOrderId)
        .eq("checklist_id", checklist.data!.id);
      if (error) throw new Error(error.message);

      const rows = data ?? [];
      return rows.map((row) => {
        const { data: urlData } = supabase.storage
          .from("oficina-media")
          .getPublicUrl(row.storage_path);
        const parts = row.storage_path.split("/");
        const itemId = parts[2] ?? "";
        return {
          id: row.id,
          url: urlData.publicUrl,
          path: row.storage_path,
          itemId,
        } as ItemMedia;
      });
    },
  });

  // ── Create checklist ───────────────────────────────────────────────────────
  const create = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("checklists")
        .insert({
          service_order_id: serviceOrderId,
          kind,
          created_by: userData.user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      const template =
        kind === "entrada" ? CHECKLIST_ENTRADA : CHECKLIST_DIAGNOSTICO;
      const { error: itemsError } = await supabase
        .from("checklist_items")
        .insert(
          template.map((item, index) => ({
            checklist_id: data.id,
            label: item.label,
            position: index,
          })),
        );
      if (itemsError) throw new Error(itemsError.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHECKLIST_KEY }),
    onError: (error: Error) => toast.error(error.message),
  });

  // ── Update individual item (state / note) ─────────────────────────────────
  const updateItem = useMutation({
    mutationFn: async (input: { id: string; state?: string; note?: string }) => {
      const patch: Record<string, unknown> = {};
      if (input.state !== undefined) patch.state = input.state;
      if (input.note !== undefined) patch.note = input.note;
      const { error } = await supabase
        .from("checklist_items")
        .update(patch as never)
        .eq("id", input.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: CHECKLIST_KEY }),
    onError: (error: Error) => toast.error(error.message),
  });

  // ── Update notes ──────────────────────────────────────────────────────────
  const updateNotes = useMutation({
    mutationFn: async (notes: string) => {
      const { error } = await supabase
        .from("checklists")
        .update({ notes })
        .eq("id", checklist.data!.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => toast.success("Observações salvas."),
    onError: (error: Error) => toast.error(error.message),
  });

  // ── Upload photo for a specific checklist item ────────────────────────────
  async function handleItemPhotoUpload(itemId: string, filesInput: FileList | File[]) {
    const files = Array.from(filesInput);
    if (!files.length || !checklist.data?.id) return;
    setUploadingItemId(itemId);
    const itemLabel = items.find((i) => i.id === itemId)?.label ?? "Item";
    const uploaded: ItemMedia[] = [];

    try {
      const { data: userData } = await supabase.auth.getUser();
      for (const file of files) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${serviceOrderId}/checklist/${itemId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
        const mimeType = file.type || "image/jpeg";

        const { error: upErr } = await supabase.storage
          .from("oficina-media")
          .upload(path, file, { contentType: mimeType });
        if (upErr) throw new Error(upErr.message);

        const { data: inserted, error: dbErr } = await supabase
          .from("media")
          .insert({
            service_order_id: serviceOrderId,
            checklist_id: checklist.data.id,
            stage: (kind === "entrada" ? "entrada" : "checklist") as never,
            storage_path: path,
            mime_type: mimeType,
            description: `📷 ${itemLabel}`,
            created_by: userData.user?.id ?? null,
          })
          .select("id")
          .single();
        if (dbErr) throw new Error(dbErr.message);

        const { data: urlData } = supabase.storage
          .from("oficina-media")
          .getPublicUrl(path);

        uploaded.push({
          id: inserted.id,
          url: urlData.publicUrl,
          path,
          itemId,
        });
      }

      // Optimistic: add to per-item photos cache immediately
      queryClient.setQueryData<ItemMedia[]>(PHOTOS_KEY, (old) => [
        ...(old ?? []),
        ...uploaded,
      ]);
      queryClient.invalidateQueries({ queryKey: PHOTOS_KEY });

      toast.success(
        `${uploaded.length} foto${uploaded.length > 1 ? "s" : ""} adicionada${uploaded.length > 1 ? "s" : ""}!`,
      );
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploadingItemId(null);
    }
  }

  // ── Delete per-item photo ─────────────────────────────────────────────────
  const deleteItemPhoto = useMutation({
    mutationFn: async (photo: ItemMedia) => {
      await supabase.storage
        .from("oficina-media")
        .remove([photo.path]);
      const { error } = await supabase
        .from("media")
        .delete()
        .eq("id", photo.id);
      if (error) throw new Error(error.message);
      return photo.id;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData<ItemMedia[]>(PHOTOS_KEY, (old) =>
        (old ?? []).filter((p) => p.id !== deletedId),
      );
      toast.success("Foto removida.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Guards ────────────────────────────────────────────────────────────────
  if (checklist.isLoading) {
    return (
      <Loader2 className="mx-auto my-6 size-5 animate-spin text-muted-foreground" />
    );
  }

  if (!checklist.data) {
    return (
      <div className="panel p-6 text-center">
        <ListChecks className="mx-auto mb-2 size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {kind === "entrada"
            ? "Checklist de entrada do veículo ainda não iniciado."
            : "Checklist de diagnóstico ainda não iniciado."}
        </p>
        {canEdit ? (
          <Button
            className="mt-3"
            onClick={() => create.mutate()}
            disabled={create.isPending}
          >
            {create.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Iniciar checklist
          </Button>
        ) : null}
      </div>
    );
  }

  const items = [...(checklist.data.checklist_items ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  const photosData = itemPhotos.data ?? [];

  return (
    <div className="space-y-3">
      {/* ── Per-item checklist ──────────────────────────────────────────────── */}
      <div className="panel divide-y">
        {items.map((item) => {
          const photos = photosData.filter((p) => p.itemId === item.id);
          const isUploading = uploadingItemId === item.id;

          return (
            <div key={item.id} className="p-3">
              {/* Item label */}
              <p className="text-sm font-medium">{item.label}</p>

              {/* State buttons */}
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {STATES.map((state) => (
                  <Button
                    key={state}
                    type="button"
                    size="sm"
                    variant={item.state === state ? "default" : "secondary"}
                    disabled={!canEdit}
                    onClick={() => updateItem.mutate({ id: item.id, state })}
                  >
                    {CHECK_STATE_LABELS[state]}
                  </Button>
                ))}
              </div>

              {/* Photo upload button — always visible, canEdit controls whether it shows */}
              {canEdit && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 gap-1.5 text-xs"
                  disabled={isUploading}
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.multiple = true;
                    input.onchange = (e) => {
                      const files = (e.target as HTMLInputElement).files;
                      if (files) handleItemPhotoUpload(item.id, files);
                    };
                    input.click();
                  }}
                >
                  {isUploading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Camera className="size-3.5" />
                  )}
                  {isUploading ? "Enviando..." : "Adicionar fotos"}
                </Button>
              )}

              {/* Photos grid — always visible for viewing */}
              {photos.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {photos.map((p) => (
                    <div
                      key={p.id}
                      className="group relative h-16 w-16 overflow-hidden rounded-md border"
                    >
                      <img
                        src={p.url}
                        alt="Foto do item"
                        className="h-full w-full cursor-zoom-in object-cover"
                        onClick={() => window.open(p.url, "_blank")}
                      />
                      {canEdit && (
                        <button
                          type="button"
                          className="absolute right-0.5 top-0.5 rounded bg-red-600 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() => deleteItemPhoto.mutate(p)}
                          title="Excluir foto"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Note */}
              {canEdit ? (
                <Textarea
                  className="mt-2 min-h-9"
                  rows={1}
                  placeholder="Observação do item"
                  defaultValue={item.note ?? ""}
                  onBlur={(e) =>
                    e.target.value !== (item.note ?? "") &&
                    updateItem.mutate({ id: item.id, note: e.target.value })
                  }
                />
              ) : item.note ? (
                <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* ── General notes ──────────────────────────────────────────────────── */}
      <div className="panel p-4">
        <h3 className="font-display text-lg">
          {kind === "entrada" ? "Observações da entrada" : "Análise do problema"}
        </h3>
        <Textarea
          className="mt-2"
          rows={4}
          defaultValue={checklist.data.notes ?? ""}
          disabled={!canEdit}
          placeholder={
            kind === "entrada"
              ? "Estado geral do veículo, avarias, itens deixados pelo cliente…"
              : "Descrição técnica do problema encontrado e solução proposta…"
          }
          onBlur={(e) => canEdit && updateNotes.mutate(e.target.value)}
        />
      </div>

      {/* ── General photo section (always visible, always uploadable) ────────── */}
      <MediaSection
        serviceOrderId={serviceOrderId}
        checklistId={checklist.data.id}
        stage={kind === "entrada" ? "entrada" : "checklist"}
        title={
          kind === "entrada"
            ? "📷 Fotos gerais do veículo na entrada"
            : "📷 Fotos do diagnóstico / defeito"
        }
        excludeItemPhotos
      />

      {/* ── Advance status button ──────────────────────────────────────────── */}
      {canEdit && onComplete && (
        <div className="mt-8 flex justify-end">
          <Button
            size="lg"
            className="w-full sm:w-auto font-bold bg-green-600 hover:bg-green-700 text-white gap-2"
            onClick={() => {
              if (confirm("Deseja confirmar a conclusão desta etapa e avançar a Ordem de Serviço?")) {
                onComplete();
              }
            }}
          >
            <CheckCircle2 className="size-5" />
            {kind === "entrada" ? "Próximo" : "Concluir Diagnóstico e Finalizar"}
          </Button>
        </div>
      )}
    </div>
  );
}
