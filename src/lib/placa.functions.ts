import { createServerFn } from "@tanstack/react-start";

export type PlacaLookup = {
  ok: boolean;
  message?: string;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  color?: string | null;
};

export const lookupPlate = createServerFn({ method: "POST" })
  .inputValidator((input: { plate: string }) => ({
    plate: String(input.plate ?? "")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase(),
  }))
  .handler(async ({ data }): Promise<PlacaLookup> => {
    if (data.plate.length < 7) {
      return { ok: false, message: "Informe a placa completa." };
    }

    const token = process.env["PLACA_API_TOKEN"];
    if (!token) {
      return {
        ok: false,
        message: "Consulta de placa não configurada. Preencha os dados manualmente.",
      };
    }

    try {
      const response = await fetch(
        `https://wdapi2.com.br/consulta/${data.plate}/${token}`,
        { headers: { Accept: "application/json" } },
      );
      const body = (await response.json()) as Record<string, unknown> & {
        MARCA?: string;
        MODELO?: string;
        marca?: string;
        modelo?: string;
        ano?: string | number;
        anoModelo?: string | number;
        cor?: string;
        mensagem?: string;
      };

      if (!response.ok) {
        return {
          ok: false,
          message: (body?.mensagem as string) || "Placa não encontrada na base.",
        };
      }

      const full = String(body.MARCA ?? body.marca ?? "").trim();
      const [brandPart, ...rest] = full.split("/");
      const model = String(body.MODELO ?? body.modelo ?? rest.join("/")).trim();
      const rawYear = body.anoModelo ?? body.ano;
      const year = rawYear ? Number(String(rawYear).slice(0, 4)) : null;

      return {
        ok: true,
        brand: brandPart?.trim() || null,
        model: model || null,
        year: Number.isFinite(year) ? year : null,
        color: String(body.cor ?? "").trim() || null,
      };
    } catch {
      return { ok: false, message: "Não foi possível consultar a placa agora." };
    }
  });
