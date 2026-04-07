"use client";

import dynamic from "next/dynamic";
import { useCallback } from "react";
import { EVENTS, STATUS, type EventData, type Controls } from "react-joyride";
import { TOUR_STEPS } from "./tourSteps";
import { TourTooltip } from "./TourTooltip";
import { useOnboardingStore } from "@/store/onboarding-store";

const Joyride = dynamic(
  () => import("react-joyride").then((mod) => mod.Joyride),
  { ssr: false },
);

export function RaceOSTour() {
  const { isTourRunning, tourStepIndex, setStepIndex, completeTour } =
    useOnboardingStore();

  const handleEvent = useCallback(
    (data: EventData, _controls: Controls) => {
      const { type, index, status } = data;

      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        completeTour();
        return;
      }

      if (type === EVENTS.STEP_AFTER) {
        setStepIndex(index + 1);
      }
    },
    [completeTour, setStepIndex],
  );

  return (
    <Joyride
      steps={TOUR_STEPS}
      run={isTourRunning}
      stepIndex={tourStepIndex}
      continuous
      scrollToFirstStep
      tooltipComponent={TourTooltip}
      onEvent={handleEvent}
      options={{
        buttons: ["back", "close", "primary", "skip"],
        overlayClickAction: false,
        primaryColor: "#E10600",
        overlayColor: "rgba(0, 0, 0, 0.7)",
      }}
    />
  );
}
