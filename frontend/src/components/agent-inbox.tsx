import { useEffect, useState } from "react";
import { AgentInboxRow } from "@/components/agent-inbox-row";
import { AgentTerminalView } from "@/components/agent-terminal-view";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import { canAttachChat } from "@/lib/agent-runtime";
import { filterInboxAgents, groupInbox } from "@/lib/inbox";
import type { AgentTreeNode } from "@/lib/types";

/** The live-agent portion of the unified inbox: next-action groups (Needs you,
 * Working, Ready for review, Done) rendered above the calm Recent chats. Returns
 * null when there are no live agents so the screen is just chats.
 *
 * Row tap OPENS THE FULL CONVERSATION (no preview): pi agents attach the rich
 * RPC chat; terminal agents (codex/claude/hermes/cursor) open a full-screen
 * terminal view. */
export function AgentInbox({ query }: { query: string }) {
  const { snapshot, bridge } = usePiBridge();
  const [terminalAgent, setTerminalAgent] = useState<AgentTreeNode | null>(null);

  const live = snapshot.agents.filter((a) => a.status !== "closed");

  // Poll while there are live agents so status/new-agents stay fresh. listAgents
  // is TTL-cached bridge-side, so a 5s poll is cheap.
  useEffect(() => {
    if (live.length === 0) return;
    const t = window.setInterval(() => bridge.listAgents(), 5000);
    return () => window.clearInterval(t);
  }, [live.length, bridge]);

  const open = (agent: AgentTreeNode) => {
    if (canAttachChat(agent.runtime)) {
      bridge.attachToAgent(agent); // pi → full rich RPC chat (view switches to agent-chat)
    } else {
      setTerminalAgent(agent); // terminal runtime → full-screen terminal view
    }
  };

  const closeTerminal = () => {
    setTerminalAgent(null);
    bridge.closePeek();
  };

  // Re-look-up by id each render so status/surface stay live while the sheet
  // is open (the 5s poll replaces snapshot.agents wholesale, so the object
  // captured at tap time goes stale otherwise). Fall back to the stale
  // object if the agent has dropped out of the live list (e.g. closed).
  const liveTerminalAgent = terminalAgent
    ? (snapshot.agents.find((a) => a.id === terminalAgent.id) ?? terminalAgent)
    : null;

  const sections = groupInbox(filterInboxAgents(live, query));

  if (sections.length === 0 && !terminalAgent) return null;

  return (
    <>
      {sections.map((section) => {
        const rootCount = section.agents.filter((a) => a.depth === 0).length;
        return (
          <section key={section.key} className="mb-1">
            <div className="flex items-center gap-2 px-2 pb-1 pt-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-concrete">{section.label}</span>
              <span className="text-[11px] tabular-nums text-concrete">{rootCount}</span>
            </div>
            <div className="pl-1">
              {section.agents.map((a) => (
                <AgentInboxRow key={a.id} agent={a} onOpen={open} />
              ))}
            </div>
          </section>
        );
      })}
      {liveTerminalAgent ? <AgentTerminalView agent={liveTerminalAgent} onClose={closeTerminal} /> : null}
    </>
  );
}
