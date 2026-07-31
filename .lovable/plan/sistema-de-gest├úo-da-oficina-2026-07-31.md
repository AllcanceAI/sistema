# Sistema de Gestão da Oficina

Sistema interno com login controlado pelo dono, dois fluxos de entrada de veículo (Express e Análise Completa), aprovações com assinatura por função e registro fotográfico/vídeo em todas as etapas.

## Backend (Lovable Cloud)

Ativo o Lovable Cloud para banco de dados, login e armazenamento de fotos/vídeos.

Tabelas principais:
- `profiles` — nome, telefone, cargo, ativo/inativo (criados apenas pelo dono ou por quem ele autorizar)
- `user_roles` — dono, gerente, secretaria, mecanico, contabilidade, funcionario (tabela separada, sem escalonamento de privilégio)
- `role_permissions` — o dono liga/desliga cada permissão por função (ver orçamento, aprovar compra, lançar laudo, etc.)
- `clients` — nome, telefone, e-mail, tipo (pessoa física / empresa credenciada)
- `companies` — locadoras e empresas credenciadas, contrato, contato
- `vehicles` — placa, modelo, cor, ano, km, cliente/empresa
- `service_orders` — OS com `mode` = express | analise, status, prazo estimado, tempo de conclusão, mecânico responsável
- `checklists` + `checklist_items` — modelo padrão de entrada e modelo de diagnóstico
- `media` — fotos e vídeos ligados à OS e à etapa (entrada, defeito, peça nova, serviço concluído), com descrição
- `quotes` / `quote_items` — orçamento, peças, mão de obra, valores
- `approvals` — etapa, função exigida, aprovado/reprovado, assinatura, data/hora, observação
- `purchase_orders` — pedido de compra de peças com aprovação em etapas
- `audit_log` — quem fez o quê

Todas as tabelas com RLS: cada função vê e altera só o que sua permissão permite; dono vê tudo.

## Login

- Tela única de login (e-mail + senha). Sem cadastro público, sem "esqueci a senha", sem troca de senha pelo usuário.
- O dono cria usuários, define função, permissões, redefine senha e desativa acesso.

## Painéis por função

- **Dono** — visão geral: carros na oficina, faturamento, tempo médio, aprovações pendentes, gestão de usuários e permissões, todos os laudos e mídias.
- **Gerente** — fila de OS, prazos, aprovação de orçamento e compras dentro do limite definido.
- **Secretaria** — recepção do carro, cadastro de cliente/empresa, checklist de entrada com fotos, agenda.
- **Mecânico** — suas OS, checklist de diagnóstico, upload de foto/vídeo da peça com defeito e da peça nova, apontamento de tempo.
- **Contabilidade / Gestão** — orçamentos, compras, relatórios, sem acesso a dados operacionais desnecessários.

## Fluxo Express

Entrada rápida → checklist de entrada com fotos → serviço (troca de óleo, freio, etc.) → prazo estimado e contagem de tempo → conclusão com foto do serviço → entrega. Sem cadeia de aprovações.

## Fluxo Análise Completa

```text
Entrada + checklist com fotos
   -> Diagnóstico (mecânico): laudo, foto/vídeo do defeito, descrição
   -> Solução proposta + orçamento
   -> Aprovação do orçamento (gerente / dono conforme permissão)
   -> Aprovação do cliente ou empresa credenciada
   -> Pedido de compra de peças -> aprovação em etapas (secretaria, gerente, dono)
   -> Execução: foto/vídeo da peça trocada e da peça nova
   -> Conclusão + laudo final -> entrega
```

Cada aprovação registra função, usuário, assinatura e horário. A OS só avança quando todas as assinaturas exigidas na etapa existem.

## Registro fotográfico

- Componente de captura que abre a câmera do celular ou aceita upload.
- Etapas: entrada do veículo, checklist, defeito encontrado (foto + vídeo + descrição), peças novas, serviço realizado.
- Armazenamento privado; só quem tem permissão na OS visualiza.

## Detalhes técnicos

- TanStack Start + rotas protegidas sob `_authenticated/`, painel escolhido pela função do usuário.
- Server functions para toda leitura/escrita sensível; validação com Zod.
- Upload direto para o Storage privado com URLs assinadas para exibição.
- Design system próprio (tema escuro industrial, sem visual genérico), definido em `src/styles.css`.

## Entrega em etapas

1. Banco, funções, permissões, login e criação de usuários pelo dono.
2. Cadastro de clientes, empresas credenciadas e veículos + entrada Express com checklist e fotos.
3. Fluxo de análise completa: diagnóstico, orçamento, aprovações com assinatura, compra de peças.
4. Painéis por função, relatórios e histórico completo da OS.
