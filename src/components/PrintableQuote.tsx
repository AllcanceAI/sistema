import { brl } from "@/routes/_authenticated/painel";
import hmLogo from "@/assets/hm-logo.png.asset.json";

export function PrintableQuote({ osData, quote }: { osData: any; quote: any }) {
  if (!quote) return null;

  const dateNow = new Date();
  const dataCriacao = new Date(quote.created_at).toLocaleString("pt-BR");
  const dataImpressao = dateNow.toLocaleString("pt-BR");

  const items = quote.quote_items || [];
  const parts = items.filter((i: any) => i.kind === "peca");
  const labor = items.filter((i: any) => i.kind === "servico");

  return (
    <div className="hidden print:block absolute top-0 left-0 right-0 bg-white z-[9999] text-black font-sans w-full min-h-screen p-8 text-sm box-border">
      <style>{`
        @media print {
          @page { 
            margin: 0;
            size: A4;
          }
          body { 
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      {/* HEADER */}
      <div className="flex justify-between items-start mb-6 border-b-2 border-gray-400 pb-4">
        <div className="text-xs text-gray-500 w-1/4">
          <p>Data criação: {dataCriacao}</p>
          <p>Data impressão: {dataImpressao}</p>
        </div>
        <div className="w-1/2 text-center">
          <h1 className="text-2xl font-bold uppercase tracking-wider mb-1">HM Auto Elétrica</h1>
          <p className="text-xs">CNPJ: 66.473.569/0001-82 - Cel.: +55 (15) 99682-5445</p>
        </div>
        <div className="w-1/4 flex justify-end">
          <img src={hmLogo.url} alt="HM Auto Elétrica" className="w-32 object-contain" />
        </div>
      </div>

      <div className="text-center font-semibold text-gray-600 mb-4 pb-2 border-b">
        Oficina HM - O melhor atendimento para o seu veículo!
      </div>

      {/* CLIENT DATA */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-6 text-xs">
        <div>
          <span className="font-semibold text-gray-500">Nome do cliente:</span> {osData?.clients?.name ?? osData?.companies?.name ?? "Não informado"}
        </div>
        <div>
          <span className="font-semibold text-gray-500">Documento:</span> {osData?.clients?.document ?? osData?.companies?.document ?? "Não informado"}
        </div>
        <div>
          <span className="font-semibold text-gray-500">Nº O.S.:</span> {osData?.id.split("-")[0].toUpperCase()}
        </div>
        <div>
          <span className="font-semibold text-gray-500">Prioridade:</span> NORMAL
        </div>
        <div>
          <span className="font-semibold text-gray-500">Veículo:</span> {osData?.vehicles?.brand} {osData?.vehicles?.model}
        </div>
        <div>
          <span className="font-semibold text-gray-500">Tel.:</span> {osData?.clients?.phone ?? osData?.companies?.phone ?? "Não informado"}
        </div>
        <div>
          <span className="font-semibold text-gray-500">Placa:</span> {osData?.vehicles?.plate} - <span className="font-semibold text-gray-500">Ano:</span> {osData?.vehicles?.year}
        </div>
        <div>
          <span className="font-semibold text-gray-500">Cor veículo:</span> {osData?.vehicles?.color ?? "Não informada"}
        </div>
      </div>

      {/* ITEMS LIST */}
      {parts.length > 0 && (
        <div className="mb-6">
          <div className="text-center text-gray-500 mb-1">Lista de peças</div>
          <table className="w-full text-xs text-left mb-2">
            <thead className="bg-gray-500 text-white">
              <tr>
                <th className="py-1 px-2 font-semibold">Nome da peça</th>
                <th className="py-1 px-2 font-semibold text-right w-16">Qtd</th>
                <th className="py-1 px-2 font-semibold text-right w-24">Preço</th>
                <th className="py-1 px-2 font-semibold text-right w-24">Total</th>
              </tr>
            </thead>
            <tbody>
              {parts.map((p: any) => (
                <tr key={p.id} className="border-b">
                  <td className="py-1 px-2">{p.description}</td>
                  <td className="py-1 px-2 text-right">{p.quantity}</td>
                  <td className="py-1 px-2 text-right">{brl(Number(p.unit_price))}</td>
                  <td className="py-1 px-2 text-right">{brl(Number(p.total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-right text-xs pr-2 font-semibold">
            Total peças: {brl(Number(quote.parts_total))}
          </div>
        </div>
      )}

      {labor.length > 0 && (
        <div className="mb-6">
          <div className="text-center text-gray-500 mb-1">Lista de serviços</div>
          <table className="w-full text-xs text-left mb-2">
            <thead className="bg-gray-500 text-white">
              <tr>
                <th className="py-1 px-2 font-semibold">Nome do serviço</th>
                <th className="py-1 px-2 font-semibold text-right w-16">Qtd</th>
                <th className="py-1 px-2 font-semibold text-right w-24">Preço</th>
                <th className="py-1 px-2 font-semibold text-right w-24">Total</th>
              </tr>
            </thead>
            <tbody>
              {labor.map((p: any) => (
                <tr key={p.id} className="border-b">
                  <td className="py-1 px-2">{p.description}</td>
                  <td className="py-1 px-2 text-right">{p.quantity}</td>
                  <td className="py-1 px-2 text-right">{brl(Number(p.unit_price))}</td>
                  <td className="py-1 px-2 text-right">{brl(Number(p.total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-right text-xs pr-2 font-semibold">
            Total serviços: {brl(Number(quote.labor_total))}
          </div>
        </div>
      )}

      {/* OBSERVACOES & TOTAL */}
      <div className="mt-8 border border-gray-400">
        <div className="text-center border-b border-gray-400 bg-gray-50 text-gray-600 py-1 font-semibold text-xs">
          Observações da oficina
        </div>
        <div className="p-2 text-[10px] text-justify text-gray-600 min-h-16">
          {quote.notes || 
            "Garantia de 90 (noventa) dias para peças e serviços executados, conforme previsto no Código de Defesa do Consumidor. A garantia cobre defeitos de fabricação das peças aplicadas e falhas decorrentes da execução do serviço realizado. Não estão cobertos danos causados por mau uso, acidentes, intervenções de terceiros, instalações inadequadas ou fatores externos que não estejam relacionados ao serviço prestado."
          }
        </div>
      </div>

      <div className="mt-6 flex justify-end text-xl font-bold text-gray-700">
        Total: {brl(Number(quote.total))}
      </div>

      {/* SIGNATURE */}
      <div className="mt-20 flex justify-end">
        <div className="w-64 border-t border-black text-center pt-2 text-gray-600">
          Assinatura cliente
        </div>
      </div>
    </div>
  );
}
