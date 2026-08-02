import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ListChecks, Camera, X, Image } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CHECKLIST_ENTRADA, CHECKLIST_DIAGNOSTICO, CHECK_STATE_LABELS } from "@/lib/checklist-templates";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MediaSection } from "@/components/MediaSection";

const STATES = ["ok", "atencao", "critico", "na"] as const;

type ItemPhoto = {
  itemId: string;
  url: string;
  path: string;
};

export function ChecklistSection({
  serviceOrderId,
  kind,
  canEdit,
}: {
  serviceOrderId: string;
  kind: "entrada" | "diagnostico";
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const key = ["checklist", serviceOrderId, kind];
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [itemPhotos, setItemPhotos] = useState<ItemPhoto[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const checklist = useQuery({
    queryKey: key,
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

  const create = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("checklists")
        .insert({ service_order_id: serviceOrderId, kind, created_by: userData.user?.id ?? null })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      const template = kind === "entrada" ? CHECKLIST_ENTRADA : CHECKLIST_DIAGNOSTICO;
      const { error: itemsError } = await supabase.from("checklist_items").insert(
        template.map((item, index) => ({
          checklist_id: data.id,
          label: item.label,
          position: index,
        })),
      );
      if (itemsError) throw new Error(itemsError.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError: (error: Error) => toast.error(error.message),
  });

  const updateItem = useMutation({
    mutationFn: async (input: { id: string; state?: string; note?: string }) => {
      const patch: { state?: never; note?: string } = {};
      if (input.state) patch.state = input.state as never;
      if (input.note !== undefined) patch.note = input.note;
      const { error } = await supabase.from("checklist_items").update(patch).eq("id", input.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError: (error: Error) => toast.error(error.message),
  });

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

  async function handlePhotoUpload(itemId: string, file: File) {
    setUploadingItemId(itemId);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${serviceOrderId}/checklist/${itemId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("oficina-media")
        .upload(path, file, { upsert: false });
      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage.from("oficina-media").getPublicUrl(path);
      setItemPhotos((prev) => [...prev, { itemId, url: urlData.publicUrl, path }]);

      // Also save reference in media table
      await supabase.from("media").insert({
        service_order_id: serviceOrderId,
        checklist_id: checklist.data?.id ?? null,
        stage: kind === "entrada" ? "entrada" : "checklist",
        storage_path: path,
        mime_type: file.type,
        description: `Foto do item: ${items.find(i => i.id === itemId)?.label ?? itemId}`,
        created_by: userData.user?.id ?? null,
      });

      toast.success("Foto adicionada!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploadingItemId(null);
    }
  }

  function removeLocalPhoto(path: string) {
    setItemPhotos((prev) => prev.filter((p) => p.path !== path));
  }

  if (checklist.isLoading) {
    return <Loader2 className="mx-auto my-6 size-5 animate-spin text-muted-foreground" />;
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
          <Button className="mt-3" onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Iniciar checklist
          </Button>
        ) : null}
      </div>
    );
  }

  const items = [...(checklist.data.checklist_items ?? [])].sort(
    (a, b) => a.position - b.position,
  );

  return (
    <div className="space-y-3">
      <div className="panel divide-y">
        {items.map((item) => {
          const photos = itemPhotos.filter((p) => p.itemId === item.id);
          return (
            <div key={item.id} className="p-3">
              <p className="text-sm font-medium">{item.label}</p>
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

              {/* Photo upload per item */}
              {canEdit ? (
                <div className="mt-2">
                  <input
                    ref={activeItemId === item.id ? fileInputRef : undefined}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePhotoUpload(item.id, file);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    disabled={uploadingItemId === item.id}
                    onClick={() => {
                      setActiveItemId(item.id);
                      // Create a dedicated input for this item
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*";
                      input.capture = "environment";
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) handlePhotoUpload(item.id, file);
                      };
                      input.click();
                    }}
                  >
                    {uploadingItemId === item.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Camera className="size-3.5" />
                    )}
                    {uploadingItemId === item.id ? "Enviando..." : "Foto deste item"}
                  </Button>

                  {/* Show uploaded photos for this item */}
                  {photos.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {photos.map((p) => (
                        <div key={p.path} className="relative">
                          <img
                            src={p.url}
                            alt="Foto do item"
                            className="size-16 rounded-md object-cover border"
                          />
                          <button
                            type="button"
                            className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-white"
                            onClick={() => removeLocalPhoto(p.path)}
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : photos.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {photos.map((p) => (
                    <img key={p.path} src={p.url} alt="Foto" className="size-16 rounded-md object-cover border" />
                  ))}
                </div>
              ) : null}

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

      <MediaSection
        serviceOrderId={serviceOrderId}
        checklistId={checklist.data.id}
        stage={kind === "entrada" ? "entrada" : "checklist"}
        title={kind === "entrada" ? "Fotos do veículo na entrada" : "Fotos do diagnóstico"}
      />
    </div>
  );
}
