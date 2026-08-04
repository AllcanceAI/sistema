import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ListChecks, Camera, X, Image, Trash2 } from "lucide-react";
import { useRef, useState, useEffect } from "react";
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
  mediaId: string;
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

  // Fetch photos linked to this checklist
  const photosQuery = useQuery({
    queryKey: ["checklist-photos", serviceOrderId, kind, checklist.data?.id],
    enabled: !!checklist.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media")
        .select("id, storage_path, description, checklist_id")
        .eq("service_order_id", serviceOrderId)
        .eq("checklist_id", checklist.data!.id);
      if (error) throw new Error(error.message);

      const items = await Promise.all(
        (data ?? []).map(async (row) => {
          const { data: urlData } = await supabase.storage
            .from("oficina-media")
            .createSignedUrl(row.storage_path, 3600);
          
          // Extrapolate item ID from storage path (was stored as: {serviceOrderId}/checklist/{itemId}/{timestamp}.ext)
          const parts = row.storage_path.split("/");
          const itemId = parts[2] || ""; // third index contains the itemId

          return {
            itemId,
            url: urlData?.signedUrl ?? "",
            path: row.storage_path,
            mediaId: row.id,
          };
        })
      );
      return items;
    },
  });

  useEffect(() => {
    if (photosQuery.data) {
      setItemPhotos(photosQuery.data);
    }
  }, [photosQuery.data]);

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

      const { data: urlData } = await supabase.storage
        .from("oficina-media")
        .createSignedUrl(path, 3600);

      // Save reference in media table
      const { data: mediaData, error: dbError } = await supabase
        .from("media")
        .insert({
          service_order_id: serviceOrderId,
          checklist_id: checklist.data?.id ?? null,
          stage: kind === "entrada" ? "entrada" : "checklist",
          storage_path: path,
          mime_type: file.type,
          description: `Foto do item: ${items.find(i => i.id === itemId)?.label ?? itemId}`,
          created_by: userData.user?.id ?? null,
        })
        .select("id")
        .single();
      
      if (dbError) throw new Error(dbError.message);

      setItemPhotos((prev) => [
        ...prev, 
        { itemId, url: urlData?.signedUrl ?? "", path, mediaId: mediaData.id }
      ]);

      toast.success("Foto adicionada!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploadingItemId(null);
    }
  }

  const deletePhoto = useMutation({
    mutationFn: async (photo: ItemPhoto) => {
      await supabase.storage.from("oficina-media").remove([photo.path]);
      const { error } = await supabase.from("media").delete().eq("id", photo.mediaId);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, photo) => {
      setItemPhotos((prev) => prev.filter((p) => p.path !== photo.path));
      toast.success("Foto removida!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
              <div className="mt-2">
                {canEdit && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    disabled={uploadingItemId === item.id}
                    onClick={() => {
                      setActiveItemId(item.id);
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*";
                      input.multiple = true;
                      input.onchange = (e) => {
                        const files = (e.target as HTMLInputElement).files;
                        if (files) {
                          Array.from(files).forEach((file) => handlePhotoUpload(item.id, file));
                        }
                      };
                      input.click();
                    }}
                  >
                    {uploadingItemId === item.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Camera className="size-3.5" />
                    )}
                    {uploadingItemId === item.id ? "Enviando..." : "Adicionar Fotos"}
                  </Button>
                )}

                {/* Show uploaded photos for this item */}
                {photos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {photos.map((p) => (
                      <div key={p.path} className="relative group border rounded-md overflow-hidden">
                        <img
                          src={p.url}
                          alt="Foto do item"
                          className="size-16 object-cover cursor-pointer hover:opacity-90"
                          onClick={() => window.open(p.url, "_blank")}
                        />
                        {canEdit && (
                          <button
                            type="button"
                            className="absolute right-0.5 top-0.5 rounded bg-red-600 p-1 text-white hover:bg-red-700 opacity-90 transition-opacity"
                            onClick={() => deletePhoto.mutate(p)}
                            title="Excluir"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

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
