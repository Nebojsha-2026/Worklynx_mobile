export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type OrgRole = 'BO' | 'BM' | 'MANAGER' | 'EMPLOYEE';
export type ShiftStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'ACTIVE' | 'COMPLETED' | 'OFFERED';
export type TimesheetStatus = 'OPEN' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'LOCKED';
export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
export type UserRole = OrgRole;

export interface Profile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  dob: string | null;
  abn: string | null;
  acn: string | null;
  address_street: string | null;
  address_suburb: string | null;
  address_state: string | null;
  address_postcode: string | null;
  address_country: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_bsb: string | null;
  tfn: string | null;
  super_fund_name: string | null;
  super_number: string | null;
  residency_status: string | null;
  visa_subclass: string | null;
  visa_expiry_date: string | null;
  payment_method_type: string | null;
  availability: Json | null;
  availability_confirmed: boolean;
  profile_confirmed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  owner_user_id: string;
  company_logo_url: string | null;
  currency_code: string;
  theme: Json;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  subscription_tier: string | null;
  subscription_current_period_end: string | null;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  id: string;
  user_id: string;
  organization_id: string;
  role: OrgRole;
  is_active: boolean;
  start_date: string | null;
  employment_type: string | null;
  payment_frequency: string;
  super_rate: number | null;
  created_at: string;
}

export interface Shift {
  id: string;
  organization_id: string;
  title: string | null;
  shift_date: string;
  start_at: string;
  end_at: string;
  end_date: string;
  status: ShiftStatus;
  location_id: string | null;
  location: string | null;
  description: string | null;
  break_minutes: number;
  break_is_paid: boolean;
  hourly_rate: number | null;
  fixed_pay: number | null;
  track_time: boolean;
  requires_photos: boolean;
  is_recurring: boolean;
  recurring_group_id: string | null;
  created_by_user_id: string;
  created_at: string;
}

export interface ShiftAssignment {
  id: string;
  shift_id: string;
  employee_user_id: string;
  assigned_by_user_id: string;
  organization_id: string;
  assigned_at: string;
  created_at: string | null;
}

export interface Timesheet {
  id: string;
  organization_id: string;
  shift_id: string;
  employee_user_id: string;
  status: TimesheetStatus;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by_user_id: string | null;
  rejection_reason: string | null;
  amend_message: string | null;
  amended_at: string | null;
  amended_by_user_id: string | null;
  created_at: string;
}

export interface TimeEntry {
  id: string;
  timesheet_id: string;
  clock_in: string;
  clock_out: string | null;
  break_minutes: number;
  notes: string | null;
  clock_in_lat: number | null;
  clock_in_lng: number | null;
  clock_out_lat: number | null;
  clock_out_lng: number | null;
  geo_status: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  organization_id: string | null;
  shift_id: string | null;
  title: string;
  body: string | null;
  type: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

export interface Earning {
  id: string;
  organization_id: string;
  employee_user_id: string;
  shift_id: string;
  time_entry_id: string | null;
  timesheet_id: string | null;
  amount: number;
  minutes_worked: number;
  minutes_paid: number;
  hourly_rate: number;
  earned_at: string;
  source: string;
  created_at: string;
}

export interface Location {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  geo_lat: number | null;
  geo_lng: number | null;
  geofence_radius: number | null;
  track_time: boolean;
  require_photos: boolean;
  pay_rate: number | null;
  pay_type: string;
  default_hours: number | null;
  description: string | null;
  notes: string | null;
  important_info: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface Invite {
  id: string;
  organization_id: string;
  invited_email: string;
  invited_role: OrgRole;
  invited_by_user_id: string;
  invited_by: string | null;
  token: string;
  status: InviteStatus;
  expires_at: string;
  accepted_at: string | null;
  accepted_by_user_id: string | null;
  created_at: string;
}

export interface MemberPayRate {
  id: string;
  organization_id: string;
  member_user_id: string;
  hourly_rate: number | null;
  rate: number | null;
  pay_type: string | null;
  currency_code: string;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
  set_by_user_id: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface AuditLog {
  id: string;
  organization_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Json | null;
  created_at: string;
}

export type MemberWithProfile = OrgMember & { profiles: Profile };
