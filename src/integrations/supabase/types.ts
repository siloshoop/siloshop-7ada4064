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
      activity_logs: {
        Row: {
          action_details: Json | null
          action_type: string
          created_at: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action_details?: Json | null
          action_type: string
          created_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action_details?: Json | null
          action_type?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ad_analytics: {
        Row: {
          ad_slot: string
          created_at: string
          event_type: string
          id: string
          page_url: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          ad_slot: string
          created_at?: string
          event_type?: string
          id?: string
          page_url?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          ad_slot?: string
          created_at?: string
          event_type?: string
          id?: string
          page_url?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          reason: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          created_at: string
          end_date: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          sort_order: number | null
          start_date: string | null
          text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          start_date?: string | null
          text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          start_date?: string | null
          text?: string
          updated_at?: string
        }
        Relationships: []
      }
      auth_email_checks: {
        Row: {
          created_at: string
          email_hash: string
          id: string
        }
        Insert: {
          created_at?: string
          email_hash: string
          id?: string
        }
        Update: {
          created_at?: string
          email_hash?: string
          id?: string
        }
        Relationships: []
      }
      brand_followers: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_followers_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          banner_url: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          name_ar: string
          seo_description: string | null
          seo_keywords: string | null
          seo_title: string | null
          slug: string | null
          sort_order: number
          updated_at: string
          website_url: string | null
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          name_ar: string
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          slug?: string | null
          sort_order?: number
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          name_ar?: string
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          slug?: string | null
          sort_order?: number
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          quantity: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          quantity?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          banner_url: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          name_ar: string
          parent_id: string | null
          seo_description: string | null
          seo_keywords: string | null
          seo_title: string | null
          slug: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          name_ar: string
          parent_id?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          slug?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          name_ar?: string
          parent_id?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          slug?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          conversation_id: string | null
          created_at: string
          id: string
          message_id: string | null
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          metadata?: Json
        }
        Relationships: []
      }
      chat_moderation_log: {
        Row: {
          action: string
          conversation_id: string | null
          created_at: string
          id: string
          message_id: string | null
          metadata: Json
          performed_by: string
          performed_by_role: string | null
          reason: string | null
        }
        Insert: {
          action: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          metadata?: Json
          performed_by: string
          performed_by_role?: string | null
          reason?: string | null
        }
        Update: {
          action?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          metadata?: Json
          performed_by?: string
          performed_by_role?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_moderation_log_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_moderation_log_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      compare_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compare_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          is_read: boolean
          message: string
          name: string
          phone: string
          subject: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_read?: boolean
          message: string
          name: string
          phone: string
          subject: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_read?: boolean
          message?: string
          name?: string
          phone?: string
          subject?: string
        }
        Relationships: []
      }
      contact_rate_limits: {
        Row: {
          created_at: string
          email_hash: string
          id: string
          ip_hash: string
        }
        Insert: {
          created_at?: string
          email_hash: string
          id?: string
          ip_hash: string
        }
        Update: {
          created_at?: string
          email_hash?: string
          id?: string
          ip_hash?: string
        }
        Relationships: []
      }
      content_pages: {
        Row: {
          body: string
          created_at: string
          id: string
          is_published: boolean
          slug: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          is_published?: boolean
          slug: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_published?: boolean
          slug?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          is_archived: boolean
          is_muted: boolean
          joined_at: string
          last_read_at: string | null
          last_seen_at: string | null
          role: string
          unread_count: number
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_archived?: boolean
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string | null
          last_seen_at?: string | null
          role?: string
          unread_count?: number
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_archived?: boolean
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string | null
          last_seen_at?: string | null
          role?: string
          unread_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          admin_id: string | null
          admin_joined_at: string | null
          context_type: string
          created_at: string
          customer_id: string
          id: string
          is_blocked: boolean
          is_suspended: boolean
          last_message_at: string | null
          last_message_preview: string | null
          last_message_sender_id: string | null
          moderated_at: string | null
          moderated_by: string | null
          moderation_reason: string | null
          order_id: string | null
          product_id: string | null
          return_id: string | null
          subject: string | null
          suspended_until: string | null
          vendor_id: string
        }
        Insert: {
          admin_id?: string | null
          admin_joined_at?: string | null
          context_type?: string
          created_at?: string
          customer_id: string
          id?: string
          is_blocked?: boolean
          is_suspended?: boolean
          last_message_at?: string | null
          last_message_preview?: string | null
          last_message_sender_id?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          order_id?: string | null
          product_id?: string | null
          return_id?: string | null
          subject?: string | null
          suspended_until?: string | null
          vendor_id: string
        }
        Update: {
          admin_id?: string | null
          admin_joined_at?: string | null
          context_type?: string
          created_at?: string
          customer_id?: string
          id?: string
          is_blocked?: boolean
          is_suspended?: boolean
          last_message_at?: string | null
          last_message_preview?: string | null
          last_message_sender_id?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          order_id?: string | null
          product_id?: string | null
          return_id?: string | null
          subject?: string | null
          suspended_until?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          min_purchase: number | null
          updated_at: string
          used_count: number
          vendor_id: string
        }
        Insert: {
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_purchase?: number | null
          updated_at?: string
          used_count?: number
          vendor_id: string
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_purchase?: number | null
          updated_at?: string
          used_count?: number
          vendor_id?: string
        }
        Relationships: []
      }
      daily_deals: {
        Row: {
          created_at: string
          discount_percentage: number
          end_date: string
          id: string
          is_active: boolean
          product_id: string
          start_date: string
        }
        Insert: {
          created_at?: string
          discount_percentage: number
          end_date: string
          id?: string
          is_active?: boolean
          product_id: string
          start_date?: string
        }
        Update: {
          created_at?: string
          discount_percentage?: number
          end_date?: string
          id?: string
          is_active?: boolean
          product_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_deals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_addresses: {
        Row: {
          apartment: string | null
          building: string | null
          city: string
          created_at: string
          governorate: string | null
          id: string
          is_default: boolean
          label: string
          landmark: string | null
          notes: string | null
          phone: string
          recipient_name: string
          street: string
          updated_at: string
          user_id: string
        }
        Insert: {
          apartment?: string | null
          building?: string | null
          city: string
          created_at?: string
          governorate?: string | null
          id?: string
          is_default?: boolean
          label: string
          landmark?: string | null
          notes?: string | null
          phone: string
          recipient_name: string
          street: string
          updated_at?: string
          user_id: string
        }
        Update: {
          apartment?: string | null
          building?: string | null
          city?: string
          created_at?: string
          governorate?: string | null
          id?: string
          is_default?: boolean
          label?: string
          landmark?: string | null
          notes?: string | null
          phone?: string
          recipient_name?: string
          street?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      delivery_ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          order_id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      faq_items: {
        Row: {
          answer: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          question: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer: string
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          question: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          question?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          key: string
          label_ar: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          key: string
          label_ar: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          key?: string
          label_ar?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      message_attachments: {
        Row: {
          conversation_id: string
          created_at: string
          file_name: string
          height: number | null
          id: string
          kind: string
          message_id: string
          mime_type: string
          size_bytes: number
          storage_path: string
          uploaded_by: string
          width: number | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          file_name: string
          height?: number | null
          id?: string
          kind?: string
          message_id: string
          mime_type: string
          size_bytes?: number
          storage_path: string
          uploaded_by: string
          width?: number | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          file_name?: string
          height?: number | null
          id?: string
          kind?: string
          message_id?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_status: {
        Row: {
          conversation_id: string
          delivered_at: string
          id: string
          message_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          delivered_at?: string
          id?: string
          message_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          delivered_at?: string
          id?: string
          message_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_status_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_status_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          deleted_by_sender: boolean
          delivered_at: string | null
          edit_count: number
          edited_at: string | null
          file_name: string | null
          file_url: string | null
          forwarded_from_id: string | null
          id: string
          is_deleted: boolean
          is_pinned: boolean
          is_read: boolean
          message_type: string
          metadata: Json
          pinned_at: string | null
          pinned_by: string | null
          read_at: string | null
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_by_sender?: boolean
          delivered_at?: string | null
          edit_count?: number
          edited_at?: string | null
          file_name?: string | null
          file_url?: string | null
          forwarded_from_id?: string | null
          id?: string
          is_deleted?: boolean
          is_pinned?: boolean
          is_read?: boolean
          message_type?: string
          metadata?: Json
          pinned_at?: string | null
          pinned_by?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_by_sender?: boolean
          delivered_at?: string | null
          edit_count?: number
          edited_at?: string | null
          file_name?: string | null
          file_url?: string | null
          forwarded_from_id?: string | null
          id?: string
          is_deleted?: boolean
          is_pinned?: boolean
          is_read?: boolean
          message_type?: string
          metadata?: Json
          pinned_at?: string | null
          pinned_by?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      native_ads: {
        Row: {
          created_at: string
          created_by: string | null
          cta_text: string
          cta_url: string | null
          description: string | null
          end_date: string | null
          id: string
          image_url: string | null
          is_active: boolean
          placement: string
          priority: number
          sponsor_name: string
          start_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cta_text?: string
          cta_url?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          placement?: string
          priority?: number
          sponsor_name?: string
          start_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cta_text?: string
          cta_url?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          placement?: string
          priority?: number
          sponsor_name?: string
          start_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      newsletter_subscriptions: {
        Row: {
          email: string
          id: string
          is_active: boolean | null
          subscribed_at: string | null
        }
        Insert: {
          email: string
          id?: string
          is_active?: boolean | null
          subscribed_at?: string | null
        }
        Update: {
          email?: string
          id?: string
          is_active?: boolean | null
          subscribed_at?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          daily_deals: boolean
          id: string
          new_products: boolean
          newsletter: boolean
          order_updates: boolean
          price_drops: boolean
          promotions: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_deals?: boolean
          id?: string
          new_products?: boolean
          newsletter?: boolean
          order_updates?: boolean
          price_drops?: boolean
          promotions?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_deals?: boolean
          id?: string
          new_products?: boolean
          newsletter?: boolean
          order_updates?: boolean
          price_drops?: boolean
          promotions?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          related_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          related_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          related_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string | null
          discount_amount: number
          id: string
          order_id: string
          price: number
          product_id: string
          product_image: string | null
          product_name: string | null
          quantity: number
          shipping_duration_text: string | null
          subtotal: number | null
          variant_id: string | null
          variant_label: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string | null
          discount_amount?: number
          id?: string
          order_id: string
          price: number
          product_id: string
          product_image?: string | null
          product_name?: string | null
          quantity: number
          shipping_duration_text?: string | null
          subtotal?: number | null
          variant_id?: string | null
          variant_label?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string | null
          discount_amount?: number
          id?: string
          order_id?: string
          price?: number
          product_id?: string
          product_image?: string | null
          product_name?: string | null
          quantity?: number
          shipping_duration_text?: string | null
          subtotal?: number | null
          variant_id?: string | null
          variant_label?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notes: {
        Row: {
          author_id: string | null
          author_role: string
          created_at: string
          id: string
          is_internal: boolean
          note: string
          order_id: string
        }
        Insert: {
          author_id?: string | null
          author_role: string
          created_at?: string
          id?: string
          is_internal?: boolean
          note: string
          order_id: string
        }
        Update: {
          author_id?: string | null
          author_role?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          note?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          changed_by_role: string | null
          created_at: string
          from_status: string | null
          id: string
          ip_address: string | null
          is_override: boolean
          location_lat: number | null
          location_lng: number | null
          notes: string | null
          order_id: string
          status: string
          user_agent: string | null
        }
        Insert: {
          changed_by?: string | null
          changed_by_role?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          ip_address?: string | null
          is_override?: boolean
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          order_id: string
          status: string
          user_agent?: string | null
        }
        Update: {
          changed_by?: string | null
          changed_by_role?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          ip_address?: string | null
          is_override?: boolean
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          order_id?: string
          status?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_track_rate_limits: {
        Row: {
          client_hash: string
          created_at: string
          id: string
        }
        Insert: {
          client_hash: string
          created_at?: string
          id?: string
        }
        Update: {
          client_hash?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cancelled_by_role: string | null
          completed_at: string | null
          confirmed_at: string | null
          coupon_code: string | null
          courier_name: string | null
          created_at: string | null
          current_location_lat: number | null
          current_location_lng: number | null
          customer_id: string
          delivered_at: string | null
          delivery_lat: number | null
          delivery_lng: number | null
          delivery_notes: string | null
          discount_amount: number | null
          driver_name: string | null
          driver_phone: string | null
          estimated_delivery: string | null
          frozen_at: string | null
          frozen_by: string | null
          frozen_reason: string | null
          id: string
          invoice_number: string | null
          is_frozen: boolean
          notes: string | null
          order_kind: string
          order_number: string | null
          parent_order_id: string | null
          payment_method: string
          payment_status: string
          phone: string | null
          refund_status: string
          shipped_at: string | null
          shipping_address: string | null
          shipping_amount: number
          shipping_duration_text: string | null
          shipping_notes: string | null
          status: string | null
          subtotal_amount: number
          tax_amount: number
          total_amount: number
          tracking_number: string | null
          tracking_status: string | null
          updated_at: string | null
          vendor_id: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_by_role?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          coupon_code?: string | null
          courier_name?: string | null
          created_at?: string | null
          current_location_lat?: number | null
          current_location_lng?: number | null
          customer_id: string
          delivered_at?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_notes?: string | null
          discount_amount?: number | null
          driver_name?: string | null
          driver_phone?: string | null
          estimated_delivery?: string | null
          frozen_at?: string | null
          frozen_by?: string | null
          frozen_reason?: string | null
          id?: string
          invoice_number?: string | null
          is_frozen?: boolean
          notes?: string | null
          order_kind?: string
          order_number?: string | null
          parent_order_id?: string | null
          payment_method?: string
          payment_status?: string
          phone?: string | null
          refund_status?: string
          shipped_at?: string | null
          shipping_address?: string | null
          shipping_amount?: number
          shipping_duration_text?: string | null
          shipping_notes?: string | null
          status?: string | null
          subtotal_amount?: number
          tax_amount?: number
          total_amount: number
          tracking_number?: string | null
          tracking_status?: string | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_by_role?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          coupon_code?: string | null
          courier_name?: string | null
          created_at?: string | null
          current_location_lat?: number | null
          current_location_lng?: number | null
          customer_id?: string
          delivered_at?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_notes?: string | null
          discount_amount?: number | null
          driver_name?: string | null
          driver_phone?: string | null
          estimated_delivery?: string | null
          frozen_at?: string | null
          frozen_by?: string | null
          frozen_reason?: string | null
          id?: string
          invoice_number?: string | null
          is_frozen?: boolean
          notes?: string | null
          order_kind?: string
          order_number?: string | null
          parent_order_id?: string | null
          payment_method?: string
          payment_status?: string
          phone?: string | null
          refund_status?: string
          shipped_at?: string | null
          shipping_address?: string | null
          shipping_amount?: number
          shipping_duration_text?: string | null
          shipping_notes?: string | null
          status?: string | null
          subtotal_amount?: number
          tax_amount?: number
          total_amount?: number
          tracking_number?: string | null
          tracking_status?: string | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_parent_order_id_fkey"
            columns: ["parent_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          order_id: string
          provider: string
          provider_payload: Json
          provider_reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          order_id: string
          provider?: string
          provider_payload?: Json
          provider_reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          order_id?: string
          provider?: string
          provider_payload?: Json
          provider_reference?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_id: string | null
          event_type: string | null
          id: string
          payload: Json
          processed: boolean
          provider: string
          signature_valid: boolean
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          event_type?: string | null
          id?: string
          payload?: Json
          processed?: boolean
          provider?: string
          signature_valid?: boolean
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          event_type?: string | null
          id?: string
          payload?: Json
          processed?: boolean
          provider?: string
          signature_valid?: boolean
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          order_id: string
          payment_details: Json | null
          payment_method: string
          payment_status: string
          provider_reference: string | null
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          order_id: string
          payment_details?: Json | null
          payment_method: string
          payment_status?: string
          provider_reference?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          order_id?: string
          payment_details?: Json | null
          payment_method?: string
          payment_status?: string
          provider_reference?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_requests: {
        Row: {
          amount: number
          created_at: string
          details: string | null
          id: string
          method: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          details?: string | null
          id?: string
          method: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          details?: string | null
          id?: string
          method?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: []
      }
      platform_payment_settings: {
        Row: {
          cod_enabled: boolean
          id: number
          instructions: string
          is_active: boolean
          sham_cash_account_name: string
          sham_cash_account_number: string
          sham_cash_enabled: boolean
          updated_at: string
        }
        Insert: {
          cod_enabled?: boolean
          id?: number
          instructions?: string
          is_active?: boolean
          sham_cash_account_name?: string
          sham_cash_account_number?: string
          sham_cash_enabled?: boolean
          updated_at?: string
        }
        Update: {
          cod_enabled?: boolean
          id?: number
          instructions?: string
          is_active?: boolean
          sham_cash_account_name?: string
          sham_cash_account_number?: string
          sham_cash_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          id: number
          maintenance_message: string | null
          maintenance_mode: boolean
          min_order_amount: number
          return_window_days: number
          returns_replacement_enabled: boolean
          store_name: string
          support_email: string | null
          support_phone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          maintenance_message?: string | null
          maintenance_mode?: boolean
          min_order_amount?: number
          return_window_days?: number
          returns_replacement_enabled?: boolean
          store_name?: string
          support_email?: string | null
          support_phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          maintenance_message?: string | null
          maintenance_mode?: boolean
          min_order_amount?: number
          return_window_days?: number
          returns_replacement_enabled?: boolean
          store_name?: string
          support_email?: string | null
          support_phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      product_attribute_values: {
        Row: {
          attribute_id: string
          created_at: string
          id: string
          meta: Json
          sort_order: number
          value: string
          value_ar: string
        }
        Insert: {
          attribute_id: string
          created_at?: string
          id?: string
          meta?: Json
          sort_order?: number
          value: string
          value_ar: string
        }
        Update: {
          attribute_id?: string
          created_at?: string
          id?: string
          meta?: Json
          sort_order?: number
          value?: string
          value_ar?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_attribute_values_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "product_attributes"
            referencedColumns: ["id"]
          },
        ]
      }
      product_attributes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          input_type: string
          is_active: boolean
          name: string
          name_ar: string
          sort_order: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          input_type?: string
          is_active?: boolean
          name: string
          name_ar: string
          sort_order?: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          input_type?: string
          is_active?: boolean
          name?: string
          name_ar?: string
          sort_order?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_moderation_log: {
        Row: {
          action: string
          created_at: string
          from_status: string | null
          id: string
          performed_by: string
          product_id: string
          reason: string | null
          to_status: string | null
        }
        Insert: {
          action: string
          created_at?: string
          from_status?: string | null
          id?: string
          performed_by: string
          product_id: string
          reason?: string | null
          to_status?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          from_status?: string | null
          id?: string
          performed_by?: string
          product_id?: string
          reason?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_moderation_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_questions: {
        Row: {
          answer: string | null
          answered_at: string | null
          answered_by: string | null
          created_at: string
          id: string
          is_hidden: boolean
          product_id: string
          question: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          answered_by?: string | null
          created_at?: string
          id?: string
          is_hidden?: boolean
          product_id: string
          question: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          answered_by?: string | null
          created_at?: string
          id?: string
          is_hidden?: boolean
          product_id?: string
          question?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_questions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          attributes: Json
          barcode: string | null
          created_at: string
          discount_price: number | null
          id: string
          image_url: string | null
          is_active: boolean
          price: number | null
          product_id: string
          sku: string | null
          sort_order: number
          stock_quantity: number
          updated_at: string
          weight: number | null
        }
        Insert: {
          attributes?: Json
          barcode?: string | null
          created_at?: string
          discount_price?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          price?: number | null
          product_id: string
          sku?: string | null
          sort_order?: number
          stock_quantity?: number
          updated_at?: string
          weight?: number | null
        }
        Update: {
          attributes?: Json
          barcode?: string | null
          created_at?: string
          discount_price?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          price?: number | null
          product_id?: string
          sku?: string | null
          sort_order?: number
          stock_quantity?: number
          updated_at?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          brand_id: string | null
          category_id: string | null
          clicks_count: number
          colors: string[]
          country_of_origin: string | null
          created_at: string | null
          currency: string
          description: string | null
          discount_price: number | null
          external_id: string | null
          gtin: string | null
          height_cm: number | null
          id: string
          image_url: string | null
          images: string[] | null
          is_active: boolean | null
          is_featured: boolean
          is_recommended: boolean
          is_trending: boolean
          length_cm: number | null
          max_order_quantity: number | null
          min_order_quantity: number
          moderated_at: string | null
          moderated_by: string | null
          moderation_reason: string | null
          moderation_reason_code: string | null
          moderation_status: string
          name: string
          name_en: string | null
          original_price: number | null
          price: number
          product_type: string
          return_policy: string | null
          seo_description: string | null
          seo_keywords: string | null
          seo_title: string | null
          shipping_class: string | null
          shipping_cost: number
          shipping_duration_text: string | null
          shipping_weight: number | null
          ships_within_days: number | null
          short_description: string | null
          sizes: string[]
          sku: string | null
          slug: string | null
          source: string
          specs: Json
          stock_quantity: number | null
          subcategory_id: string | null
          tags: string[]
          updated_at: string | null
          vendor_id: string
          video_url: string | null
          views_count: number
          warranty: string | null
          weight: number | null
          width_cm: number | null
        }
        Insert: {
          barcode?: string | null
          brand_id?: string | null
          category_id?: string | null
          clicks_count?: number
          colors?: string[]
          country_of_origin?: string | null
          created_at?: string | null
          currency?: string
          description?: string | null
          discount_price?: number | null
          external_id?: string | null
          gtin?: string | null
          height_cm?: number | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_active?: boolean | null
          is_featured?: boolean
          is_recommended?: boolean
          is_trending?: boolean
          length_cm?: number | null
          max_order_quantity?: number | null
          min_order_quantity?: number
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          moderation_reason_code?: string | null
          moderation_status?: string
          name: string
          name_en?: string | null
          original_price?: number | null
          price: number
          product_type?: string
          return_policy?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          shipping_class?: string | null
          shipping_cost?: number
          shipping_duration_text?: string | null
          shipping_weight?: number | null
          ships_within_days?: number | null
          short_description?: string | null
          sizes?: string[]
          sku?: string | null
          slug?: string | null
          source?: string
          specs?: Json
          stock_quantity?: number | null
          subcategory_id?: string | null
          tags?: string[]
          updated_at?: string | null
          vendor_id: string
          video_url?: string | null
          views_count?: number
          warranty?: string | null
          weight?: number | null
          width_cm?: number | null
        }
        Update: {
          barcode?: string | null
          brand_id?: string | null
          category_id?: string | null
          clicks_count?: number
          colors?: string[]
          country_of_origin?: string | null
          created_at?: string | null
          currency?: string
          description?: string | null
          discount_price?: number | null
          external_id?: string | null
          gtin?: string | null
          height_cm?: number | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_active?: boolean | null
          is_featured?: boolean
          is_recommended?: boolean
          is_trending?: boolean
          length_cm?: number | null
          max_order_quantity?: number | null
          min_order_quantity?: number
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          moderation_reason_code?: string | null
          moderation_status?: string
          name?: string
          name_en?: string | null
          original_price?: number | null
          price?: number
          product_type?: string
          return_policy?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          shipping_class?: string | null
          shipping_cost?: number
          shipping_duration_text?: string | null
          shipping_weight?: number | null
          ships_within_days?: number | null
          short_description?: string | null
          sizes?: string[]
          sku?: string | null
          slug?: string | null
          source?: string
          specs?: Json
          stock_quantity?: number | null
          subcategory_id?: string | null
          tags?: string[]
          updated_at?: string | null
          vendor_id?: string
          video_url?: string | null
          views_count?: number
          warranty?: string | null
          weight?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: string
          avatar_url: string | null
          ban_reason: string | null
          banned_at: string | null
          created_at: string | null
          full_name: string | null
          id: string
          is_banned: boolean
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          status_changed_at: string | null
          status_changed_by: string | null
          status_reason: string | null
          updated_at: string | null
        }
        Insert: {
          account_status?: string
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          is_banned?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status_changed_at?: string | null
          status_changed_by?: string | null
          status_reason?: string | null
          updated_at?: string | null
        }
        Update: {
          account_status?: string
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          is_banned?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status_changed_at?: string | null
          status_changed_by?: string | null
          status_reason?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      push_notifications: {
        Row: {
          body: string
          icon: string | null
          id: string
          recipient_count: number | null
          sent_at: string
          sent_by: string | null
          title: string
          url: string | null
        }
        Insert: {
          body: string
          icon?: string | null
          id?: string
          recipient_count?: number | null
          sent_at?: string
          sent_by?: string | null
          title: string
          url?: string | null
        }
        Update: {
          body?: string
          icon?: string | null
          id?: string
          recipient_count?: number | null
          sent_at?: string
          sent_by?: string | null
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string | null
        }
        Relationships: []
      }
      quantity_discounts: {
        Row: {
          created_at: string | null
          discount_percentage: number
          id: string
          min_quantity: number
          product_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          discount_percentage: number
          id?: string
          min_quantity: number
          product_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          discount_percentage?: number
          id?: string
          min_quantity?: number
          product_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quantity_discounts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      recently_viewed: {
        Row: {
          id: string
          product_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          product_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recently_viewed_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          description: string | null
          id: string
          reason: string
          report_type: Database["public"]["Enums"]["report_type"]
          reporter_id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          reason: string
          report_type: Database["public"]["Enums"]["report_type"]
          reporter_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          reason?: string
          report_type?: Database["public"]["Enums"]["report_type"]
          reporter_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      return_images: {
        Row: {
          created_at: string
          id: string
          kind: string
          return_id: string
          uploaded_by: string | null
          uploader_role: string | null
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          return_id: string
          uploaded_by?: string | null
          uploader_role?: string | null
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          return_id?: string
          uploaded_by?: string | null
          uploader_role?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_images_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
        ]
      }
      return_items: {
        Row: {
          created_at: string
          id: string
          item_note: string | null
          order_item_id: string
          product_id: string | null
          product_image: string | null
          product_name: string | null
          quantity: number
          return_id: string
          unit_price: number
          variant_label: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_note?: string | null
          order_item_id: string
          product_id?: string | null
          product_image?: string | null
          product_name?: string | null
          quantity: number
          return_id: string
          unit_price?: number
          variant_label?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_note?: string | null
          order_item_id?: string
          product_id?: string | null
          product_image?: string | null
          product_name?: string | null
          quantity?: number
          return_id?: string
          unit_price?: number
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "return_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
        ]
      }
      return_messages: {
        Row: {
          attachments: string[]
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          read_at: string | null
          return_id: string
          sender_id: string
          sender_role: string
        }
        Insert: {
          attachments?: string[]
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          read_at?: string | null
          return_id: string
          sender_id: string
          sender_role: string
        }
        Update: {
          attachments?: string[]
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          read_at?: string | null
          return_id?: string
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_messages_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
        ]
      }
      return_notes: {
        Row: {
          author_id: string | null
          author_role: string | null
          created_at: string
          id: string
          is_internal: boolean
          note: string
          return_id: string
        }
        Insert: {
          author_id?: string | null
          author_role?: string | null
          created_at?: string
          id?: string
          is_internal?: boolean
          note: string
          return_id: string
        }
        Update: {
          author_id?: string | null
          author_role?: string | null
          created_at?: string
          id?: string
          is_internal?: boolean
          note?: string
          return_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_notes_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
        ]
      }
      return_reasons: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          label_ar: string
          label_en: string | null
          requires_images: boolean
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          label_ar: string
          label_en?: string | null
          requires_images?: boolean
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label_ar?: string
          label_en?: string | null
          requires_images?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      return_status_history: {
        Row: {
          changed_by: string | null
          changed_by_role: string | null
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          return_id: string
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          changed_by_role?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          return_id: string
          to_status: string
        }
        Update: {
          changed_by?: string | null
          changed_by_role?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          return_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_status_history_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          admin_note: string | null
          arrival_date: string | null
          assigned_staff_id: string | null
          carrier: string | null
          closed_at: string | null
          created_at: string
          customer_id: string
          description: string | null
          id: string
          images: string[]
          inspection_at: string | null
          inspection_note: string | null
          inspection_result: string | null
          is_replacement: boolean
          last_actor_role: string | null
          notes: string | null
          order_id: string
          order_item_id: string | null
          reason: string
          received_at: string | null
          refund_amount: number | null
          refund_method: string
          rejection_reason: string | null
          replacement_order_id: string | null
          resolution_type: string
          resolved_at: string | null
          return_address: string | null
          return_instructions: string | null
          return_number: string | null
          return_window_days: number
          review_note: string | null
          shipped_at: string | null
          status: string
          tracking_number: string | null
          updated_at: string
          vendor_id: string
          video_url: string | null
        }
        Insert: {
          admin_note?: string | null
          arrival_date?: string | null
          assigned_staff_id?: string | null
          carrier?: string | null
          closed_at?: string | null
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          images?: string[]
          inspection_at?: string | null
          inspection_note?: string | null
          inspection_result?: string | null
          is_replacement?: boolean
          last_actor_role?: string | null
          notes?: string | null
          order_id: string
          order_item_id?: string | null
          reason: string
          received_at?: string | null
          refund_amount?: number | null
          refund_method?: string
          rejection_reason?: string | null
          replacement_order_id?: string | null
          resolution_type?: string
          resolved_at?: string | null
          return_address?: string | null
          return_instructions?: string | null
          return_number?: string | null
          return_window_days?: number
          review_note?: string | null
          shipped_at?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
          vendor_id: string
          video_url?: string | null
        }
        Update: {
          admin_note?: string | null
          arrival_date?: string | null
          assigned_staff_id?: string | null
          carrier?: string | null
          closed_at?: string | null
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          images?: string[]
          inspection_at?: string | null
          inspection_note?: string | null
          inspection_result?: string | null
          is_replacement?: boolean
          last_actor_role?: string | null
          notes?: string | null
          order_id?: string
          order_item_id?: string | null
          reason?: string
          received_at?: string | null
          refund_amount?: number | null
          refund_method?: string
          rejection_reason?: string | null
          replacement_order_id?: string | null
          resolution_type?: string
          resolved_at?: string | null
          return_address?: string | null
          return_instructions?: string | null
          return_number?: string | null
          return_window_days?: number
          review_note?: string | null
          shipped_at?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
          vendor_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      review_helpful_votes: {
        Row: {
          created_at: string
          id: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_helpful_votes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_replies: {
        Row: {
          created_at: string
          id: string
          reply: string
          review_id: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reply: string
          review_id: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reply?: string
          review_id?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_replies_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          hidden_at: string | null
          hidden_by: string | null
          hidden_reason: string | null
          id: string
          image_url: string | null
          is_hidden: boolean
          product_id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          hidden_at?: string | null
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string
          image_url?: string | null
          is_hidden?: boolean
          product_id: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          hidden_at?: string | null
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string
          image_url?: string | null
          is_hidden?: boolean
          product_id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_comparisons: {
        Row: {
          created_at: string
          id: string
          name: string
          product_ids: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          product_ids: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          product_ids?: string[]
          user_id?: string
        }
        Relationships: []
      }
      saved_for_later: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_for_later_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      search_history: {
        Row: {
          id: string
          searched_at: string
          term: string
          user_id: string
        }
        Insert: {
          id?: string
          searched_at?: string
          term: string
          user_id: string
        }
        Update: {
          id?: string
          searched_at?: string
          term?: string
          user_id?: string
        }
        Relationships: []
      }
      seller_applications: {
        Row: {
          address: string | null
          business_document_url: string | null
          business_info: string | null
          city: string | null
          contact_email: string | null
          contact_phone: string | null
          cover_image_url: string | null
          created_at: string
          governorate: string | null
          id: string
          identity_document_url: string | null
          logo_url: string | null
          owner_name: string | null
          rejection_reason: string | null
          return_policy: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          shipping_policy: string | null
          status: Database["public"]["Enums"]["seller_status"]
          store_description: string | null
          store_name: string | null
          submitted_at: string | null
          updated_at: string
          user_id: string
          working_hours: string | null
        }
        Insert: {
          address?: string | null
          business_document_url?: string | null
          business_info?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          cover_image_url?: string | null
          created_at?: string
          governorate?: string | null
          id?: string
          identity_document_url?: string | null
          logo_url?: string | null
          owner_name?: string | null
          rejection_reason?: string | null
          return_policy?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shipping_policy?: string | null
          status?: Database["public"]["Enums"]["seller_status"]
          store_description?: string | null
          store_name?: string | null
          submitted_at?: string | null
          updated_at?: string
          user_id: string
          working_hours?: string | null
        }
        Update: {
          address?: string | null
          business_document_url?: string | null
          business_info?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          cover_image_url?: string | null
          created_at?: string
          governorate?: string | null
          id?: string
          identity_document_url?: string | null
          logo_url?: string | null
          owner_name?: string | null
          rejection_reason?: string | null
          return_policy?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shipping_policy?: string | null
          status?: Database["public"]["Enums"]["seller_status"]
          store_description?: string | null
          store_name?: string | null
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
          working_hours?: string | null
        }
        Relationships: []
      }
      seller_violations: {
        Row: {
          created_at: string
          id: string
          issued_by: string | null
          reason: string | null
          reason_code: string
          related_id: string | null
          related_type: string | null
          revoked_at: string | null
          revoked_by: string | null
          severity: string
          status: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          issued_by?: string | null
          reason?: string | null
          reason_code: string
          related_id?: string | null
          related_type?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          issued_by?: string | null
          reason?: string | null
          reason_code?: string
          related_id?: string | null
          related_type?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: []
      }
      sham_cash_merchant_config: {
        Row: {
          api_base_url: string | null
          callback_url: string | null
          created_at: string
          environment: string
          id: number
          is_active: boolean
          merchant_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_base_url?: string | null
          callback_url?: string | null
          created_at?: string
          environment?: string
          id?: number
          is_active?: boolean
          merchant_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_base_url?: string | null
          callback_url?: string | null
          created_at?: string
          environment?: string
          id?: number
          is_active?: boolean
          merchant_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      shipping_details: {
        Row: {
          created_at: string
          delivered_at: string | null
          estimated_delivery: string | null
          id: string
          order_id: string
          shipped_at: string | null
          shipping_company: string | null
          shipping_notes: string | null
          tracking_number: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          estimated_delivery?: string | null
          id?: string
          order_id: string
          shipped_at?: string | null
          shipping_company?: string | null
          shipping_notes?: string | null
          tracking_number?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          estimated_delivery?: string | null
          id?: string
          order_id?: string
          shipped_at?: string | null
          shipping_company?: string | null
          shipping_notes?: string | null
          tracking_number?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_details_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      showroom_audit_log: {
        Row: {
          action: string
          changed_fields: string[]
          created_at: string
          id: string
          item_title: string | null
          new_values: Json | null
          old_values: Json | null
          performed_by: string | null
          performed_by_role: string | null
          showroom_item_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: string[]
          created_at?: string
          id?: string
          item_title?: string | null
          new_values?: Json | null
          old_values?: Json | null
          performed_by?: string | null
          performed_by_role?: string | null
          showroom_item_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: string[]
          created_at?: string
          id?: string
          item_title?: string | null
          new_values?: Json | null
          old_values?: Json | null
          performed_by?: string | null
          performed_by_role?: string | null
          showroom_item_id?: string | null
        }
        Relationships: []
      }
      showroom_items: {
        Row: {
          badge_label: string | null
          campaign_type: string
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          display_order: number
          end_date: string | null
          id: string
          is_active: boolean
          is_pinned: boolean
          is_verified: boolean
          item_type: string
          link_url: string | null
          logo_url: string | null
          priority: number
          product_id: string | null
          rating: number | null
          settings: Json
          sponsor_name: string | null
          start_date: string | null
          subtitle: string | null
          title: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          badge_label?: string | null
          campaign_type?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number
          end_date?: string | null
          id?: string
          is_active?: boolean
          is_pinned?: boolean
          is_verified?: boolean
          item_type: string
          link_url?: string | null
          logo_url?: string | null
          priority?: number
          product_id?: string | null
          rating?: number | null
          settings?: Json
          sponsor_name?: string | null
          start_date?: string | null
          subtitle?: string | null
          title: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          badge_label?: string | null
          campaign_type?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number
          end_date?: string | null
          id?: string
          is_active?: boolean
          is_pinned?: boolean
          is_verified?: boolean
          item_type?: string
          link_url?: string | null
          logo_url?: string | null
          priority?: number
          product_id?: string | null
          rating?: number | null
          settings?: Json
          sponsor_name?: string | null
          start_date?: string | null
          subtitle?: string | null
          title?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          delta: number
          id: string
          note: string | null
          performed_by: string | null
          product_id: string
          quantity_after: number | null
          quantity_before: number | null
          reason: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          note?: string | null
          performed_by?: string | null
          product_id: string
          quantity_after?: number | null
          quantity_before?: number | null
          reason?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          note?: string | null
          performed_by?: string | null
          product_id?: string
          quantity_after?: number | null
          quantity_before?: number | null
          reason?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategories: {
        Row: {
          banner_url: string | null
          category_id: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name_ar: string
          name_en: string | null
          parent_subcategory_id: string | null
          seo_description: string | null
          seo_keywords: string | null
          seo_title: string | null
          slug: string | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          category_id: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name_ar: string
          name_en?: string | null
          parent_subcategory_id?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          slug?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          category_id?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name_ar?: string
          name_en?: string | null
          parent_subcategory_id?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          slug?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcategories_parent_subcategory_id_fkey"
            columns: ["parent_subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tracking_history: {
        Row: {
          actor_role: string | null
          created_at: string
          description: string | null
          id: string
          location: string | null
          order_id: string
          status: string
        }
        Insert: {
          actor_role?: string | null
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          order_id: string
          status: string
        }
        Update: {
          actor_role?: string | null
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_followers: {
        Row: {
          created_at: string
          id: string
          user_id: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          vendor_id?: string
        }
        Relationships: []
      }
      vendor_ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          updated_at: string
          user_id: string
          vendor_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          updated_at?: string
          user_id: string
          vendor_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          updated_at?: string
          user_id?: string
          vendor_id?: string
        }
        Relationships: []
      }
      wishlist_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          wishlist_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          wishlist_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          wishlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_wishlist_id_fkey"
            columns: ["wishlist_id"]
            isOneToOne: false
            referencedRelation: "wishlists"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlists: {
        Row: {
          created_at: string
          id: string
          is_public: boolean
          name: string
          share_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_public?: boolean
          name?: string
          share_token?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_public?: boolean
          name?: string
          share_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      actor_admin_role: { Args: { _user_id: string }; Returns: string }
      add_order_note: {
        Args: { _is_internal?: boolean; _note: string; _order_id: string }
        Returns: string
      }
      admin_activate_user: { Args: { _user_id: string }; Returns: undefined }
      admin_assign_return_staff: {
        Args: { _return_id: string; _staff_id: string }
        Returns: undefined
      }
      admin_ban_user: {
        Args: { _reason: string; _user_id: string }
        Returns: undefined
      }
      admin_block_conversation: {
        Args: { _block?: boolean; _conversation_id: string; _reason: string }
        Returns: undefined
      }
      admin_broadcast_chat_announcement: {
        Args: { p_conversation_ids?: string[]; p_message: string }
        Returns: number
      }
      admin_cancel_order: {
        Args: { _order_id: string; _reason: string }
        Returns: undefined
      }
      admin_dashboard_overview: { Args: { _days?: number }; Returns: Json }
      admin_delete_message:
        | { Args: { _message_id: string }; Returns: undefined }
        | {
            Args: { _message_id: string; _reason?: string }
            Returns: undefined
          }
      admin_get_analytics: { Args: { _days?: number }; Returns: Json }
      admin_get_conversation_messages: {
        Args: { _conversation_id: string }
        Returns: {
          content: string
          conversation_id: string
          created_at: string
          deleted_at: string
          deleted_by: string
          file_name: string
          file_url: string
          id: string
          is_deleted: boolean
          message_type: string
          report_count: number
          sender_id: string
          sender_name: string
        }[]
      }
      admin_get_order_detail: { Args: { _order_id: string }; Returns: Json }
      admin_hide_review: {
        Args: { _reason: string; _review_id: string }
        Returns: undefined
      }
      admin_inventory_overview: {
        Args: { _limit?: number; _threshold?: number }
        Returns: {
          id: string
          image_url: string
          is_active: boolean
          moderation_status: string
          name: string
          price: number
          stock_quantity: number
          updated_at: string
          vendor_id: string
          vendor_name: string
        }[]
      }
      admin_issue_violation: {
        Args: {
          _reason?: string
          _reason_code: string
          _related_id?: string
          _related_type?: string
          _severity: string
          _vendor_id: string
        }
        Returns: string
      }
      admin_join_conversation: {
        Args: { p_conversation_id: string; p_note?: string }
        Returns: undefined
      }
      admin_list_conversations: {
        Args: {
          _filter?: string
          _limit?: number
          _offset?: number
          _search?: string
        }
        Returns: {
          created_at: string
          customer_id: string
          customer_name: string
          id: string
          is_blocked: boolean
          is_suspended: boolean
          last_message: string
          last_message_at: string
          message_count: number
          moderation_reason: string
          product_id: string
          reported_count: number
          suspended_until: string
          vendor_id: string
          vendor_name: string
        }[]
      }
      admin_list_coupons: {
        Args: { _limit?: number; _search?: string }
        Returns: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string
          id: string
          is_active: boolean
          max_uses: number
          min_purchase: number
          used_count: number
          vendor_id: string
          vendor_name: string
        }[]
      }
      admin_list_orders: {
        Args: {
          _from?: string
          _limit?: number
          _offset?: number
          _payment_status?: string
          _search?: string
          _status?: string
          _to?: string
        }
        Returns: {
          cancellation_reason: string
          cancelled_at: string
          coupon_code: string
          courier_name: string
          created_at: string
          customer_email: string
          customer_id: string
          customer_name: string
          delivered_at: string
          discount_amount: number
          estimated_delivery: string
          id: string
          invoice_number: string
          is_frozen: boolean
          items_count: number
          order_number: string
          payment_method: string
          payment_status: string
          phone: string
          shipping_address: string
          status: string
          total_amount: number
          total_count: number
          tracking_number: string
          updated_at: string
          vendors_count: number
        }[]
      }
      admin_list_reports: {
        Args: {
          _limit?: number
          _offset?: number
          _search?: string
          _status?: Database["public"]["Enums"]["report_status"]
          _type?: Database["public"]["Enums"]["report_type"]
        }
        Returns: {
          created_at: string
          description: string
          id: string
          reason: string
          report_type: Database["public"]["Enums"]["report_type"]
          reporter_email: string
          reporter_id: string
          reporter_name: string
          resolution_note: string
          resolved_at: string
          resolved_by: string
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          total_count: number
          updated_at: string
        }[]
      }
      admin_list_reviews: {
        Args: { _limit?: number; _search?: string; _status?: string }
        Returns: {
          author_name: string
          comment: string
          created_at: string
          hidden_reason: string
          id: string
          image_url: string
          is_hidden: boolean
          product_id: string
          product_name: string
          rating: number
          user_id: string
        }[]
      }
      admin_list_seller_applications: {
        Args: never
        Returns: {
          address: string
          business_document_url: string
          city: string
          contact_email: string
          contact_phone: string
          cover_image_url: string
          created_at: string
          email: string
          full_name: string
          governorate: string
          id: string
          identity_document_url: string
          logo_url: string
          orders_count: number
          owner_name: string
          products_count: number
          rejection_reason: string
          status: Database["public"]["Enums"]["seller_status"]
          store_description: string
          store_name: string
          submitted_at: string
          user_id: string
        }[]
      }
      admin_moderate_product: {
        Args: {
          _action: string
          _product_id: string
          _reason?: string
          _reason_code?: string
        }
        Returns: undefined
      }
      admin_order_sub_orders: {
        Args: { _order_id: string }
        Returns: {
          created_at: string
          id: string
          items_count: number
          order_number: string
          status: string
          total_amount: number
          vendor_id: string
          vendor_name: string
        }[]
      }
      admin_refund_order: {
        Args: { _order_id: string; _reason: string }
        Returns: undefined
      }
      admin_reopen_order: {
        Args: {
          _ip_address?: string
          _order_id: string
          _reason: string
          _status: string
          _user_agent?: string
        }
        Returns: undefined
      }
      admin_resolve_return_dispute: {
        Args: {
          _decision: string
          _ip_address?: string
          _note: string
          _return_id: string
          _user_agent?: string
        }
        Returns: undefined
      }
      admin_revoke_violation: {
        Args: { _note?: string; _violation_id: string }
        Returns: undefined
      }
      admin_search_showroom_products: {
        Args: { _limit?: number; _search?: string; _vendor_id?: string }
        Returns: {
          discount_price: number
          image_url: string
          name: string
          price: number
          product_id: string
          rating: number
          sku: string
          vendor_id: string
          vendor_name: string
        }[]
      }
      admin_search_showroom_vendors: {
        Args: { _limit?: number; _search?: string }
        Returns: {
          logo_url: string
          name: string
          product_count: number
          rating: number
          vendor_id: string
        }[]
      }
      admin_set_coupon_active: {
        Args: { _coupon_id: string; _is_active: boolean; _reason?: string }
        Returns: undefined
      }
      admin_set_order_freeze: {
        Args: {
          _frozen: boolean
          _ip_address?: string
          _order_id: string
          _reason?: string
          _user_agent?: string
        }
        Returns: undefined
      }
      admin_set_product_flags: {
        Args: {
          _is_active?: boolean
          _is_featured?: boolean
          _is_recommended?: boolean
          _is_trending?: boolean
          _product_id: string
        }
        Returns: undefined
      }
      admin_set_user_role: {
        Args: {
          _grant: boolean
          _reason?: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      admin_suspend_conversation: {
        Args: {
          _conversation_id: string
          _reason: string
          _suspend?: boolean
          _until?: string
        }
        Returns: undefined
      }
      admin_suspend_user: {
        Args: { _reason: string; _user_id: string }
        Returns: undefined
      }
      admin_unhide_review: { Args: { _review_id: string }; Returns: undefined }
      admin_update_order_status: {
        Args: {
          _courier_name?: string
          _note?: string
          _order_id: string
          _status: string
          _tracking_number?: string
        }
        Returns: undefined
      }
      admin_update_report: {
        Args: {
          _note?: string
          _report_id: string
          _status: Database["public"]["Enums"]["report_status"]
        }
        Returns: undefined
      }
      admin_user_order_history: {
        Args: { _limit?: number; _user_id: string }
        Returns: {
          created_at: string
          id: string
          role: string
          status: string
          total_amount: number
        }[]
      }
      approve_seller_application: {
        Args: { _app_id: string }
        Returns: undefined
      }
      archive_product: { Args: { _product_id: string }; Returns: string }
      bootstrap_first_super_admin: { Args: { _email: string }; Returns: Json }
      can_access_conversation_file: {
        Args: { _path: string }
        Returns: boolean
      }
      cancel_order: {
        Args: { _order_id: string; _reason: string }
        Returns: undefined
      }
      chat_unread_total: { Args: never; Returns: number }
      check_contact_rate_limit: {
        Args: { p_email_hash: string }
        Returns: boolean
      }
      check_email_registered: { Args: { p_email: string }; Returns: Json }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      create_order:
        | {
            Args: {
              _coupon_code?: string
              _items: Json
              _notes?: string
              _phone: string
              _shipping_address: string
            }
            Returns: string
          }
        | {
            Args: {
              _coupon_code?: string
              _items: Json
              _notes?: string
              _payment_method?: string
              _phone: string
              _shipping_address: string
            }
            Returns: string
          }
      create_return_request: {
        Args: {
          _customer_note?: string
          _description: string
          _images?: Json
          _items?: Json
          _order_id: string
          _reason: string
        }
        Returns: Json
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_or_archive_product: {
        Args: { _product_id: string }
        Returns: string
      }
      delete_own_chat_message: {
        Args: { p_message_id: string }
        Returns: undefined
      }
      delete_seller_account: { Args: { _user_id: string }; Returns: undefined }
      edit_chat_message: {
        Args: { p_content: string; p_message_id: string }
        Returns: undefined
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      forward_chat_message: {
        Args: { p_message_id: string; p_target_conversation_id: string }
        Returns: string
      }
      get_or_create_conversation: {
        Args: { p_product_id?: string; p_vendor_id: string }
        Returns: string
      }
      get_order_timeline: {
        Args: { _order_id: string }
        Returns: {
          actor_name: string
          changed_by_role: string
          created_at: string
          from_status: string
          id: string
          ip_address: string
          is_override: boolean
          notes: string
          status: string
          user_agent: string
        }[]
      }
      get_platform_payment_options: {
        Args: never
        Returns: {
          cod_enabled: boolean
          instructions: string
          sham_cash_enabled: boolean
        }[]
      }
      get_seller_performance: {
        Args: { _vendor_id?: string }
        Returns: {
          avg_delivery_hours: number
          avg_prep_hours: number
          cancellation_rate: number
          cancelled_orders: number
          delivered_orders: number
          ratings_count: number
          return_rate: number
          returned_orders: number
          satisfaction_score: number
          total_orders: number
        }[]
      }
      get_store_public_profile: {
        Args: { _vendor_id: string }
        Returns: {
          avatar_url: string
          city: string
          cover_image_url: string
          description: string
          follower_count: number
          governorate: string
          is_verified: boolean
          logo_url: string
          member_since: string
          owner_name: string
          product_count: number
          rating: number
          review_count: number
          store_name: string
          vendor_id: string
        }[]
      }
      get_vendor_orders: {
        Args: never
        Returns: {
          city: string
          created_at: string
          customer_name: string
          id: string
          status: string
          total_amount: number
        }[]
      }
      get_vendor_public_info: {
        Args: { vendor_id: string }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
        }[]
      }
      get_vendor_sales_stats: {
        Args: never
        Returns: {
          cancelled_orders: number
          completed_orders: number
          estimated_revenue: number
          products_sold: number
          returned_orders: number
          total_orders: number
        }[]
      }
      has_any_admin_role: { Args: { _user_id: string }; Returns: boolean }
      has_any_role: {
        Args: { _roles: string[]; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_feature_enabled: { Args: { _key: string }; Returns: boolean }
      is_order_vendor: {
        Args: { _order_id: string; _uid: string }
        Returns: boolean
      }
      is_valid_order_status: { Args: { _status: string }; Returns: boolean }
      latest_public_reviews: {
        Args: { _limit?: number }
        Returns: {
          comment: string
          created_at: string
          id: string
          product_id: string
          product_image: string
          product_name: string
          rating: number
          reviewer_name: string
        }[]
      }
      list_chat_messages: {
        Args: { p_before?: string; p_conversation_id: string; p_limit?: number }
        Returns: {
          attachments: Json
          content: string
          conversation_id: string
          created_at: string
          deleted_by_sender: boolean
          edited_at: string
          file_name: string
          file_url: string
          forwarded_from_id: string
          id: string
          is_deleted: boolean
          is_pinned: boolean
          is_read: boolean
          message_type: string
          metadata: Json
          read_at: string
          reply_preview: string
          reply_sender_id: string
          reply_to_id: string
          sender_avatar: string
          sender_id: string
          sender_name: string
        }[]
      }
      list_conversations: {
        Args: {
          p_archived?: boolean
          p_limit?: number
          p_offset?: number
          p_search?: string
        }
        Returns: {
          admin_id: string
          context_type: string
          customer_id: string
          id: string
          is_archived: boolean
          is_blocked: boolean
          is_suspended: boolean
          last_message_at: string
          last_message_preview: string
          last_message_sender_id: string
          my_role: string
          order_id: string
          order_number: string
          peer_avatar: string
          peer_id: string
          peer_last_seen: string
          peer_name: string
          product_id: string
          return_id: string
          return_number: string
          subject: string
          suspended_until: string
          unread_count: number
          vendor_id: string
        }[]
      }
      list_order_notes: {
        Args: { _order_id: string }
        Returns: {
          author_name: string
          author_role: string
          created_at: string
          id: string
          is_internal: boolean
          note: string
        }[]
      }
      list_returns: {
        Args: {
          _limit?: number
          _offset?: number
          _scope?: string
          _search?: string
          _status?: string
        }
        Returns: Json
      }
      log_activity: {
        Args: {
          _action_details?: Json
          _action_type: string
          _user_agent?: string
        }
        Returns: undefined
      }
      log_admin_action: {
        Args: {
          _action: string
          _new_value?: Json
          _old_value?: Json
          _reason?: string
          _target_id: string
          _target_type: string
        }
        Returns: undefined
      }
      mark_conversation_read: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      next_order_number: { Args: never; Returns: string }
      normalize_order_status: { Args: { _status: string }; Returns: string }
      order_reports: { Args: { _from?: string; _to?: string }; Returns: Json }
      order_status_can_transition: {
        Args: { _from: string; _role: string; _to: string }
        Returns: boolean
      }
      pin_chat_message: {
        Args: { p_message_id: string; p_pin?: boolean }
        Returns: undefined
      }
      popular_search_terms: {
        Args: { _limit?: number }
        Returns: {
          hits: number
          term: string
        }[]
      }
      product_analytics: { Args: { _product_id: string }; Returns: Json }
      product_can_manage: { Args: { _product_id: string }; Returns: boolean }
      product_sold_counts: {
        Args: { _product_ids: string[] }
        Returns: {
          product_id: string
          sold: number
        }[]
      }
      reactivate_seller: { Args: { _user_id: string }; Returns: undefined }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_contact_rate_limit: {
        Args: { _email_hash: string; _ip_hash: string }
        Returns: undefined
      }
      record_payment: {
        Args: {
          _order_id: string
          _payment_details?: Json
          _payment_method: string
        }
        Returns: string
      }
      record_search_term: { Args: { _term: string }; Returns: string[] }
      redeem_coupon: {
        Args: { _code: string; _subtotal: number }
        Returns: {
          code: string
          discount_amount: number
          discount_type: string
          discount_value: number
          id: string
        }[]
      }
      reject_seller_application: {
        Args: { _app_id: string; _reason: string }
        Returns: undefined
      }
      restore_product: { Args: { _product_id: string }; Returns: string }
      return_actor_role: { Args: { _return_id: string }; Returns: string }
      return_add_images: {
        Args: { _images: Json; _return_id: string }
        Returns: undefined
      }
      return_add_note: {
        Args: { _is_internal?: boolean; _note: string; _return_id: string }
        Returns: string
      }
      return_detail: { Args: { _return_id: string }; Returns: Json }
      return_enqueue_email: {
        Args: {
          _body: string
          _heading: string
          _label: string
          _subject: string
          _user_id: string
        }
        Returns: undefined
      }
      return_mark_read: { Args: { _return_id: string }; Returns: undefined }
      return_reports: {
        Args: { _from?: string; _to?: string; _vendor_id?: string }
        Returns: Json
      }
      return_send_message: {
        Args: { _attachments?: string[]; _body: string; _return_id: string }
        Returns: string
      }
      return_set_logistics: {
        Args: {
          _arrival_date?: string
          _carrier?: string
          _note?: string
          _return_id: string
          _tracking_number?: string
        }
        Returns: undefined
      }
      return_status_label: { Args: { _status: string }; Returns: string }
      return_transition: {
        Args: {
          _note?: string
          _payload?: Json
          _return_id: string
          _to_status: string
        }
        Returns: undefined
      }
      returns_run_automation: { Args: never; Returns: Json }
      search_chat_messages: {
        Args: {
          p_conversation_id?: string
          p_from?: string
          p_limit?: number
          p_query: string
          p_to?: string
        }
        Returns: {
          content: string
          conversation_id: string
          created_at: string
          message_id: string
          message_type: string
          order_number: string
          peer_name: string
          return_number: string
          sender_id: string
          sender_name: string
        }[]
      }
      seller_bulk_update_products: {
        Args: {
          _ids: string[]
          _is_active?: boolean
          _price_pct?: number
          _stock?: number
        }
        Returns: number
      }
      seller_dashboard_overview: { Args: { _days?: number }; Returns: Json }
      seller_list_orders: {
        Args: {
          _from?: string
          _limit?: number
          _offset?: number
          _search?: string
          _status?: string
          _to?: string
        }
        Returns: {
          city: string
          courier_name: string
          created_at: string
          customer_name: string
          customer_phone: string
          estimated_delivery: string
          id: string
          invoice_number: string
          is_frozen: boolean
          items_count: number
          order_number: string
          payment_method: string
          payment_status: string
          status: string
          total_amount: number
          total_count: number
          tracking_number: string
          updated_at: string
          vendor_subtotal: number
        }[]
      }
      seller_order_items: {
        Args: { _order_id: string }
        Returns: {
          id: string
          price: number
          product_image: string
          product_name: string
          quantity: number
          subtotal: number
          variant_label: string
        }[]
      }
      seller_request_payout: {
        Args: { _amount: number; _details?: string; _method: string }
        Returns: string
      }
      seller_update_store_profile: {
        Args: {
          _address?: string
          _business_info?: string
          _city?: string
          _contact_email?: string
          _contact_phone?: string
          _cover_image_url?: string
          _logo_url?: string
          _return_policy?: string
          _shipping_policy?: string
          _store_description?: string
          _store_name?: string
          _working_hours?: string
        }
        Returns: undefined
      }
      seller_wallet_summary: { Args: never; Returns: Json }
      send_chat_message: {
        Args: {
          p_attachments?: Json
          p_content?: string
          p_conversation_id: string
          p_message_type?: string
          p_reply_to_id?: string
        }
        Returns: string
      }
      send_notification: {
        Args: {
          _message: string
          _related_id?: string
          _target_user_id: string
          _title: string
          _type?: string
        }
        Returns: undefined
      }
      set_conversation_archived: {
        Args: { p_archived?: boolean; p_conversation_id: string }
        Returns: undefined
      }
      set_default_address: { Args: { _address_id: string }; Returns: undefined }
      set_order_shipping_info: {
        Args: {
          _courier_name?: string
          _delivery_notes?: string
          _driver_name?: string
          _driver_phone?: string
          _estimated_delivery?: string
          _ip_address?: string
          _order_id: string
          _tracking_number?: string
          _user_agent?: string
        }
        Returns: undefined
      }
      settle_sham_cash_payment: {
        Args: {
          _amount?: number
          _currency?: string
          _failure_reason?: string
          _order_id: string
          _provider_reference?: string
          _succeeded: boolean
        }
        Returns: Json
      }
      start_conversation: {
        Args: {
          p_order_id?: string
          p_product_id?: string
          p_return_id?: string
          p_vendor_id?: string
        }
        Returns: string
      }
      submit_report: {
        Args: {
          _description?: string
          _reason: string
          _report_type: Database["public"]["Enums"]["report_type"]
          _target_id: string
        }
        Returns: string
      }
      submit_seller_application: {
        Args: {
          _address?: string
          _city: string
          _contact_email: string
          _contact_phone: string
          _cover_image_url?: string
          _governorate: string
          _logo_url?: string
          _owner_name: string
          _store_description?: string
          _store_name: string
        }
        Returns: string
      }
      suspend_seller: {
        Args: { _reason: string; _user_id: string }
        Returns: undefined
      }
      touch_conversation_presence: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      track_order_public: {
        Args: { _order_id: string; _phone: string }
        Returns: Json
      }
      track_product_metric: {
        Args: { _metric: string; _product_id: string }
        Returns: undefined
      }
      update_order_shipping: {
        Args: {
          _estimated_delivery?: string
          _order_id: string
          _shipping_company?: string
          _shipping_notes?: string
          _tracking_number?: string
        }
        Returns: undefined
      }
      update_order_status: {
        Args: {
          _ip_address?: string
          _note?: string
          _order_id: string
          _override?: boolean
          _status: string
          _user_agent?: string
        }
        Returns: undefined
      }
      update_own_profile: {
        Args: { _avatar_url?: string; _full_name?: string; _phone?: string }
        Returns: undefined
      }
      update_refund_status: {
        Args: {
          _ip_address?: string
          _note?: string
          _order_id: string
          _status: string
          _user_agent?: string
        }
        Returns: undefined
      }
      validate_coupon: {
        Args: { _code: string; _subtotal: number }
        Returns: {
          discount_type: string
          discount_value: number
          expires_at: string
          id: string
          max_uses: number
          min_purchase: number
          used_count: number
          vendor_id: string
        }[]
      }
      vendor_submit_product_for_review: {
        Args: { _product_id: string }
        Returns: undefined
      }
      vendor_update_order_status: {
        Args: {
          _courier_name?: string
          _order_id: string
          _status: string
          _tracking_number?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "customer" | "vendor" | "admin" | "super_admin" | "moderator"
      report_status: "pending" | "under_review" | "resolved" | "rejected"
      report_type: "product" | "seller" | "buyer" | "message" | "review"
      seller_status: "pending" | "approved" | "rejected" | "suspended"
      user_role: "customer" | "vendor"
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
      app_role: ["customer", "vendor", "admin", "super_admin", "moderator"],
      report_status: ["pending", "under_review", "resolved", "rejected"],
      report_type: ["product", "seller", "buyer", "message", "review"],
      seller_status: ["pending", "approved", "rejected", "suspended"],
      user_role: ["customer", "vendor"],
    },
  },
} as const
