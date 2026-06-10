"use client";

import { CheckCircle, Loader } from "lucide-react";
import type { ProjectStatus } from "@/types";
import { STATUS_STEPS } from "@/types";
import { cn } from "@/lib/utils";

interface ProcessingStatusProps {
  status: ProjectStatus;
}

const STEP_ORDER: ProjectStatus[] = [
  "transcribing",
  "analyzing",
  "deciding",
  "editing",
  "rendering",
  "done",
];

export default function ProcessingStatus({ status }: ProcessingStatusProps) {
  const currentIndex = STEP_ORDER.indexOf(status);

  return (
    <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-6">
      <div className="space-y-4">
        {STATUS_STEPS.map((step, i) => {
          const stepIndex = STEP_ORDER.indexOf(step.key);
          const isCompleted = currentIndex > stepIndex;
          const isCurrent = currentIndex === stepIndex;
          const isPending = currentIndex < stepIndex;

          return (
            <div key={step.key} className="flex items-start gap-4">
              {/* Indicator */}
              <div className="shrink-0 mt-0.5">
                {isCompleted ? (
                  <div className="w-6 h-6 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/30 flex items-center justify-center">
                    <CheckCircle size={13} className="text-[#22C55E]" />
                  </div>
                ) : isCurrent ? (
                  <div className="w-6 h-6 rounded-full bg-[#2563EB]/15 border border-[#2563EB]/30 flex items-center justify-center">
                    <Loader size={12} className="text-[#60A5FA] animate-spin" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full border border-[#1F1F1F] flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#2A2A2A]" />
                  </div>
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium transition-colors",
                    isCompleted && "text-[#22C55E]",
                    isCurrent && "text-[#F0EEE9]",
                    isPending && "text-[#4A4846]"
                  )}
                >
                  {step.label}
                </p>
                {isCurrent && (
                  <p className="text-xs text-[#8A8785] mt-0.5 fade-in">{step.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
