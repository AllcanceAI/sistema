import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, ImagePlus, Loader2, Trash2, Video } from "lucide-react";
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
};

export function MediaSection({
  serviceOrderId,
  stage,
  checklistId,
  title,
}: {
  serviceOrderId: string;
  stage: string;
  checklistId?: string | null;
  title?: string;
}) {
  const queryClient = useQueryClient();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState("");

  const media = useQuery({
    queryKey: ["media", serviceOrderId, stage],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media")
        .select("id, storage_path, mime_type, description, stage, created_at")
        .eq("service_order_id", serviceOrderId)
        .eq("stage", stage as never)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);

      const rows = (data ?? []) as MediaRow[];
      const signed = await Promise.all(
        rows.map(async (row) => {
          const { data: url } = await supabase.storage
            .from("oficina-media")
            .createSignedUrl(row.storage_path, 3600);
          return { ...row, url: url?.signedUrl ?? "" };
        }),
      );
      return signed;
    },
  });

  const upload = useMutation({
    mutationFn: async (files: FileList) => {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${serviceOrderId}/${stage}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("oficina-media")
          .upload(path, file, { contentType: file.type });
        if (upErr) throw new Error(upErr.message);

        const { data: userData } = await supabase.auth.getUser();
        const { error } = await supabase.from("media").insert({
          service_order_id: serviceOrderId,
          checklist_id: checklistId ?? null,
          stage: stage as never,
          storage_path: path,
          mime_type: file.type,
          description: description.trim() || null,
          created_by: userData.user?.id ?? null,
        });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      setDescription("");
      toast.success("Mídia enviada.");
      queryClient.invalidateQueries({ queryKey: ["media", serviceOrderId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (row: MediaRow) => {
      await supabase.storage.from("oficina-media").remove([row.storage_path]);
      const { error } = await supabase.from("media").delete().eq("id", row.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["media", serviceOrderId] }),
    onError: (error: Error) => toast.error(error.message),
  });

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.length) upload.mutate(event.target.files);
    event.target.value = "";
  }

  return (
    <div className="panel p-4">
      <h3 className="font-display text-lg">{title ?? STAGE_LABELS[stage] ?? "Mídias"}</h3>

      <Input
        className="mt-3"
        placeholder="Descrição (peça, defeito, observação)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={300}
      />

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => cameraRef.current?.click()}
          disabled={upload.isPending}
        >
          {upload.isPending ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
          Câmera
        </Button>
        <Button type="button" variant="secondary" onClick={() => galleryRef.current?.click()}>
          <ImagePlus className="size-4" /> Fotos
        </Button>
        <Button type="button" variant="secondary" onClick={() => videoRef.current?.click()}>
          <Video className="size-4" /> Vídeo
        </Button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPick}
      />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={onPick} />
      <input ref={videoRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={onPick} />

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {(media.data ?? []).map((row) => (
          <figure key={row.id} className="relative overflow-hidden rounded-lg border bg-secondary">
            {row.mime_type?.startsWith("video") ? (
              <video src={row.url} controls className="aspect-square w-full object-cover" />
            ) : (
              <img
                src={row.url}
                alt={row.description ?? "Registro do veículo"}
                loading="lazy"
                className="aspect-square w-full object-cover"
              />
            )}
            {row.description ? (
              <figcaption className="px-2 py-1 text-[11px] text-muted-foreground">
                {row.description}
              </figcaption>
            ) : null}
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="absolute right-1 top-1 size-7"
              onClick={() => remove.mutate(row)}
              aria-label="Remover mídia"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </figure>
        ))}
      </div>
      {(media.data ?? []).length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">Nenhum registro nesta etapa ainda.</p>
      ) : null}
    </div>
  );
}
