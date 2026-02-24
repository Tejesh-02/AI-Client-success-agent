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
  const nextStepIndex = WIZARD_STEPS.findIndex((step) => !stepsDone.includes(step.key));
  const allDone = nextStepIndex === -1;
  const currentStep = nextStepIndex >= 0 ? WIZARD_STEPS[nextStepIndex] : null;
  const progressLabel = allDone ? "5/5" : `${stepsDone.length}/${WIZARD_STEPS.length}`;

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    element?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="onboarding" className="db-panel" style={{ background: "#f0f9ff", borderColor: "#bfdbfe" }}>
      <h2 className="db-panel-title">Onboarding</h2>
      <p className="mt-1 text-sm text-slate-600">Step-by-step setup. Progress: {progressLabel}</p>
      <div className="mt-3 flex flex-col gap-3">
        {allDone ? (
          <>
            <p className="text-sm text-slate-700">All steps complete. You can go live when ready.</p>
            <button
              type="button"
              disabled={!canGoLive || goLiveBusy}
              onClick={() => void onGoLive()}
              className="db-btn db-btn-primary w-fit"
              aria-label={canGoLive ? "Go live" : "Complete profile and knowledge base first to go live"}
            >
              {goLiveBusy ? "Going live..." : "Go Live"}
            </button>
            {goLiveError ? <p className="text-sm text-red-600" role="alert">{goLiveError}</p> : null}
          </>
        ) : currentStep ? (
          <>
            <p className="font-medium text-slate-900">Step {nextStepIndex + 1}: {currentStep.label}</p>
            {currentStep.description ? <p className="text-sm text-slate-600">{currentStep.description}</p> : null}
            <div className="flex flex-wrap gap-2">
              {currentStep.sectionId ? (
                <button type="button" onClick={() => scrollToSection(currentStep.sectionId!)} className="db-btn db-btn-secondary">
                  Go to section
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void onCompleteStep(currentStep.key)}
                className="db-btn db-btn-primary"
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

