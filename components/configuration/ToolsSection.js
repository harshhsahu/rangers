import { memo } from "react";
import KnowledgebaseList from "./configurationComponent/KnowledgebaseList";
import { useConfigurationContext } from "./ConfigurationContext";

const ToolsSection = memo(({ isPublished }) => {
  const { params, searchParams, isEditor } = useConfigurationContext();

  // Tools (EmbedList) is intentionally absent — "Organization tools" in
  // ConnectorsTab is the same list, with connect/disconnect. Connected agents
  // are gone, and MCP servers moved directly under the connector builder.
  return (
    <div data-testid="tools-section-container" id="tools-section-container" className="flex mt-4 gap-4 flex-col">
      <KnowledgebaseList params={params} searchParams={searchParams} isPublished={isPublished} isEditor={isEditor} />
    </div>
  );
});

ToolsSection.displayName = "ToolsSection";

export default ToolsSection;
