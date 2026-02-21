/**
 * Seed Supabase with one company and one internal user so you can log in.
 * Run after applying the migration. Default password: password123
 *
 * Usage: from backend folder: npx tsx scripts/seed.ts
 *        or from repo root:   npm --workspace backend exec -- npx tsx scripts/seed.ts
 */
import "dotenv/config";
import { getSupabaseAdminClient } from "../src/db/supabaseClient";
import { hashPassword } from "../src/utils/password";

const COMPANY_ID = "company_acme";
const USER_ID = "user_manager_1";
const SEED_PASSWORD = "password123";

async function seed() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Seed skipped.");
    process.exit(1);
  }

  const { error: companyError } = await supabase.from("companies").upsert(
    {
      id: COMPANY_ID,
      name: "Acme Corp",
      slug: "acme",
      support_email: "support@acme.test",
      emergency_email: "emergency@acme.test",
      notification_cc: ["manager@acme.test"],
      is_profile_complete: true
    },
    { onConflict: "id" }
  );

  if (companyError) {
    console.error("Failed to seed company:", companyError.message);
    process.exit(1);
  }
  console.log("Company 'acme' created/updated.");

  const passwordHash = await hashPassword(SEED_PASSWORD);

  const { error: userError } = await supabase.from("users").upsert(
    {
      id: USER_ID,
      company_id: COMPANY_ID,
      email: "manager@acme.test",
      name: "Acme Manager",
      role: "manager",
      password_hash: passwordHash,
      is_active: true
    },
    { onConflict: "id" }
  );

  if (userError) {
    console.error("Failed to seed user:", userError.message);
    process.exit(1);
  }

  console.log("User manager@acme.test created/updated.");

  const defaultIssueTypes = [
    { code: "technical", label: "Technical", sort_order: 0 },
    { code: "billing", label: "Billing", sort_order: 1 },
    { code: "legal", label: "Legal", sort_order: 2 },
    { code: "onboarding", label: "Onboarding", sort_order: 3 },
    { code: "feature", label: "Feature", sort_order: 4 },
    { code: "access", label: "Access", sort_order: 5 },
    { code: "other", label: "Other", sort_order: 6 }
  ];

  for (let i = 0; i < defaultIssueTypes.length; i++) {
    const it = defaultIssueTypes[i];
    const id = `issue_type_${COMPANY_ID}_${it.code}`;
    const { error: itError } = await supabase.from("issue_types").upsert(
      {
        id,
        company_id: COMPANY_ID,
        code: it.code,
        label: it.label,
        primary_email: null,
        cc_emails: [],
        sla_hours: 24,
        enabled: true,
        sort_order: it.sort_order,
        updated_at: new Date().toISOString()
      },
      { onConflict: "id" }
    );
    if (itError) {
      console.warn("Issue type seed warning (table may not exist yet):", itError.message);
      break;
    }
  }
  console.log("Issue types seeded (if table exists).");

  console.log(`Login with: company slug = acme, email = manager@acme.test, password = ${SEED_PASSWORD}`);
}

seed();
