export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      approvals: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision: Database["public"]["Enums"]["approval_decision"]
          id: string
          note: string | null
          purchase_order_id: string | null
          required_role: Database["public"]["Enums"]["app_role"]
          service_order_id: string
          signature: string | null
          stage: Database["public"]["Enums"]["approval_stage"]
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: Database["public"]["Enums"]["approval_decision"]
          id?: string
          note?: string | null
          purchase_order_id?: string | null
          required_role: Database["public"]["Enums"]["app_role"]
          service_order_id: string
          signature?: string | null
          stage: Database["public"]["Enums"]["approval_stage"]
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: Database["public"]["Enums"]["approval_decision"]
          id?: string
          note?: string | null
          purchase_order_id?: string | null
          required_role?: Database["public"]["Enums"]["app_role"]
          service_order_id?: string
          signature?: string | null
          stage?: Database["public"]["Enums"]["approval_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "approvals_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity: string | null
          entity_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      checklist_items: {
        Row: {
          checklist_id: string
          id: string
          label: string
          note: string | null
          position: number
          state: Database["public"]["Enums"]["check_state"]
        }
        Insert: {
          checklist_id: string
          id?: string
          label: string
          note?: string | null
          position?: number
          state?: Database["public"]["Enums"]["check_state"]
        }
        Update: {
          checklist_id?: string
          id?: string
          label?: string
          note?: string | null
          position?: number
          state?: Database["public"]["Enums"]["check_state"]
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["checklist_kind"]
          notes: string | null
          service_order_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["checklist_kind"]
          notes?: string | null
          service_order_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["checklist_kind"]
          notes?: string | null
          service_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklists_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          company_id: string | null
          created_at: string
          document: string | null
          email: string | null
          id: string
          kind: Database["public"]["Enums"]["client_kind"]
          name: string
          notes: string | null
          phone: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["client_kind"]
          name: string
          notes?: string | null
          phone?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["client_kind"]
          name?: string
          notes?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          active: boolean
          cnpj: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
        }
        Insert: {
          active?: boolean
          cnpj?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
        }
        Update: {
          active?: boolean
          cnpj?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          note: string | null
          service_order_id: string | null
          spent_at: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          note?: string | null
          service_order_id?: string | null
          spent_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          note?: string | null
          service_order_id?: string | null
          spent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          checklist_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          mime_type: string | null
          service_order_id: string
          stage: Database["public"]["Enums"]["media_stage"]
          storage_path: string
        }
        Insert: {
          checklist_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          mime_type?: string | null
          service_order_id: string
          stage?: Database["public"]["Enums"]["media_stage"]
          storage_path: string
        }
        Update: {
          checklist_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          mime_type?: string | null
          service_order_id?: string
          stage?: Database["public"]["Enums"]["media_stage"]
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          note: string | null
          paid_at: string
          service_order_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_at?: string
          service_order_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_at?: string
          service_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          full_name: string
          id: string
          job_title: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name?: string
          id: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string
          id?: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          service_order_id: string
          status: string
          supplier: string | null
          total: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          service_order_id: string
          status?: string
          supplier?: string | null
          total?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          service_order_id?: string
          status?: string
          supplier?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          description: string
          id: string
          kind: string
          quantity: number
          quote_id: string
          total: number
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          kind?: string
          quantity?: number
          quote_id: string
          total?: number
          unit_price?: number
        }
        Update: {
          description?: string
          id?: string
          kind?: string
          quantity?: number
          quote_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          labor_total: number
          notes: string | null
          parts_total: number
          service_order_id: string
          total: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          labor_total?: number
          notes?: string | null
          parts_total?: number
          service_order_id: string
          total?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          labor_total?: number
          notes?: string | null
          parts_total?: number
          service_order_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotes_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          allowed: boolean
          id: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          allowed?: boolean
          id?: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          allowed?: boolean
          id?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      service_orders: {
        Row: {
          client_id: string | null
          company_id: string | null
          complaint: string | null
          created_at: string
          created_by: string | null
          diagnosis: string | null
          estimated_minutes: number | null
          final_report: string | null
          finished_at: string | null
          id: string
          mechanic_id: string | null
          mode: Database["public"]["Enums"]["os_mode"]
          number: number
          promised_at: string | null
          solution: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["os_status"]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          client_id?: string | null
          company_id?: string | null
          complaint?: string | null
          created_at?: string
          created_by?: string | null
          diagnosis?: string | null
          estimated_minutes?: number | null
          final_report?: string | null
          finished_at?: string | null
          id?: string
          mechanic_id?: string | null
          mode: Database["public"]["Enums"]["os_mode"]
          number?: number
          promised_at?: string | null
          solution?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["os_status"]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          client_id?: string | null
          company_id?: string | null
          complaint?: string | null
          created_at?: string
          created_by?: string | null
          diagnosis?: string | null
          estimated_minutes?: number | null
          final_report?: string | null
          finished_at?: string | null
          id?: string
          mechanic_id?: string | null
          mode?: Database["public"]["Enums"]["os_mode"]
          number?: number
          promised_at?: string | null
          solution?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["os_status"]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          brand: string | null
          client_id: string | null
          color: string | null
          company_id: string | null
          created_at: string
          id: string
          km: number | null
          model: string | null
          plate: string
          year: number | null
        }
        Insert: {
          brand?: string | null
          client_id?: string | null
          color?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          km?: number | null
          model?: string | null
          plate: string
          year?: number | null
        }
        Update: {
          brand?: string | null
          client_id?: string | null
          color?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          km?: number | null
          model?: string | null
          plate?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role:
        | "dono"
        | "gerente"
        | "secretaria"
        | "mecanico"
        | "contabilidade"
        | "funcionario"
      approval_decision: "pendente" | "aprovado" | "reprovado"
      approval_stage: "orcamento" | "compra_pecas" | "execucao" | "entrega"
      check_state: "ok" | "atencao" | "critico" | "na"
      checklist_kind: "entrada" | "diagnostico"
      client_kind: "pessoa" | "empresa"
      media_stage:
        | "entrada"
        | "checklist"
        | "defeito"
        | "peca_nova"
        | "servico_concluido"
        | "outro"
      os_mode: "express" | "analise"
      os_status:
        | "recebido"
        | "checklist"
        | "diagnostico"
        | "orcamento"
        | "aguardando_aprovacao"
        | "aprovado"
        | "compra_pecas"
        | "em_execucao"
        | "concluido"
        | "entregue"
        | "cancelado"
      payment_method:
        | "dinheiro"
        | "pix"
        | "debito"
        | "credito"
        | "boleto"
        | "transferencia"
        | "faturado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "dono",
        "gerente",
        "secretaria",
        "mecanico",
        "contabilidade",
        "funcionario",
      ],
      approval_decision: ["pendente", "aprovado", "reprovado"],
      approval_stage: ["orcamento", "compra_pecas", "execucao", "entrega"],
      check_state: ["ok", "atencao", "critico", "na"],
      checklist_kind: ["entrada", "diagnostico"],
      client_kind: ["pessoa", "empresa"],
      media_stage: [
        "entrada",
        "checklist",
        "defeito",
        "peca_nova",
        "servico_concluido",
        "outro",
      ],
      os_mode: ["express", "analise"],
      os_status: [
        "recebido",
        "checklist",
        "diagnostico",
        "orcamento",
        "aguardando_aprovacao",
        "aprovado",
        "compra_pecas",
        "em_execucao",
        "concluido",
        "entregue",
        "cancelado",
      ],
      payment_method: [
        "dinheiro",
        "pix",
        "debito",
        "credito",
        "boleto",
        "transferencia",
        "faturado",
      ],
    },
  },
} as const
