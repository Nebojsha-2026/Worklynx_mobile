export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          phone: string | null;
          avatar_url: string | null;
          date_of_birth: string | null;
          address: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          tax_file_number: string | null;
          bank_account_name: string | null;
          bank_bsb: string | null;
          bank_account_number: string | null;
          abn: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { id: string };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string | null;
          logo_url: string | null;
          address: string | null;
          phone: string | null;
          email: string | null;
          abn: string | null;
          acn: string | null;
          plan_id: string | null;
          trial_ends_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['organizations']['Row']> & { name: string };
        Update: Partial<Database['public']['Tables']['organizations']['Row']>;
      };
      org_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: 'employee' | 'manager' | 'business_manager' | 'business_owner';
          status: 'active' | 'inactive' | 'pending';
          position: string | null;
          department: string | null;
          start_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['org_members']['Row']>;
        Update: Partial<Database['public']['Tables']['org_members']['Row']>;
      };
      shifts: {
        Row: {
          id: string;
          organization_id: string;
          location_id: string | null;
          title: string;
          description: string | null;
          start_time: string;
          end_time: string;
          status: 'draft' | 'published' | 'cancelled' | 'completed';
          required_staff: number;
          created_by: string | null;
          recurring_series_id: string | null;
          break_minutes: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['shifts']['Row']> & { title: string; start_time: string; end_time: string; organization_id: string };
        Update: Partial<Database['public']['Tables']['shifts']['Row']>;
      };
      shift_assignments: {
        Row: {
          id: string;
          shift_id: string;
          user_id: string;
          organization_id: string;
          status: 'assigned' | 'confirmed' | 'declined' | 'no_show' | 'completed';
          clock_in_time: string | null;
          clock_out_time: string | null;
          clock_in_location: Json | null;
          clock_out_location: Json | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['shift_assignments']['Row']>;
        Update: Partial<Database['public']['Tables']['shift_assignments']['Row']>;
      };
      timesheets: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          shift_id: string | null;
          shift_assignment_id: string | null;
          status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';
          start_time: string;
          end_time: string;
          break_minutes: number | null;
          total_hours: number | null;
          notes: string | null;
          approved_by_user_id: string | null;
          approved_at: string | null;
          rejected_reason: string | null;
          week_start: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['timesheets']['Row']>;
        Update: Partial<Database['public']['Tables']['timesheets']['Row']>;
      };
      time_entries: {
        Row: {
          id: string;
          timesheet_id: string;
          organization_id: string;
          user_id: string;
          date: string;
          start_time: string;
          end_time: string;
          break_minutes: number | null;
          hours: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['time_entries']['Row']>;
        Update: Partial<Database['public']['Tables']['time_entries']['Row']>;
      };
      locations: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          address: string | null;
          lat: number | null;
          lng: number | null;
          radius_meters: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['locations']['Row']> & { name: string; organization_id: string };
        Update: Partial<Database['public']['Tables']['locations']['Row']>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string | null;
          title: string;
          body: string;
          type: string;
          data: Json | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['notifications']['Row']>;
        Update: Partial<Database['public']['Tables']['notifications']['Row']>;
      };
      earnings: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          shift_id: string | null;
          timesheet_id: string | null;
          amount: number;
          hours: number | null;
          rate: number | null;
          type: string | null;
          period_start: string | null;
          period_end: string | null;
          paid_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['earnings']['Row']>;
        Update: Partial<Database['public']['Tables']['earnings']['Row']>;
      };
      availability: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string;
          day_of_week: number;
          is_available: boolean;
          start_time: string | null;
          end_time: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['availability']['Row']>;
        Update: Partial<Database['public']['Tables']['availability']['Row']>;
      };
      documents: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string | null;
          name: string;
          file_url: string;
          file_type: string | null;
          file_size: number | null;
          category: string | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['documents']['Row']>;
        Update: Partial<Database['public']['Tables']['documents']['Row']>;
      };
      communications: {
        Row: {
          id: string;
          organization_id: string;
          sender_id: string;
          recipient_id: string | null;
          subject: string | null;
          body: string;
          type: 'announcement' | 'message' | 'alert';
          sent_at: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['communications']['Row']>;
        Update: Partial<Database['public']['Tables']['communications']['Row']>;
      };
      invites: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          role: string;
          token: string;
          invited_by: string | null;
          accepted_at: string | null;
          expires_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['invites']['Row']>;
        Update: Partial<Database['public']['Tables']['invites']['Row']>;
      };
      member_pay_rates: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          rate: number;
          rate_type: 'hourly' | 'salary' | 'daily';
          effective_from: string;
          effective_to: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['member_pay_rates']['Row']>;
        Update: Partial<Database['public']['Tables']['member_pay_rates']['Row']>;
      };
      audit_logs: {
        Row: {
          id: string;
          organization_id: string | null;
          user_id: string | null;
          action: string;
          resource_type: string | null;
          resource_id: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['audit_logs']['Row']>;
        Update: Partial<Database['public']['Tables']['audit_logs']['Row']>;
      };
      plans: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          price_monthly: number | null;
          price_annually: number | null;
          max_employees: number | null;
          features: Json | null;
          stripe_price_id_monthly: string | null;
          stripe_price_id_annually: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['plans']['Row']>;
        Update: Partial<Database['public']['Tables']['plans']['Row']>;
      };
      subscriptions: {
        Row: {
          id: string;
          organization_id: string;
          plan_id: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          status: string;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['subscriptions']['Row']>;
        Update: Partial<Database['public']['Tables']['subscriptions']['Row']>;
      };
      recurring_series: {
        Row: {
          id: string;
          organization_id: string;
          title: string;
          description: string | null;
          location_id: string | null;
          frequency: 'daily' | 'weekly' | 'fortnightly' | 'monthly';
          day_of_week: number[] | null;
          start_time: string;
          end_time: string;
          series_start: string;
          series_end: string | null;
          required_staff: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['recurring_series']['Row']>;
        Update: Partial<Database['public']['Tables']['recurring_series']['Row']>;
      };
      shift_offers: {
        Row: {
          id: string;
          shift_id: string;
          organization_id: string;
          offered_by: string | null;
          offered_to: string | null;
          status: 'pending' | 'accepted' | 'declined' | 'expired';
          message: string | null;
          expires_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['shift_offers']['Row']>;
        Update: Partial<Database['public']['Tables']['shift_offers']['Row']>;
      };
      shift_photos: {
        Row: {
          id: string;
          shift_assignment_id: string;
          user_id: string;
          photo_url: string;
          taken_at: string | null;
          location: Json | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['shift_photos']['Row']>;
        Update: Partial<Database['public']['Tables']['shift_photos']['Row']>;
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          platform: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['push_subscriptions']['Row']>;
        Update: Partial<Database['public']['Tables']['push_subscriptions']['Row']>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Organization = Database['public']['Tables']['organizations']['Row'];
export type OrgMember = Database['public']['Tables']['org_members']['Row'];
export type Shift = Database['public']['Tables']['shifts']['Row'];
export type ShiftAssignment = Database['public']['Tables']['shift_assignments']['Row'];
export type Timesheet = Database['public']['Tables']['timesheets']['Row'];
export type TimeEntry = Database['public']['Tables']['time_entries']['Row'];
export type Location = Database['public']['Tables']['locations']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type Earning = Database['public']['Tables']['earnings']['Row'];
export type Document = Database['public']['Tables']['documents']['Row'];
export type Communication = Database['public']['Tables']['communications']['Row'];
export type Invite = Database['public']['Tables']['invites']['Row'];
export type MemberPayRate = Database['public']['Tables']['member_pay_rates']['Row'];
export type AuditLog = Database['public']['Tables']['audit_logs']['Row'];
export type Plan = Database['public']['Tables']['plans']['Row'];
export type Subscription = Database['public']['Tables']['subscriptions']['Row'];
export type RecurringSeries = Database['public']['Tables']['recurring_series']['Row'];
export type ShiftOffer = Database['public']['Tables']['shift_offers']['Row'];
export type PushSubscription = Database['public']['Tables']['push_subscriptions']['Row'];

export type UserRole = 'employee' | 'manager' | 'business_manager' | 'business_owner';

export type ShiftWithAssignment = Shift & {
  shift_assignments: ShiftAssignment[];
  locations: Location | null;
};

export type TimesheetWithDetails = Timesheet & {
  shifts: Shift | null;
  profiles: Profile | null;
};

export type MemberWithProfile = OrgMember & {
  profiles: Profile;
};
