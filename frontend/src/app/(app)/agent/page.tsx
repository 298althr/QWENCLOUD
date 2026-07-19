"use client";

import AgentConsole from "@/components/AgentConsole";
import { PageHeader, StatusPill } from "@/components/design-system";

export default function AgentPage() {
  return (
    <div className="space-y-xl">
      <PageHeader
        title="AI Assistant"
        description="Send natural-language commands. Watch the Qwen reasoning chain stream live."
        badge={<StatusPill variant="ai" pulse>Qwen-powered</StatusPill>}
      />
      <AgentConsole />
    </div>
  );
}
