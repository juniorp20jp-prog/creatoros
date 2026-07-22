"use client";

import { useState } from "react";

import { WelcomeStep } from "../steps/WelcomeStep";

type MissionWizardProps = {
  eyebrow: string;
  title: string;
  description: string;
  buttonLabel: string;
};

type WizardStep = "welcome" | "channel";

export function MissionWizard({
  eyebrow,
  title,
  description,
  buttonLabel,
}: MissionWizardProps) {
  const [currentStep, setCurrentStep] =
    useState<WizardStep>("welcome");

  if (currentStep === "welcome") {
    return (
      <WelcomeStep
        eyebrow={eyebrow}
        title={title}
        description={description}
        buttonLabel={buttonLabel}
        onNext={() => setCurrentStep("channel")}
      />
    );
  }

  return (
    <main>
      <h2>Configuración del canal</h2>

      <p>
        El primer paso ya funciona. Ahora construiremos el
        formulario del canal.
      </p>

      <button
        type="button"
        onClick={() => setCurrentStep("welcome")}
      >
        Volver
      </button>
    </main>
  );
}