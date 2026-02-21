import type { SupabaseClient } from "@supabase/supabase-js";
import type { InMemoryStore } from "../store/inMemoryStore";
import type { Company } from "../types/models";

const ONBOARDING_STEPS = ["profile", "knowledge_base", "routing", "team_invite", "test_chat"] as const;
const MIN_STEPS_FOR_GO_LIVE = ["profile", "knowledge_base"] as const;

interface CompanyRow {
  id: string;
  name: string;
  slug: string;
  support_email: string;
  emergency_email: string;
  notification_cc: string[] | null;
  is_profile_complete: boolean;
  onboarding_steps_done?: string[] | null;
}

const mapRowToCompany = (row: CompanyRow): Company => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  supportEmail: row.support_email,
  emergencyEmail: row.emergency_email,
  notificationCc: row.notification_cc ?? [],
  isProfileComplete: row.is_profile_complete,
  onboardingStepsDone: row.onboarding_steps_done ?? []
});

export class TenantService {
  constructor(
    private readonly store: InMemoryStore,
    private readonly supabase: SupabaseClient | null
  ) {}

  async findBySlug(slug: string): Promise<Company | null> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("companies")
        .select("id, name, slug, support_email, emergency_email, notification_cc, is_profile_complete")
        .eq("slug", slug)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to load company by slug: ${error.message}`);
      }

      return data ? mapRowToCompany(data as CompanyRow) : null;
    }

    return this.store.companies.find((company) => company.slug === slug) ?? null;
  }

  async findById(companyId: string): Promise<Company | null> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("companies")
        .select("id, name, slug, support_email, emergency_email, notification_cc, is_profile_complete, onboarding_steps_done")
        .eq("id", companyId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to load company by id: ${error.message}`);
      }

      return data ? mapRowToCompany(data as CompanyRow) : null;
    }

    const c = this.store.companies.find((company) => company.id === companyId);
    return c ? { ...c, onboardingStepsDone: c.onboardingStepsDone ?? [] } : null;
  }

  async getOnboardingProgress(companyId: string): Promise<{ stepsDone: string[]; isProfileComplete: boolean; canGoLive: boolean }> {
    const company = await this.findById(companyId);
    if (!company) {
      return { stepsDone: [], isProfileComplete: false, canGoLive: false };
    }
    const stepsDone = company.onboardingStepsDone ?? [];
    const canGoLive = MIN_STEPS_FOR_GO_LIVE.every((s) => stepsDone.includes(s));
    return {
      stepsDone,
      isProfileComplete: company.isProfileComplete,
      canGoLive
    };
  }

  async completeOnboardingStep(companyId: string, step: string): Promise<void> {
    if (!ONBOARDING_STEPS.includes(step as (typeof ONBOARDING_STEPS)[number])) return;
    const company = await this.findById(companyId);
    if (!company) return;
    const stepsDone = [...(company.onboardingStepsDone ?? [])];
    if (stepsDone.includes(step)) return;
    stepsDone.push(step);
    if (this.supabase) {
      await this.supabase.from("companies").update({ onboarding_steps_done: stepsDone }).eq("id", companyId);
    } else {
      const c = this.store.companies.find((x) => x.id === companyId);
      if (c) c.onboardingStepsDone = stepsDone;
    }
  }

  async setGoLive(companyId: string): Promise<{ ok: boolean; error?: string }> {
    const { canGoLive, isProfileComplete } = await this.getOnboardingProgress(companyId);
    if (isProfileComplete) return { ok: true };
    if (!canGoLive) return { ok: false, error: "Complete at least Company Profile and Knowledge Base before going live." };
    if (this.supabase) {
      await this.supabase.from("companies").update({ is_profile_complete: true }).eq("id", companyId);
    } else {
      const c = this.store.companies.find((x) => x.id === companyId);
      if (c) c.isProfileComplete = true;
    }
    return { ok: true };
  }
}
