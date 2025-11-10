// Tipos temporários até atualização do schema do Supabase
export type Database = {
  public: {
    Tables: {
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: string;
          created_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          credits: number;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          credits?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          credits?: number;
          created_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          type: 'download' | 'purchase' | 'admin_add' | 'admin_remove';
          amount: number;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: 'download' | 'purchase' | 'admin_add' | 'admin_remove';
          amount: number;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: 'download' | 'purchase' | 'admin_add' | 'admin_remove';
          amount?: number;
          description?: string | null;
          created_at?: string;
        };
      };
      credit_purchases: {
        Row: {
          id: string;
          user_id: string;
          credits: number;
          amount_brl: number;
          status: 'pending' | 'approved' | 'rejected';
          created_at: string;
          approved_at: string | null;
          approved_by: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          credits: number;
          amount_brl: number;
          status?: 'pending' | 'approved' | 'rejected';
          created_at?: string;
          approved_at?: string | null;
          approved_by?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          credits?: number;
          amount_brl?: number;
          status?: 'pending' | 'approved' | 'rejected';
          created_at?: string;
          approved_at?: string | null;
          approved_by?: string | null;
        };
      };
      downloads: {
        Row: {
          id: string;
          user_id: string;
          file_name: string;
          downloaded_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          file_name: string;
          downloaded_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          file_name?: string;
          downloaded_at?: string;
        };
      };
    };
  };
};
