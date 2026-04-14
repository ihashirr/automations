export const visitOutcomeOptions = [
  { id: "no_answer", label: "No Answer" },
  { id: "spoke_to_staff", label: "Spoke To Staff" },
  { id: "got_manager_number", label: "Got Number" },
  { id: "met_decision_maker", label: "Met Decision Maker" },
  { id: "follow_up_later", label: "Follow Up Later" },
  { id: "not_a_fit", label: "Not A Fit" },
] as const;

export type VisitOutcome = (typeof visitOutcomeOptions)[number]["id"];

export type VisitOutcomeValue = VisitOutcome | "unknown";

export function isVisitOutcome(value: string): value is VisitOutcome {
  return visitOutcomeOptions.some((option) => option.id === value);
}

export function getVisitOutcomeLabel(value: VisitOutcomeValue | null | undefined) {
  if (!value || value === "unknown") {
    return "Unknown";
  }

  return visitOutcomeOptions.find((option) => option.id === value)?.label ?? "Unknown";
}
