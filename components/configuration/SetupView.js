import { memo } from "react";
import NonImageModelConfig from "./NonImageModelConfig";

const SetupView = memo(() => {
  return <NonImageModelConfig />;
});

SetupView.displayName = "SetupView";

export default SetupView;
