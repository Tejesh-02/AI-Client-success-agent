"use client";

const WIZARD_STEPS: { key: string; label: string; sectionId?: string; description?: string }[] = [
  { key: "profile", label: "Company Profile", sectionId: "overview", description: "Set up your company details in the Overview section." },
  { key: "knowledge_base", label: "Knowledge Base", sectionId: "knowledge", description: "Add documents so the AI can answer customer questions." },
  { key: "routing", label: "Routing Config", sectionId: "routing", description: "Configure how tickets are routed by issue type." },
  { key: "team_invite", label: "Team Invite", description: "Invite team members from your account settings." },
  { key: "test_chat", label: "Test Chat", description: "Send a test message in the customer chat widget." }
];

interface OnboardingWizardProps {
  stepsDone: string[];
  canGoLive: boolean;
  onCompleteStep: (key: string) => Promise<void>;
  onGoLive: () => Promise<void>;
  goLiveError: string | null;
  goLiveBusy: boolean;
}

export function OnboardingWizard({
  stepsDone,
  canGoLive,
  onCompleteStep,
  onGoLive,
  goLiveError,
  goLiveBusy
}: OnboardingWizardProps) {
  const nextStepIndex = WIZARD_STEPS.findIndex((s) => !stepsDone.includes(s.key));
  const allDone = nextStepIndex === -1;
  const currentStep = nextStepIndex >= 0 ? WIZARD_STEPS[nextStepIndex] : null;
  const progressLabel = allDone ? "5/5" : `${stepsDone.length}/${WIZARD_STEPS.length}`;

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    el?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="onboarding" className="rounded-xl border border-sky-200 bg-sky-50 p-4">
      <h2 className="text-lg font-semibold text-slate-900">Onboarding</h2>
      <p className="mt-1 text-sm text-slate-600">
        Step-by-step setup. Progress: {progressLabel}
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {allDone ? (
          <>
            <p className="text-sm text-slate-700">All steps complete. You can go live when ready.</p>
            <button
              type="button"
              disabled={!canGoLive || goLiveBusy}
              onClick={() => void onGoLive()}
              className="w-fit rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              aria-label={canGoLive ? "Go live" : "Complete profile and knowledge base first to go live"}
            >
              {goLiveBusy ? "Going live…" : "Go Live"}
            </button>
            {goLiveError ? <p className="text-sm text-red-600" role="alert">{goLiveError}</p> : null}
          </>
        ) : currentStep ? (
          <>
            <p className="font-medium text-slate-900">Step {nextStepIndex + 1}: {currentStep.label}</p>
            {currentStep.description ? (
              <p className="text-sm text-slate-600">{currentStep.description}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {currentStep.sectionId ? (
                <button
                  type="button"
                  onClick={() => scrollToSection(currentStep.sectionId!)}
                  className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-sm text-sky-700 hover:bg-sky-50"
                >
                  Go to section
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void onCompleteStep(currentStep.key)}
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
                aria-label={`Mark ${currentStep.label} as done`}
              >
                Mark done
              </button>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
