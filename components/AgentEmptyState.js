import { MODAL_TYPE } from "@/utils/enums";
import { openModal } from "@/utils/utility";
import { Plus } from "lucide-react";
import { MessageCircleMoreIcon } from "./Icons";
import PageHeader from "./Pageheader";
import Protected from "./Protected";

/**
 * Shown when the current view has no agents to list — an empty folder, or a
 * filter that matched nothing. An org with no agents at all never reaches this:
 * the Rangers page sends it to the onboarding wizard instead.
 *
 * `hideHeader` is set when the host page already renders the page header (the
 * Rangers page does, above its tab strip), so it isn't printed twice.
 */
const AgentEmptyState = ({
  orgid,
  isEmbedUser,
  defaultBridgeType = "trigger",
  title,
  description,
  docLink,
  hideHeader = false,
}) => {
  return (
    <div data-testid="agent-empty-state-container" id="agent-empty-state-container" className=" mt-8 px-4">
      <div className=" mx-2 ">
        {/* Header Section with Overlapping Layout */}
        <div className="relative w-full">
          {/* Full Width - Heading and Description */}
          {hideHeader ? null : !isEmbedUser ? (
            <PageHeader
              title={title || "Welcome To Rangers"}
              description={
                description ||
                "Build and manage AI agents for your workflows. Agents help automate tasks, answer queries, and deliver intelligent assistance."
              }
              docLink={docLink || "https://gtwy.ai/blogs/features/bridge"}
            />
          ) : (
            <PageHeader
              title={title || "Agents"}
              description={
                description ||
                "Build and manage AI agents for your workflows. Agents help automate tasks, answer queries, and deliver intelligent assistance."
              }
              docLink={docLink || "https://gtwy.ai/blogs/features/bridge"}
              isEmbedUser={isEmbedUser}
            />
          )}

          {/* Floating Right - Create Agent Buttons */}
          <div className="absolute top-0 right-0">
            <div className="flex flex-row items-center gap-2">
              <button
                data-testid="agent-empty-create-agent-button"
                id="agent-empty-create-agent-button"
                className="inline-flex flex-none cursor-pointer items-center gap-[7px] rounded-[10px] bg-acc px-4 py-[9px] text-[13.5px] font-bold text-acc-ink shadow-[0_1px_2px_var(--shadow-tint)]"
                onClick={() => {
                  openModal(MODAL_TYPE.CREATE_RANGER_MODAL);
                }}
              >
                <Plus size={15} />
                Create Ranger
              </button>

              {!isEmbedUser ? (
                <button
                  data-testid="agent-empty-speak-to-us-button"
                  id="agent-empty-speak-to-us-button"
                  data-cal-namespace="30min"
                  data-cal-link="human-gtwy-ai/book-a-demo-with-gtwy"
                  data-cal-origin="https://cal.id"
                  data-cal-config='{"layout":"month_view"}'
                  className="inline-flex flex-none cursor-pointer items-center gap-[7px] rounded-[10px] border border-line bg-card px-4 py-[9px] text-[13.5px] font-semibold text-ink"
                >
                  <MessageCircleMoreIcon size={14} />
                  Speak To Us
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Protected(AgentEmptyState);
