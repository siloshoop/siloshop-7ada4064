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
    PostgrestVersion: "13.0.5"
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
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          name_ar: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          name_ar: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          name_ar?: string
          updated_at?: string
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
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          name_ar: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          name_ar: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          name_ar?: string
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
      conversations: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          is_blocked: boolean
          is_suspended: boolean
          last_message_at: string | null
          moderated_at: string | null
          moderated_by: string | null
          moderation_reason: string | null
          product_id: string | null
          suspended_until: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          is_blocked?: boolean
          is_suspended?: boolean
          last_message_at?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          product_id?: string | null
          suspended_until?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          is_blocked?: boolean
          is_suspended?: boolean
          last_message_at?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          product_id?: string | null
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
            foreignKeyName: "conversations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
          city: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          notes: string | null
          phone: string
          recipient_name: string
          street: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          created_at?: string
          id?: string
          is_default?: boolean
          label: string
          notes?: string | null
          phone: string
          recipient_name: string
          street: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
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
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          file_name: string | null
          file_url: string | null
          id: string
          is_deleted: boolean
          is_read: boolean
          message_type: string
          sender_id: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          is_deleted?: boolean
          is_read?: boolean
          message_type?: string
          sender_id: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          is_deleted?: boolean
          is_read?: boolean
          message_type?: string
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
          id: string
          order_id: string
          price: number
          product_id: string
          quantity: number
          vendor_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id: string
          price: number
          product_id: string
          quantity: number
          vendor_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string
          price?: number
          product_id?: string
          quantity?: number
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
            foreignKeyName: "order_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          created_at: string
          id: string
          location_lat: number | null
          location_lng: number | null
          notes: string | null
          order_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          order_id: string
          status: string
        }
        Update: {
          created_at?: string
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          order_id?: string
          status?: string
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
          coupon_code: string | null
          courier_name: string | null
          created_at: string | null
          current_location_lat: number | null
          current_location_lng: number | null
          customer_id: string
          delivered_at: string | null
          delivery_lat: number | null
          delivery_lng: number | null
          discount_amount: number | null
          estimated_delivery: string | null
          id: string
          notes: string | null
          order_kind: string
          payment_method: string
          payment_status: string
          phone: string | null
          shipping_address: string | null
          status: string | null
          total_amount: number
          tracking_number: string | null
          tracking_status: string | null
          updated_at: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_by_role?: string | null
          coupon_code?: string | null
          courier_name?: string | null
          created_at?: string | null
          current_location_lat?: number | null
          current_location_lng?: number | null
          customer_id: string
          delivered_at?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          discount_amount?: number | null
          estimated_delivery?: string | null
          id?: string
          notes?: string | null
          order_kind?: string
          payment_method?: string
          payment_status?: string
          phone?: string | null
          shipping_address?: string | null
          status?: string | null
          total_amount: number
          tracking_number?: string | null
          tracking_status?: string | null
          updated_at?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_by_role?: string | null
          coupon_code?: string | null
          courier_name?: string | null
          created_at?: string | null
          current_location_lat?: number | null
          current_location_lng?: number | null
          customer_id?: string
          delivered_at?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          discount_amount?: number | null
          estimated_delivery?: string | null
          id?: string
          notes?: string | null
          order_kind?: string
          payment_method?: string
          payment_status?: string
          phone?: string | null
          shipping_address?: string | null
          status?: string | null
          total_amount?: number
          tracking_number?: string | null
          tracking_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          order_id: string
          payment_details: Json | null
          payment_method: string
          payment_status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          order_id: string
          payment_details?: Json | null
          payment_method: string
          payment_status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          order_id?: string
          payment_details?: Json | null
          payment_method?: string
          payment_status?: string
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
      platform_payment_settings: {
        Row: {
          id: number
          instructions: string
          is_active: boolean
          sham_cash_account_name: string
          sham_cash_account_number: string
          updated_at: string
        }
        Insert: {
          id?: number
          instructions?: string
          is_active?: boolean
          sham_cash_account_name?: string
          sham_cash_account_number?: string
          updated_at?: string
        }
        Update: {
          id?: number
          instructions?: string
          is_active?: boolean
          sham_cash_account_name?: string
          sham_cash_account_number?: string
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
      products: {
        Row: {
          brand_id: string | null
          category_id: string | null
          colors: string[]
          created_at: string | null
          currency: string
          description: string | null
          discount_price: number | null
          external_id: string | null
          id: string
          image_url: string | null
          images: string[] | null
          is_active: boolean | null
          moderated_at: string | null
          moderated_by: string | null
          moderation_reason: string | null
          moderation_reason_code: string | null
          moderation_status: string
          name: string
          original_price: number | null
          price: number
          product_type: string
          shipping_cost: number
          ships_within_days: number | null
          sizes: string[]
          sku: string | null
          source: string
          stock_quantity: number | null
          subcategory_id: string | null
          updated_at: string | null
          vendor_id: string
          weight: number | null
        }
        Insert: {
          brand_id?: string | null
          category_id?: string | null
          colors?: string[]
          created_at?: string | null
          currency?: string
          description?: string | null
          discount_price?: number | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_active?: boolean | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          moderation_reason_code?: string | null
          moderation_status?: string
          name: string
          original_price?: number | null
          price: number
          product_type?: string
          shipping_cost?: number
          ships_within_days?: number | null
          sizes?: string[]
          sku?: string | null
          source?: string
          stock_quantity?: number | null
          subcategory_id?: string | null
          updated_at?: string | null
          vendor_id: string
          weight?: number | null
        }
        Update: {
          brand_id?: string | null
          category_id?: string | null
          colors?: string[]
          created_at?: string | null
          currency?: string
          description?: string | null
          discount_price?: number | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_active?: boolean | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          moderation_reason_code?: string | null
          moderation_status?: string
          name?: string
          original_price?: number | null
          price?: number
          product_type?: string
          shipping_cost?: number
          ships_within_days?: number | null
          sizes?: string[]
          sku?: string | null
          source?: string
          stock_quantity?: number | null
          subcategory_id?: string | null
          updated_at?: string | null
          vendor_id?: string
          weight?: number | null
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
          created_at: string
          customer_id: string
          id: string
          images: string[]
          notes: string | null
          order_id: string
          order_item_id: string | null
          reason: string
          resolved_at: string | null
          review_note: string | null
          status: string
          updated_at: string
          vendor_id: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          images?: string[]
          notes?: string | null
          order_id: string
          order_item_id?: string | null
          reason: string
          resolved_at?: string | null
          review_note?: string | null
          status?: string
          updated_at?: string
          vendor_id: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          images?: string[]
          notes?: string | null
          order_id?: string
          order_item_id?: string | null
          reason?: string
          resolved_at?: string | null
          review_note?: string | null
          status?: string
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
      seller_applications: {
        Row: {
          address: string | null
          business_document_url: string | null
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
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["seller_status"]
          store_description: string | null
          store_name: string | null
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          business_document_url?: string | null
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
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["seller_status"]
          store_description?: string | null
          store_name?: string | null
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          business_document_url?: string | null
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
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["seller_status"]
          store_description?: string | null
          store_name?: string | null
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      subcategories: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name_ar: string
          name_en: string | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name_ar: string
          name_en?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name_ar?: string
          name_en?: string | null
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
      admin_activate_user: { Args: { _user_id: string }; Returns: undefined }
      admin_ban_user: {
        Args: { _reason: string; _user_id: string }
        Returns: undefined
      }
      admin_block_conversation: {
        Args: { _block?: boolean; _conversation_id: string; _reason: string }
        Returns: undefined
      }
      admin_cancel_order: {
        Args: { _order_id: string; _reason: string }
        Returns: undefined
      }
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
          id: string
          items_count: number
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
      admin_refund_order: {
        Args: { _order_id: string; _reason: string }
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
      cancel_order: {
        Args: { _order_id: string; _reason: string }
        Returns: undefined
      }
      check_contact_rate_limit: {
        Args: { p_email_hash: string }
        Returns: boolean
      }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      create_order: {
        Args: {
          _coupon_code?: string
          _items: Json
          _notes?: string
          _phone: string
          _shipping_address: string
        }
        Returns: string
      }
      create_return_request: {
        Args: {
          _images: string[]
          _notes: string
          _order_id: string
          _order_item_id: string
          _reason: string
          _video_url: string
        }
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_or_archive_product: {
        Args: { _product_id: string }
        Returns: string
      }
      delete_seller_account: { Args: { _user_id: string }; Returns: undefined }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_or_create_conversation: {
        Args: { p_product_id?: string; p_vendor_id: string }
        Returns: string
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
      log_activity: {
        Args: {
          _action_details?: Json
          _action_type: string
          _user_agent?: string
        }
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
      product_can_manage: { Args: { _product_id: string }; Returns: boolean }
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
      set_default_address: { Args: { _address_id: string }; Returns: undefined }
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
      track_order_public: {
        Args: { _order_id: string; _phone: string }
        Returns: Json
      }
      update_own_profile: {
        Args: { _avatar_url?: string; _full_name?: string; _phone?: string }
        Returns: undefined
      }
      update_return_status: {
        Args: { _new_status: string; _note: string; _return_id: string }
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
