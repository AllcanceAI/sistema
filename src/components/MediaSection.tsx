import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, ImagePlus, Loader2, Trash2, Video, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { STAGE_LABELS } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type MediaRow = {
  id: string;
  storage_path: string;
  mime_type: string | null;
  description: string | null;
  stage: string;
  created_at: string;
  url: string;
};

export function MediaSection({
  serviceOrderId,
  stage,
  checklistId,
  title,
  excludeItemPhotos,
}: {
  serviceOrderId: string;
  stage: string;
  checklistId?: string | null;
  title?: string;
  excludeItemPhotos?: boolean;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Stable query key used in all mutations
  const QUERY_KEY = ["media", serviceOrderId, stage, checklistId ?? "global"];

  const media = useQuery({
    queryKey: QUERY_KEY,
    staleTime: 0, // Always refetch so photos are always fresh
    queryFn: async () => {
      let query = supabase
        .from("media")
        .select("id, storage_path, mime_type, description, stage, created_at")
        .eq("service_order_id", serviceOrderId)
        .eq("stage", stage as never)
        .order("created_at", { ascending: false });

      if (checklistId) {
        query = query.eq("checklist_id", checklistId);
      } else {
        query = query.is("checklist_id", null);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      let rows = (data ?? []) as Omit<MediaRow, "url">[];
      if (excludeItemPhotos) {
        rows = rows.filter((r) => !r.description?.startsWith("📷 "));
      }

      return rows.map((row) => {
        const { data: urlData } = supabase.storage
          .from("oficina-media")
          .getPublicUrl(row.storage_path);
        return { ...row, url: urlData.publicUrl };
      });
    },
  });

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      if (!files.length) return [];
      const uploaded: MediaRow[] = [];
      const { data: userData } = await supabase.auth.getUser();

      for (const file of files) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${serviceOrderId}/${stage}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
        const mimeType = file.type || (ext === "mp4" ? "video/mp4" : "image/jpeg");

        const { error: upErr } = await supabase.storage
          .from("oficina-media")
          .upload(path, file, { contentType: mimeType });
        if (upErr) throw new Error(upErr.message);

        const { data: inserted, error: dbErr } = await supabase
          .from("media")
          .insert({
            service_order_id: serviceOrderId,
            checklist_id: checklistId ?? null,
            stage: stage as never,
            storage_path: path,
            mime_type: mimeType,
            description: description.trim() || null,
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
          storage_path: path,
          mime_type: mimeType,
          description: description.trim() || null,
          stage,
          created_at: new Date().toISOString(),
          url: urlData.publicUrl,
        });
      }
      return uploaded;
    },
    onSuccess: (uploaded) => {
      if (!uploaded.length) return;
      setDescription("");
      toast.success(
        `${uploaded.length} foto${uploaded.length > 1 ? "s" : ""} adicionada${uploaded.length > 1 ? "s" : ""}!`,
      );
      // Optimistic: push new items to the top of the cache immediately
      queryClient.setQueryData<MediaRow[]>(QUERY_KEY, (old) => [
        ...uploaded,
        ...(old ?? []),
      ]);
      // Force a real refetch to ensure it's in sync with Supabase
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      // Refresh evidences panel too
      queryClient.invalidateQueries({ queryKey: ["media-evidencia", serviceOrderId] });
    },
    onError: (e: Error) => toast.error("Erro ao enviar: " + e.message),
  });

  const remove = useMutation({
    mutationFn: async (row: MediaRow) => {
      await supabase.storage.from("oficina-media").remove([row.storage_path]);
      const { error } = await supabase.from("media").delete().eq("id", row.id);
      if (error) throw new Error(error.message);
      return row.id;
    },
    onSuccess: (removedId) => {
      toast.success("Foto removida.");
      // Optimistic: remove from cache immediately
      queryClient.setQueryData<MediaRow[]>(QUERY_KEY, (old) =>
        (old ?? []).filter((r) => r.id !== removedId),
      );
      queryClient.invalidateQueries({ queryKey: ["media-evidencia", serviceOrderId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    event.target.value = "";
    upload.mutate(files);
  }

  const items = media.data ?? [];

  return (
    <div className="panel p-4">
      <h3 className="font-display text-base font-semibold">{title ?? STAGE_LABELS[stage] ?? "Fotos e Mídias"}</h3>

      <Input
        className="mt-2 text-xs"
        placeholder="Observação / Descrição da foto (opcional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={300}
      />

      <div className="mt-2 flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={upload.isPending}
          className="gap-1.5 text-xs"
        >
          {upload.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Camera className="size-3.5" />
          )}
          Adicionar Fotos
        </Button>
      </div>

      {/* Hidden input supporting camera, gallery and video in a single prompt */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,image/heic,image/heif"
        multiple
        className="hidden"
        onChange={onPick}
      />

      {/* Loading indicator */}
      {upload.isPending && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-2 text-xs text-muted-foreground animate-pulse">
          <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
          Enviando foto... aguarde
        </div>
      )}

      {/* Compact Photo / video grid */}
      {items.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2.5">
          {items.map((row) => (
            <figure
              key={row.id}
              className="group relative flex w-24 shrink-0 flex-col overflow-hidden rounded-lg border bg-secondary shadow-sm"
            >
              <div className="relative h-24 w-24 shrink-0">
                {row.mime_type?.startsWith("video") ? (
                  <video
                    src={row.url}
                    controls
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <img
                    src={row.url}
                    alt={row.description ?? "Foto do veículo"}
                    loading="lazy"
                    className="h-full w-full cursor-zoom-in object-cover transition-transform group-hover:scale-105"
                    onClick={() => setLightbox(row.url)}
                  />
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="absolute right-1 top-1 size-6 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => remove.mutate(row)}
                  aria-label="Remover mídia"
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
              {row.description ? (
                <figcaption
                  className="p-1.5 text-xs text-slate-700 font-medium break-words leading-tight bg-white border-t"
                >
                  {row.description}
                </figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      ) : (
        !upload.isPending && (
          <p className="mt-2 text-xs italic text-muted-foreground">
            Nenhuma foto nesta seção ainda. Clique em "Adicionar Fotos" para anexar.
          </p>
        )
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="Visualização ampliada"
            className="max-h-[90vh] max-w-full rounded object-contain"
          />
          <button
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/25"
            onClick={() => setLightbox(null)}
          >
            <X className="size-5" />
          </button>
        </div>
      )}
    </div>
  );
}
