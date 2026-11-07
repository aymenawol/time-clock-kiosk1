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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      airlines: {
        Row: {
          active: boolean
          assist_contact: string | null
          created_at: string
          iata_code: string | null
          id: string
          location_id: string | null
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
        }
        Insert: {
          active?: boolean
          assist_contact?: string | null
          created_at?: string
          iata_code?: string | null
          id?: string
          location_id?: string | null
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
        }
        Update: {
          active?: boolean
          assist_contact?: string | null
          created_at?: string
          iata_code?: string | null
          id?: string
          location_id?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "airlines_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "airlines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          kind: string
          message: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          message: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          message?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      assist_requests: {
        Row: {
          airline_id: string | null
          assist_type: string
          created_at: string
          employee_id: string
          escalated_at: string | null
          flight_number: string | null
          id: string
          location_id: string | null
          notes: string | null
          organization_id: string
          passenger_count: number
          passenger_name: string
          resolved_at: string | null
          responded_at: string | null
          responded_by: string | null
          response: string | null
          shift_id: string | null
          status: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          airline_id?: string | null
          assist_type?: string
          created_at?: string
          employee_id: string
          escalated_at?: string | null
          flight_number?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          organization_id: string
          passenger_count?: number
          passenger_name: string
          resolved_at?: string | null
          responded_at?: string | null
          responded_by?: string | null
          response?: string | null
          shift_id?: string | null
          status?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          airline_id?: string | null
          assist_type?: string
          created_at?: string
          employee_id?: string
          escalated_at?: string | null
          flight_number?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          organization_id?: string
          passenger_count?: number
          passenger_name?: string
          resolved_at?: string | null
          responded_at?: string | null
          responded_by?: string | null
          response?: string | null
          shift_id?: string | null
          status?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assist_requests_airline_id_fkey"
            columns: ["airline_id"]
            isOneToOne: false
            referencedRelation: "airlines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assist_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assist_requests_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assist_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assist_requests_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assist_requests_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assist_requests_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_employee_id: string | null
          actor_user_id: string | null
          created_at: string
          data: Json
          entity: string
          entity_id: string | null
          id: number
          organization_id: string
        }
        Insert: {
          action: string
          actor_employee_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          data?: Json
          entity: string
          entity_id?: string | null
          id?: never
          organization_id: string
        }
        Update: {
          action?: string
          actor_employee_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          data?: Json
          entity?: string
          entity_id?: string | null
          id?: never
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_employee_id_fkey"
            columns: ["actor_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_awards: {
        Row: {
          awarded_by: string | null
          choice_rank: number | null
          created_at: string
          cycle_id: string
          employee_id: string
          id: string
          line_id: string
          method: string
          organization_id: string
          reason: string | null
        }
        Insert: {
          awarded_by?: string | null
          choice_rank?: number | null
          created_at?: string
          cycle_id: string
          employee_id: string
          id?: string
          line_id: string
          method: string
          organization_id: string
          reason?: string | null
        }
        Update: {
          awarded_by?: string | null
          choice_rank?: number | null
          created_at?: string
          cycle_id?: string
          employee_id?: string
          id?: string
          line_id?: string
          method?: string
          organization_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bid_awards_awarded_by_fkey"
            columns: ["awarded_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_awards_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "bid_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_awards_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_awards_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "bid_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_awards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_cycles: {
        Row: {
          awarded_at: string | null
          awarded_by: string | null
          closes_at: string
          created_at: string
          created_by: string | null
          description: string | null
          ends_on: string
          id: string
          max_choices: number
          name: string
          opens_at: string
          organization_id: string
          starts_on: string
          status: string
        }
        Insert: {
          awarded_at?: string | null
          awarded_by?: string | null
          closes_at: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_on: string
          id?: string
          max_choices?: number
          name: string
          opens_at: string
          organization_id: string
          starts_on: string
          status?: string
        }
        Update: {
          awarded_at?: string | null
          awarded_by?: string | null
          closes_at?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_on?: string
          id?: string
          max_choices?: number
          name?: string
          opens_at?: string
          organization_id?: string
          starts_on?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bid_cycles_awarded_by_fkey"
            columns: ["awarded_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_cycles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_cycles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_lines: {
        Row: {
          capacity: number
          cycle_id: string
          end_time: string
          id: string
          line_number: number
          line_type: string
          notes: string | null
          organization_id: string
          report_time: string | null
          route_id: string | null
          start_time: string
          weekdays: number[]
        }
        Insert: {
          capacity?: number
          cycle_id: string
          end_time: string
          id?: string
          line_number: number
          line_type?: string
          notes?: string | null
          organization_id: string
          report_time?: string | null
          route_id?: string | null
          start_time: string
          weekdays: number[]
        }
        Update: {
          capacity?: number
          cycle_id?: string
          end_time?: string
          id?: string
          line_number?: number
          line_type?: string
          notes?: string | null
          organization_id?: string
          report_time?: string | null
          route_id?: string | null
          start_time?: string
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "bid_lines_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "bid_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_lines_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_preferences: {
        Row: {
          cycle_id: string
          employee_id: string
          id: string
          line_ids: string[]
          organization_id: string
          submitted_at: string
        }
        Insert: {
          cycle_id: string
          employee_id: string
          id?: string
          line_ids: string[]
          organization_id: string
          submitted_at?: string
        }
        Update: {
          cycle_id?: string
          employee_id?: string
          id?: string
          line_ids?: string[]
          organization_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bid_preferences_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "bid_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_preferences_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      breaks: {
        Row: {
          created_at: string
          employee_id: string
          ended_at: string | null
          id: string
          kind: Database["public"]["Enums"]["break_kind"]
          missed_alerted_at: string | null
          organization_id: string
          overrun_alerted_at: string | null
          paid: boolean
          planned_minutes: number
          reminder_sent_at: string | null
          reopened_at: string | null
          reopened_by: string | null
          sequence: number
          shift_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["break_status"]
          updated_at: string
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          created_at?: string
          employee_id: string
          ended_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["break_kind"]
          missed_alerted_at?: string | null
          organization_id: string
          overrun_alerted_at?: string | null
          paid: boolean
          planned_minutes: number
          reminder_sent_at?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          sequence: number
          shift_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["break_status"]
          updated_at?: string
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          created_at?: string
          employee_id?: string
          ended_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["break_kind"]
          missed_alerted_at?: string | null
          organization_id?: string
          overrun_alerted_at?: string | null
          paid?: boolean
          planned_minutes?: number
          reminder_sent_at?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          sequence?: number
          shift_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["break_status"]
          updated_at?: string
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "breaks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breaks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breaks_reopened_by_fkey"
            columns: ["reopened_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breaks_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_members: {
        Row: {
          added_at: string
          employee_id: string
          organization_id: string
          room_id: string
        }
        Insert: {
          added_at?: string
          employee_id: string
          organization_id: string
          room_id: string
        }
        Update: {
          added_at?: string
          employee_id?: string
          organization_id?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          kind: string
          organization_id: string
          requires_confirmation: boolean
          room_id: string
          sender_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind?: string
          organization_id: string
          requires_confirmation?: boolean
          room_id: string
          sender_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind?: string
          organization_id?: string
          requires_confirmation?: boolean
          room_id?: string
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_receipts: {
        Row: {
          confirmed_at: string | null
          delivered_at: string | null
          employee_id: string
          last_reminded_at: string | null
          message_id: string
          organization_id: string
          read_at: string | null
          reminders_sent: number
        }
        Insert: {
          confirmed_at?: string | null
          delivered_at?: string | null
          employee_id: string
          last_reminded_at?: string | null
          message_id: string
          organization_id: string
          read_at?: string | null
          reminders_sent?: number
        }
        Update: {
          confirmed_at?: string | null
          delivered_at?: string | null
          employee_id?: string
          last_reminded_at?: string | null
          message_id?: string
          organization_id?: string
          read_at?: string | null
          reminders_sent?: number
        }
        Relationships: [
          {
            foreignKeyName: "chat_receipts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_receipts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          archived: boolean
          created_at: string
          created_by: string | null
          id: string
          kind: string
          name: string
          organization_id: string
          roles: Database["public"]["Enums"]["app_role"][]
        }
        Insert: {
          archived?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          name: string
          organization_id: string
          roles?: Database["public"]["Enums"]["app_role"][]
        }
        Update: {
          archived?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          name?: string
          organization_id?: string
          roles?: Database["public"]["Enums"]["app_role"][]
        }
        Relationships: [
          {
            foreignKeyName: "chat_rooms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_rooms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          active: boolean
          category: string
          critical: boolean
          id: string
          label: string
          organization_id: string
          sort: number
        }
        Insert: {
          active?: boolean
          category: string
          critical?: boolean
          id?: string
          label: string
          organization_id: string
          sort?: number
        }
        Update: {
          active?: boolean
          category?: string
          critical?: boolean
          id?: string
          label?: string
          organization_id?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      count_sheet_revisions: {
        Row: {
          created_at: string
          edited_by: string | null
          id: string
          new_rows: Json
          organization_id: string
          previous_rows: Json
          reason: string
          sheet_id: string
        }
        Insert: {
          created_at?: string
          edited_by?: string | null
          id?: string
          new_rows: Json
          organization_id: string
          previous_rows: Json
          reason: string
          sheet_id: string
        }
        Update: {
          created_at?: string
          edited_by?: string | null
          id?: string
          new_rows?: Json
          organization_id?: string
          previous_rows?: Json
          reason?: string
          sheet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "count_sheet_revisions_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "count_sheet_revisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "count_sheet_revisions_sheet_id_fkey"
            columns: ["sheet_id"]
            isOneToOne: false
            referencedRelation: "count_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      count_sheets: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          organization_id: string
          route_id: string | null
          rows: Json
          shift_id: string
          status: string
          submitted_at: string | null
          updated_at: string
          vehicle_id: string | null
          work_date: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          organization_id: string
          route_id?: string | null
          rows?: Json
          shift_id: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          vehicle_id?: string | null
          work_date: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          organization_id?: string
          route_id?: string | null
          rows?: Json
          shift_id?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          vehicle_id?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "count_sheets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "count_sheets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "count_sheets_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "count_sheets_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: true
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "count_sheets_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      defects: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          description: string | null
          id: string
          inspection_id: string | null
          item: string
          organization_id: string
          photo_paths: string[]
          reported_by: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          assigned_to?: string | null
          category: string
          created_at?: string
          description?: string | null
          id?: string
          inspection_id?: string | null
          item: string
          organization_id: string
          photo_paths?: string[]
          reported_by?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          inspection_id?: string | null
          item?: string
          organization_id?: string
          photo_paths?: string[]
          reported_by?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "defects_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defects_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defects_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defects_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defects_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      emergencies: {
        Row: {
          active: boolean
          created_at: string
          id: string
          kind: string
          message: string
          organization_id: string
          resolved_at: string | null
          resolved_by: string | null
          title: string
          triggered_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          kind: string
          message: string
          organization_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          title: string
          triggered_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: string
          message?: string
          organization_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          title?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emergencies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergencies_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergencies_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_acks: {
        Row: {
          acked_at: string
          emergency_id: string
          employee_id: string
          organization_id: string
        }
        Insert: {
          acked_at?: string
          emergency_id: string
          employee_id: string
          organization_id: string
        }
        Update: {
          acked_at?: string
          emergency_id?: string
          employee_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_acks_emergency_id_fkey"
            columns: ["emergency_id"]
            isOneToOne: false
            referencedRelation: "emergencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_acks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_acks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_compensation: {
        Row: {
          daily_ot_exempt: boolean
          employee_id: string
          organization_id: string
          ot_exempt_reason: string | null
          pay_rate_cents: number
          updated_at: string
        }
        Insert: {
          daily_ot_exempt?: boolean
          employee_id: string
          organization_id: string
          ot_exempt_reason?: string | null
          pay_rate_cents?: number
          updated_at?: string
        }
        Update: {
          daily_ot_exempt?: boolean
          employee_id?: string
          organization_id?: string
          ot_exempt_reason?: string | null
          pay_rate_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_compensation_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_compensation_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_credentials: {
        Row: {
          employee_id: string
          failed_count: number
          locked_until: string | null
          organization_id: string
          pin_hash: string | null
          pin_set_at: string | null
          updated_at: string
        }
        Insert: {
          employee_id: string
          failed_count?: number
          locked_until?: string | null
          organization_id: string
          pin_hash?: string | null
          pin_set_at?: string | null
          updated_at?: string
        }
        Update: {
          employee_id?: string
          failed_count?: number
          locked_until?: string | null
          organization_id?: string
          pin_hash?: string | null
          pin_set_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_credentials_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          email: string | null
          employee_number: string
          first_name: string
          hire_date: string | null
          id: string
          job_title: string | null
          last_name: string
          notes: string | null
          organization_id: string
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          seniority_number: number | null
          status: Database["public"]["Enums"]["employee_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          employee_number: string
          first_name: string
          hire_date?: string | null
          id?: string
          job_title?: string | null
          last_name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          role: Database["public"]["Enums"]["app_role"]
          seniority_number?: number | null
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          employee_number?: string
          first_name?: string
          hire_date?: string | null
          id?: string
          job_title?: string | null
          last_name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          seniority_number?: number | null
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      end_of_shift_reports: {
        Row: {
          condition: string
          created_at: string
          employee_id: string
          energy_level: number | null
          id: string
          notes: string | null
          odometer: number | null
          organization_id: string
          shift_id: string
          vehicle_id: string | null
        }
        Insert: {
          condition: string
          created_at?: string
          employee_id: string
          energy_level?: number | null
          id?: string
          notes?: string | null
          odometer?: number | null
          organization_id: string
          shift_id: string
          vehicle_id?: string | null
        }
        Update: {
          condition?: string
          created_at?: string
          employee_id?: string
          energy_level?: number | null
          id?: string
          notes?: string | null
          odometer?: number | null
          organization_id?: string
          shift_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "end_of_shift_reports_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "end_of_shift_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "end_of_shift_reports_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: true
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "end_of_shift_reports_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fatigue_alerts: {
        Row: {
          created_at: string
          dedupe_key: string
          detail: Json
          employee_id: string
          id: string
          kind: string
          message: string
          organization_id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          shift_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          dedupe_key: string
          detail?: Json
          employee_id: string
          id?: string
          kind: string
          message: string
          organization_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          shift_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string
          detail?: Json
          employee_id?: string
          id?: string
          kind?: string
          message?: string
          organization_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          shift_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fatigue_alerts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatigue_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatigue_alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatigue_alerts_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          employee_id: string
          form_type: string
          id: string
          organization_id: string
          payload: Json
          reviewed_at: string | null
          reviewer_comment: string | null
          reviewer_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          employee_id: string
          form_type: string
          id?: string
          organization_id: string
          payload: Json
          reviewed_at?: string | null
          reviewer_comment?: string | null
          reviewer_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          employee_id?: string
          form_type?: string
          id?: string
          organization_id?: string
          payload?: Json
          reviewed_at?: string | null
          reviewer_comment?: string | null
          reviewer_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_logs: {
        Row: {
          created_at: string
          employee_id: string | null
          energy_after: number | null
          energy_before: number | null
          id: string
          notes: string | null
          odometer: number | null
          organization_id: string
          quantity: number | null
          service: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          energy_after?: number | null
          energy_before?: number | null
          id?: string
          notes?: string | null
          odometer?: number | null
          organization_id: string
          quantity?: number | null
          service: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          energy_after?: number | null
          energy_before?: number | null
          id?: string
          notes?: string | null
          odometer?: number | null
          organization_id?: string
          quantity?: number | null
          service?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          created_at: string
          damage: Json
          defect_count: number
          employee_id: string
          id: string
          kind: string
          notes: string | null
          odometer: number | null
          organization_id: string
          results: Json
          shift_id: string
          submitted_at: string | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          damage?: Json
          defect_count?: number
          employee_id: string
          id?: string
          kind: string
          notes?: string | null
          odometer?: number | null
          organization_id: string
          results?: Json
          shift_id: string
          submitted_at?: string | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          damage?: Json
          defect_count?: number
          employee_id?: string
          id?: string
          kind?: string
          notes?: string | null
          odometer?: number | null
          organization_id?: string
          results?: Json
          shift_id?: string
          submitted_at?: string | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspections_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      kiosk_attempts: {
        Row: {
          created_at: string
          device_id: string
          employee_id: string | null
          id: number
          organization_id: string
          reason: string | null
          success: boolean
        }
        Insert: {
          created_at?: string
          device_id: string
          employee_id?: string | null
          id?: never
          organization_id: string
          reason?: string | null
          success: boolean
        }
        Update: {
          created_at?: string
          device_id?: string
          employee_id?: string | null
          id?: never
          organization_id?: string
          reason?: string | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "kiosk_attempts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "kiosk_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiosk_attempts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiosk_attempts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kiosk_devices: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          last_seen_at: string | null
          name: string
          organization_id: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_seen_at?: string | null
          name: string
          organization_id: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_seen_at?: string | null
          name?: string
          organization_id?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "kiosk_devices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiosk_devices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kiosk_pairing_codes: {
        Row: {
          code_hash: string
          created_at: string
          created_by: string | null
          device_id: string | null
          device_name: string
          expires_at: string
          id: string
          organization_id: string
          used_at: string | null
        }
        Insert: {
          code_hash: string
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          device_name: string
          expires_at: string
          id?: string
          organization_id: string
          used_at?: string | null
        }
        Update: {
          code_hash?: string
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          device_name?: string
          expires_at?: string
          id?: string
          organization_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kiosk_pairing_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiosk_pairing_codes_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "kiosk_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiosk_pairing_codes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_ledger: {
        Row: {
          created_at: string
          created_by: string | null
          employee_id: string
          form_id: string | null
          hours: number
          id: string
          kind: string
          organization_id: string
          reason: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_id: string
          form_id?: string | null
          hours: number
          id?: string
          kind: string
          organization_id: string
          reason: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_id?: string
          form_id?: string | null
          hours?: number
          id?: string
          kind?: string
          organization_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_ledger_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_ledger_form_fk"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_ledger_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          is_count_column: boolean
          kind: string
          lat: number | null
          lng: number | null
          name: string
          organization_id: string
          radius_m: number
          sort: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          is_count_column?: boolean
          kind?: string
          lat?: number | null
          lng?: number | null
          name: string
          organization_id: string
          radius_m?: number
          sort?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          is_count_column?: boolean
          kind?: string
          lat?: number | null
          lng?: number | null
          name?: string
          organization_id?: string
          radius_m?: number
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lost_item_events: {
        Row: {
          actor_id: string | null
          created_at: string
          from_status: string | null
          id: string
          item_id: string
          note: string | null
          organization_id: string
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          item_id: string
          note?: string | null
          organization_id: string
          to_status: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          item_id?: string
          note?: string | null
          organization_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lost_item_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lost_item_events_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "lost_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lost_item_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lost_items: {
        Row: {
          category: string
          claimant_contact: string | null
          claimant_id_last4: string | null
          claimant_name: string | null
          closed_at: string | null
          contents: string | null
          created_at: string
          custody_by: string | null
          description: string
          disposal_reason: string | null
          found_at: string
          found_by: string | null
          found_location_id: string | null
          found_vehicle_id: string | null
          id: string
          organization_id: string
          photo_paths: string[]
          reference: string
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          claimant_contact?: string | null
          claimant_id_last4?: string | null
          claimant_name?: string | null
          closed_at?: string | null
          contents?: string | null
          created_at?: string
          custody_by?: string | null
          description: string
          disposal_reason?: string | null
          found_at?: string
          found_by?: string | null
          found_location_id?: string | null
          found_vehicle_id?: string | null
          id?: string
          organization_id: string
          photo_paths?: string[]
          reference?: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          claimant_contact?: string | null
          claimant_id_last4?: string | null
          claimant_name?: string | null
          closed_at?: string | null
          contents?: string | null
          created_at?: string
          custody_by?: string | null
          description?: string
          disposal_reason?: string | null
          found_at?: string
          found_by?: string | null
          found_location_id?: string | null
          found_vehicle_id?: string | null
          id?: string
          organization_id?: string
          photo_paths?: string[]
          reference?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lost_items_custody_by_fkey"
            columns: ["custody_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lost_items_found_by_fkey"
            columns: ["found_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lost_items_found_location_id_fkey"
            columns: ["found_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lost_items_found_vehicle_id_fkey"
            columns: ["found_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lost_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          email_attempts: number
          email_error: string | null
          email_status: string
          employee_id: string
          id: string
          kind: string
          link: string | null
          organization_id: string
          read_at: string | null
          severity: string
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          email_attempts?: number
          email_error?: string | null
          email_status?: string
          employee_id: string
          id?: string
          kind: string
          link?: string | null
          organization_id: string
          read_at?: string | null
          severity?: string
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          email_attempts?: number
          email_error?: string | null
          email_status?: string
          employee_id?: string
          id?: string
          kind?: string
          link?: string | null
          organization_id?: string
          read_at?: string | null
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      off_day_requests: {
        Row: {
          available_from: string | null
          available_hours: number | null
          created_at: string
          employee_id: string
          id: string
          message: string
          organization_id: string
          responded_at: string | null
          response: string
          response_note: string | null
          sent_by: string | null
          work_date: string
        }
        Insert: {
          available_from?: string | null
          available_hours?: number | null
          created_at?: string
          employee_id: string
          id?: string
          message: string
          organization_id: string
          responded_at?: string | null
          response?: string
          response_note?: string | null
          sent_by?: string | null
          work_date: string
        }
        Update: {
          available_from?: string | null
          available_hours?: number | null
          created_at?: string
          employee_id?: string
          id?: string
          message?: string
          organization_id?: string
          responded_at?: string | null
          response?: string
          response_note?: string | null
          sent_by?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "off_day_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "off_day_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "off_day_requests_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          labor_jurisdiction: string
          name: string
          public_token: string
          settings: Json
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          labor_jurisdiction?: string
          name: string
          public_token?: string
          settings?: Json
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          labor_jurisdiction?: string
          name?: string
          public_token?: string
          settings?: Json
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      ot_awards: {
        Row: {
          awarded_by: string | null
          created_at: string
          employee_id: string
          id: string
          method: string
          offer_id: string
          organization_id: string
        }
        Insert: {
          awarded_by?: string | null
          created_at?: string
          employee_id: string
          id?: string
          method: string
          offer_id: string
          organization_id: string
        }
        Update: {
          awarded_by?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          method?: string
          offer_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ot_awards_awarded_by_fkey"
            columns: ["awarded_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ot_awards_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ot_awards_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "ot_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ot_awards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ot_bids: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          offer_id: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          offer_id: string
          organization_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          offer_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ot_bids_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ot_bids_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "ot_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ot_bids_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ot_offers: {
        Row: {
          bid_closes_at: string
          created_at: string
          description: string | null
          duration_minutes: number
          eligible_roles: Database["public"]["Enums"]["app_role"][]
          id: string
          organization_id: string
          posted_by: string | null
          slots: number
          starts_at: string
          status: string
        }
        Insert: {
          bid_closes_at: string
          created_at?: string
          description?: string | null
          duration_minutes: number
          eligible_roles?: Database["public"]["Enums"]["app_role"][]
          id?: string
          organization_id: string
          posted_by?: string | null
          slots?: number
          starts_at: string
          status?: string
        }
        Update: {
          bid_closes_at?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          eligible_roles?: Database["public"]["Enums"]["app_role"][]
          id?: string
          organization_id?: string
          posted_by?: string | null
          slots?: number
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ot_offers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ot_offers_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_period_lines: {
        Row: {
          created_at: string
          daily_ot_minutes: number
          detail: Json
          employee_id: string
          gross_cents: number
          id: string
          leave_minutes: number
          organization_id: string
          overtime_cents: number
          paid_break_minutes: number
          pay_period_id: string
          pay_rate_cents: number
          regular_cents: number
          regular_minutes: number
          unpaid_break_minutes: number
          weekly_ot_minutes: number
        }
        Insert: {
          created_at?: string
          daily_ot_minutes?: number
          detail?: Json
          employee_id: string
          gross_cents?: number
          id?: string
          leave_minutes?: number
          organization_id: string
          overtime_cents?: number
          paid_break_minutes?: number
          pay_period_id: string
          pay_rate_cents?: number
          regular_cents?: number
          regular_minutes?: number
          unpaid_break_minutes?: number
          weekly_ot_minutes?: number
        }
        Update: {
          created_at?: string
          daily_ot_minutes?: number
          detail?: Json
          employee_id?: string
          gross_cents?: number
          id?: string
          leave_minutes?: number
          organization_id?: string
          overtime_cents?: number
          paid_break_minutes?: number
          pay_period_id?: string
          pay_rate_cents?: number
          regular_cents?: number
          regular_minutes?: number
          unpaid_break_minutes?: number
          weekly_ot_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "pay_period_lines_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_period_lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_period_lines_pay_period_id_fkey"
            columns: ["pay_period_id"]
            isOneToOne: false
            referencedRelation: "pay_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_periods: {
        Row: {
          created_at: string
          created_by: string | null
          ends_on: string
          id: string
          locked_at: string | null
          locked_by: string | null
          organization_id: string
          pay_date: string | null
          starts_on: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_on: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          organization_id: string
          pay_date?: string | null
          starts_on: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_on?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          organization_id?: string
          pay_date?: string | null
          starts_on?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pay_periods_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_periods_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_periods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_exports: {
        Row: {
          created_at: string
          exported_by: string | null
          id: string
          organization_id: string
          pay_period_id: string
          row_count: number
          sha256: string
        }
        Insert: {
          created_at?: string
          exported_by?: string | null
          id?: string
          organization_id: string
          pay_period_id: string
          row_count: number
          sha256: string
        }
        Update: {
          created_at?: string
          exported_by?: string | null
          id?: string
          organization_id?: string
          pay_period_id?: string
          row_count?: number
          sha256?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_exports_exported_by_fkey"
            columns: ["exported_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_exports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_exports_pay_period_id_fkey"
            columns: ["pay_period_id"]
            isOneToOne: false
            referencedRelation: "pay_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      radio_codes: {
        Row: {
          active: boolean
          code: string
          driver_selectable: boolean
          id: string
          is_alert: boolean
          label: string
          notify_roles: Database["public"]["Enums"]["app_role"][]
          organization_id: string
          sets_vehicle_status:
            | Database["public"]["Enums"]["vehicle_status"]
            | null
          sort: number
        }
        Insert: {
          active?: boolean
          code: string
          driver_selectable?: boolean
          id?: string
          is_alert?: boolean
          label: string
          notify_roles?: Database["public"]["Enums"]["app_role"][]
          organization_id: string
          sets_vehicle_status?:
            | Database["public"]["Enums"]["vehicle_status"]
            | null
          sort?: number
        }
        Update: {
          active?: boolean
          code?: string
          driver_selectable?: boolean
          id?: string
          is_alert?: boolean
          label?: string
          notify_roles?: Database["public"]["Enums"]["app_role"][]
          organization_id?: string
          sets_vehicle_status?:
            | Database["public"]["Enums"]["vehicle_status"]
            | null
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "radio_codes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          active: boolean
          color: string
          created_at: string
          id: string
          name: string
          organization_id: string
          stop_ids: string[]
        }
        Insert: {
          active?: boolean
          color?: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          stop_ids?: string[]
        }
        Update: {
          active?: boolean
          color?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          stop_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "routes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_attendance: {
        Row: {
          employee_id: string
          meeting_id: string
          note: string | null
          organization_id: string
          recorded_by: string | null
          signed_in_at: string | null
          status: string
        }
        Insert: {
          employee_id: string
          meeting_id: string
          note?: string | null
          organization_id: string
          recorded_by?: string | null
          signed_in_at?: string | null
          status: string
        }
        Update: {
          employee_id?: string
          meeting_id?: string
          note?: string | null
          organization_id?: string
          recorded_by?: string | null
          signed_in_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_attendance_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "safety_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_attendance_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_meetings: {
        Row: {
          audience: Database["public"]["Enums"]["app_role"][]
          created_at: string
          created_by: string | null
          duration_minutes: number
          id: string
          location: string | null
          notes: string | null
          organization_id: string
          starts_at: string
          status: string
          title: string
        }
        Insert: {
          audience?: Database["public"]["Enums"]["app_role"][]
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          id?: string
          location?: string | null
          notes?: string | null
          organization_id: string
          starts_at: string
          status?: string
          title: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["app_role"][]
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          id?: string
          location?: string | null
          notes?: string | null
          organization_id?: string
          starts_at?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_meetings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          clock_in_at: string
          clock_out_at: string | null
          compliance_at: string | null
          compliance_by: string | null
          compliance_note: string | null
          compliance_verdict: string | null
          created_at: string
          edit_reason: string | null
          edited_by: string | null
          employee_id: string
          id: string
          kiosk_in_device_id: string | null
          kiosk_out_device_id: string | null
          meal_waived: boolean
          notes: string | null
          organization_id: string
          radio_status: string | null
          radio_status_at: string | null
          route_id: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          source_in: string
          source_out: string | null
          status: Database["public"]["Enums"]["shift_status"]
          tablet_id: string | null
          updated_at: string
          vehicle_id: string | null
          work_date: string
        }
        Insert: {
          clock_in_at: string
          clock_out_at?: string | null
          compliance_at?: string | null
          compliance_by?: string | null
          compliance_note?: string | null
          compliance_verdict?: string | null
          created_at?: string
          edit_reason?: string | null
          edited_by?: string | null
          employee_id: string
          id?: string
          kiosk_in_device_id?: string | null
          kiosk_out_device_id?: string | null
          meal_waived?: boolean
          notes?: string | null
          organization_id: string
          radio_status?: string | null
          radio_status_at?: string | null
          route_id?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          source_in?: string
          source_out?: string | null
          status?: Database["public"]["Enums"]["shift_status"]
          tablet_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
          work_date: string
        }
        Update: {
          clock_in_at?: string
          clock_out_at?: string | null
          compliance_at?: string | null
          compliance_by?: string | null
          compliance_note?: string | null
          compliance_verdict?: string | null
          created_at?: string
          edit_reason?: string | null
          edited_by?: string | null
          employee_id?: string
          id?: string
          kiosk_in_device_id?: string | null
          kiosk_out_device_id?: string | null
          meal_waived?: boolean
          notes?: string | null
          organization_id?: string
          radio_status?: string | null
          radio_status_at?: string | null
          route_id?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          source_in?: string
          source_out?: string | null
          status?: Database["public"]["Enums"]["shift_status"]
          tablet_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_compliance_by_fkey"
            columns: ["compliance_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_kiosk_in_device_id_fkey"
            columns: ["kiosk_in_device_id"]
            isOneToOne: false
            referencedRelation: "kiosk_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_kiosk_out_device_id_fkey"
            columns: ["kiosk_out_device_id"]
            isOneToOne: false
            referencedRelation: "kiosk_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_tablet_id_fkey"
            columns: ["tablet_id"]
            isOneToOne: false
            referencedRelation: "tablets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      tablets: {
        Row: {
          active: boolean
          created_at: string
          id: string
          notes: string | null
          number: string
          organization_id: string
          serial: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          number: string
          organization_id: string
          serial?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          number?: string
          organization_id?: string
          serial?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tablets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_latest_positions: {
        Row: {
          accuracy_m: number | null
          employee_id: string | null
          heading: number | null
          lat: number
          lng: number
          organization_id: string
          recorded_at: string
          shift_id: string | null
          speed_mps: number | null
          vehicle_id: string
        }
        Insert: {
          accuracy_m?: number | null
          employee_id?: string | null
          heading?: number | null
          lat: number
          lng: number
          organization_id: string
          recorded_at: string
          shift_id?: string | null
          speed_mps?: number | null
          vehicle_id: string
        }
        Update: {
          accuracy_m?: number | null
          employee_id?: string | null
          heading?: number | null
          lat?: number
          lng?: number
          organization_id?: string
          recorded_at?: string
          shift_id?: string | null
          speed_mps?: number | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_latest_positions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_latest_positions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_latest_positions_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_latest_positions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: true
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_positions: {
        Row: {
          accuracy_m: number | null
          employee_id: string | null
          heading: number | null
          id: number
          lat: number
          lng: number
          organization_id: string
          recorded_at: string
          shift_id: string | null
          speed_mps: number | null
          vehicle_id: string
        }
        Insert: {
          accuracy_m?: number | null
          employee_id?: string | null
          heading?: number | null
          id?: never
          lat: number
          lng: number
          organization_id: string
          recorded_at?: string
          shift_id?: string | null
          speed_mps?: number | null
          vehicle_id: string
        }
        Update: {
          accuracy_m?: number | null
          employee_id?: string | null
          heading?: number | null
          id?: never
          lat?: number
          lng?: number
          organization_id?: string
          recorded_at?: string
          shift_id?: string | null
          speed_mps?: number | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_positions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_positions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_positions_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_positions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          energy_level: number | null
          from_status: Database["public"]["Enums"]["vehicle_status"] | null
          id: string
          odometer: number | null
          organization_id: string
          reason: string | null
          to_status: Database["public"]["Enums"]["vehicle_status"]
          vehicle_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          energy_level?: number | null
          from_status?: Database["public"]["Enums"]["vehicle_status"] | null
          id?: string
          odometer?: number | null
          organization_id: string
          reason?: string | null
          to_status: Database["public"]["Enums"]["vehicle_status"]
          vehicle_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          energy_level?: number | null
          from_status?: Database["public"]["Enums"]["vehicle_status"] | null
          id?: string
          odometer?: number | null
          organization_id?: string
          reason?: string | null
          to_status?: Database["public"]["Enums"]["vehicle_status"]
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_status_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_status_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          active: boolean
          capacity: number | null
          created_at: string
          energy_level: number | null
          id: string
          notes: string | null
          number: string
          odometer: number | null
          organization_id: string
          plate: string | null
          powertrain: string
          status: Database["public"]["Enums"]["vehicle_status"]
          updated_at: string
          vehicle_type: string
          vin: string | null
        }
        Insert: {
          active?: boolean
          capacity?: number | null
          created_at?: string
          energy_level?: number | null
          id?: string
          notes?: string | null
          number: string
          odometer?: number | null
          organization_id: string
          plate?: string | null
          powertrain?: string
          status?: Database["public"]["Enums"]["vehicle_status"]
          updated_at?: string
          vehicle_type?: string
          vin?: string | null
        }
        Update: {
          active?: boolean
          capacity?: number | null
          created_at?: string
          energy_level?: number | null
          id?: string
          notes?: string | null
          number?: string
          odometer?: number | null
          organization_id?: string
          plate?: string | null
          powertrain?: string
          status?: Database["public"]["Enums"]["vehicle_status"]
          updated_at?: string
          vehicle_type?: string
          vin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_bid_awards: {
        Args: { p_awards: Json; p_cycle_id: string }
        Returns: number
      }
      award_ot_offer: {
        Args: { p_employee_ids: string[]; p_method: string; p_offer_id: string }
        Returns: number
      }
      end_break: {
        Args: never
        Returns: {
          created_at: string
          employee_id: string
          ended_at: string | null
          id: string
          kind: Database["public"]["Enums"]["break_kind"]
          missed_alerted_at: string | null
          organization_id: string
          overrun_alerted_at: string | null
          paid: boolean
          planned_minutes: number
          reminder_sent_at: string | null
          reopened_at: string | null
          reopened_by: string | null
          sequence: number
          shift_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["break_status"]
          updated_at: string
          window_end: string | null
          window_start: string | null
        }
        SetofOptions: {
          from: "*"
          to: "breaks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      kiosk_clock_in: {
        Args: {
          p_breaks: Json
          p_device_id: string
          p_employee_id: string
          p_work_date: string
        }
        Returns: {
          clock_in_at: string
          clock_out_at: string | null
          compliance_at: string | null
          compliance_by: string | null
          compliance_note: string | null
          compliance_verdict: string | null
          created_at: string
          edit_reason: string | null
          edited_by: string | null
          employee_id: string
          id: string
          kiosk_in_device_id: string | null
          kiosk_out_device_id: string | null
          meal_waived: boolean
          notes: string | null
          organization_id: string
          radio_status: string | null
          radio_status_at: string | null
          route_id: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          source_in: string
          source_out: string | null
          status: Database["public"]["Enums"]["shift_status"]
          tablet_id: string | null
          updated_at: string
          vehicle_id: string | null
          work_date: string
        }
        SetofOptions: {
          from: "*"
          to: "shifts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      kiosk_clock_out: {
        Args: { p_device_id: string; p_employee_id: string }
        Returns: {
          clock_in_at: string
          clock_out_at: string | null
          compliance_at: string | null
          compliance_by: string | null
          compliance_note: string | null
          compliance_verdict: string | null
          created_at: string
          edit_reason: string | null
          edited_by: string | null
          employee_id: string
          id: string
          kiosk_in_device_id: string | null
          kiosk_out_device_id: string | null
          meal_waived: boolean
          notes: string | null
          organization_id: string
          radio_status: string | null
          radio_status_at: string | null
          route_id: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          source_in: string
          source_out: string | null
          status: Database["public"]["Enums"]["shift_status"]
          tablet_id: string | null
          updated_at: string
          vehicle_id: string | null
          work_date: string
        }
        SetofOptions: {
          from: "*"
          to: "shifts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      kiosk_device: { Args: { p_token_hash: string }; Returns: Json }
      kiosk_end_break: {
        Args: { p_device_id: string; p_employee_id: string }
        Returns: {
          created_at: string
          employee_id: string
          ended_at: string | null
          id: string
          kind: Database["public"]["Enums"]["break_kind"]
          missed_alerted_at: string | null
          organization_id: string
          overrun_alerted_at: string | null
          paid: boolean
          planned_minutes: number
          reminder_sent_at: string | null
          reopened_at: string | null
          reopened_by: string | null
          sequence: number
          shift_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["break_status"]
          updated_at: string
          window_end: string | null
          window_start: string | null
        }
        SetofOptions: {
          from: "*"
          to: "breaks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      kiosk_pair: {
        Args: { p_code_hash: string; p_token_hash: string }
        Returns: Json
      }
      kiosk_start_break: {
        Args: {
          p_device_id: string
          p_employee_id: string
          p_kind: Database["public"]["Enums"]["break_kind"]
        }
        Returns: {
          created_at: string
          employee_id: string
          ended_at: string | null
          id: string
          kind: Database["public"]["Enums"]["break_kind"]
          missed_alerted_at: string | null
          organization_id: string
          overrun_alerted_at: string | null
          paid: boolean
          planned_minutes: number
          reminder_sent_at: string | null
          reopened_at: string | null
          reopened_by: string | null
          sequence: number
          shift_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["break_status"]
          updated_at: string
          window_end: string | null
          window_start: string | null
        }
        SetofOptions: {
          from: "*"
          to: "breaks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      kiosk_verify_pin: {
        Args: { p_device_id: string; p_employee_number: string; p_pin: string }
        Returns: Json
      }
      lock_pay_period: {
        Args: { p_lines: Json; p_period_id: string }
        Returns: number
      }
      record_position: {
        Args: {
          p_accuracy_m?: number
          p_heading?: number
          p_lat: number
          p_lng: number
          p_speed_mps?: number
        }
        Returns: boolean
      }
      reopen_break: {
        Args: { p_break_id: string }
        Returns: {
          created_at: string
          employee_id: string
          ended_at: string | null
          id: string
          kind: Database["public"]["Enums"]["break_kind"]
          missed_alerted_at: string | null
          organization_id: string
          overrun_alerted_at: string | null
          paid: boolean
          planned_minutes: number
          reminder_sent_at: string | null
          reopened_at: string | null
          reopened_by: string | null
          sequence: number
          shift_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["break_status"]
          updated_at: string
          window_end: string | null
          window_start: string | null
        }
        SetofOptions: {
          from: "*"
          to: "breaks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_form: {
        Args: {
          p_comment: string
          p_decision: string
          p_form_id: string
          p_leave_hours?: number
          p_leave_kind?: string
        }
        Returns: {
          acknowledged_at: string | null
          created_at: string
          employee_id: string
          form_type: string
          id: string
          organization_id: string
          payload: Json
          reviewed_at: string | null
          reviewer_comment: string | null
          reviewer_id: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "form_submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      safety_sign_in: { Args: { p_meeting_id: string }; Returns: string }
      set_employee_pin: {
        Args: { p_employee_id: string; p_pin: string }
        Returns: undefined
      }
      set_radio_status: { Args: { p_code: string }; Returns: Json }
      start_break: {
        Args: { p_kind: Database["public"]["Enums"]["break_kind"] }
        Returns: {
          created_at: string
          employee_id: string
          ended_at: string | null
          id: string
          kind: Database["public"]["Enums"]["break_kind"]
          missed_alerted_at: string | null
          organization_id: string
          overrun_alerted_at: string | null
          paid: boolean
          planned_minutes: number
          reminder_sent_at: string | null
          reopened_at: string | null
          reopened_by: string | null
          sequence: number
          shift_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["break_status"]
          updated_at: string
          window_end: string | null
          window_start: string | null
        }
        SetofOptions: {
          from: "*"
          to: "breaks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_bid_preferences: {
        Args: { p_cycle_id: string; p_line_ids: string[] }
        Returns: undefined
      }
      submit_count_sheet: { Args: { p_sheet_id: string }; Returns: undefined }
      submit_end_of_shift: {
        Args: {
          p_condition: string
          p_energy_level: number
          p_notes: string
          p_odometer: number
        }
        Returns: Json
      }
      submit_inspection: { Args: { p_inspection_id: string }; Returns: Json }
      unlock_pay_period: { Args: { p_period_id: string }; Returns: undefined }
    }
    Enums: {
      app_role:
        | "admin"
        | "supervisor"
        | "dispatcher"
        | "coordinator"
        | "driver"
        | "fueler"
        | "technician"
      break_kind: "rest" | "meal"
      break_status:
        | "planned"
        | "active"
        | "completed"
        | "missed"
        | "overrun"
        | "waived"
      employee_status: "active" | "on_leave" | "terminated"
      shift_status: "active" | "completed" | "void"
      vehicle_status:
        | "ready"
        | "in_service"
        | "charging"
        | "needs_fuel"
        | "needs_wash"
        | "needs_fuel_wash"
        | "pmi"
        | "shop"
        | "repair"
        | "safety_hold"
        | "training"
        | "retired"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
        "admin",
        "supervisor",
        "dispatcher",
        "coordinator",
        "driver",
        "fueler",
        "technician",
      ],
      break_kind: ["rest", "meal"],
      break_status: [
        "planned",
        "active",
        "completed",
        "missed",
        "overrun",
        "waived",
      ],
      employee_status: ["active", "on_leave", "terminated"],
      shift_status: ["active", "completed", "void"],
      vehicle_status: [
        "ready",
        "in_service",
        "charging",
        "needs_fuel",
        "needs_wash",
        "needs_fuel_wash",
        "pmi",
        "shop",
        "repair",
        "safety_hold",
        "training",
        "retired",
      ],
    },
  },
} as const
