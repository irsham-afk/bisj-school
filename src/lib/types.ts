// Minimal hand-written row types for the tables this app reads/writes.
export type Role = "admin" | "teacher" | "staff";
export type StudentStatus = "active" | "withdrawn" | "transferred" | "graduated" | "suspended";

export interface Profile {
  id: string;
  school_id: string;
  full_name: string;
  email: string | null;
  role: Role;
  title: string | null;
  is_teaching: boolean;
  is_active: boolean;
}

export interface School {
  id: string;
  name: string;
  principal_name: string | null;
}

export interface Student {
  id: string;
  school_id: string;
  admission_no: string | null;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  status: StudentStatus;
  archived_at: string | null;
}

export interface GradeLevel {
  id: string;
  school_id: string;
  name: string;
  level_order: number;
}

export interface Subject {
  id: string;
  school_id: string;
  name: string;
  code: string | null;
  is_elective: boolean;
}

export interface AcademicYear {
  id: string;
  school_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
}

export interface Term {
  id: string;
  academic_year_id: string;
  name: string;
  sequence: number;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
}

export interface Klass {
  id: string;
  school_id: string;
  grade_level_id: string;
  academic_year_id: string;
  name: string;
  homeroom_teacher_id: string | null;
}
