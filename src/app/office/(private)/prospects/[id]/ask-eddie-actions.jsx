"use client";

function ask(question, autoSend = true) {
  window.dispatchEvent(new CustomEvent("office:ask-eddie", { detail: { question, autoSend } }));
}

/** @param {{ label: string, prospectId: string, openDeals: Array<{id: string, title?: string}> }} props */
export default function AskEddieActions({ label, prospectId, openDeals = [] }) {
  const target = `${label} (prospect ID ${prospectId})`;
  const actions = [
    { text: "Best next step", question: `Review ${target}. What's the best next step?` },
    { text: "Create follow-up task", question: `Prepare a follow-up task for ${target}.` },
    { text: "Draft response email", question: `Draft a response email for ${target}.` },
    { text: "Schedule follow-up", question: `Prepare a follow-up for next week with ${target}.` },
    ...openDeals.slice(0, 3).map((deal) => ({ text: openDeals.length > 1 ? `Proposal: ${deal.title || "deal"}` : "Prepare proposal", question: `Prepare a customer proposal for ${target}, using deal ID ${deal.id}${deal.title ? ` (${deal.title})` : ""}.` })),
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <button
          key={action.text}
          type="button"
          onClick={() => ask(action.question)}
          className="rounded-lg border border-purple-400/25 bg-purple-500/10 px-3 py-2 text-sm text-purple-200 hover:bg-purple-500/20"
        >
          {action.text}
        </button>
      ))}
    </div>
  );
}
