import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import ChatTextInput from "./ChatTextInput";
import { PdfIcon } from "@/icons/pdfIcon";
import GoogleDocIcon from "@/icons/GoogleDocIcon";
import { isWordFileUrl } from "@/utils/attachmentUtils";
import { truncate } from "../historyPageComponents/AssistFile";
import { AlertIcon } from "@/components/Icons";
import {
  ExternalLink,
  PlayIcon,
  Wrench,
  Save,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
import { extractErrorMessage } from "@/utils/utility";
import { DEFAULT_STARTER_QUESTIONS } from "@/utils/enums";
import { useDispatch } from "react-redux";
import { useCustomSelector } from "@/customHooks/customSelector";
import Protected from "../Protected";
import ReactMarkdown from "../LazyMarkdown";
import useRtLayerEventHandler from "@/customHooks/useRtLayerEventHandler";
import { getStoredGtwyUserId } from "@/utils/internalAuth";
import { initializeChatChannel, editChatMessage, setChatLoading, clearChatMessages } from "@/store/action/chatAction";
import RenderNode from "../richUI/RenderNode";
import ReasoningAccordion from "./ReasoningAccordion";
import ReviewPhaseAccordion from "./ReviewPhaseAccordion";
import { mdComponentsDark, mdRemarkPlugins, mdProseClass } from "@/utils/markdownComponents";

const mdComponents = mdComponentsDark;

const isRichUiMessage = (message) => {
  if (!message || !message.content) return false;
  if (message.type === "richui_json" || message.type === "template") return true;

  let content = message.content;
  if (typeof content === "string") {
    const trimmed = content.trim();
    if (
      trimmed.startsWith("{") &&
      trimmed.includes('"type"') &&
      (trimmed.includes('"Card"') || trimmed.includes('"Title"') || trimmed.includes('"children"'))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        return parsed && (parsed.type === "Card" || parsed.type === "template" || Array.isArray(parsed.children));
      } catch {
        return false;
      }
    }
  } else if (typeof content === "object") {
    return content.type === "Card" || content.type === "template" || Array.isArray(content.children);
  }
  return false;
};

const ChatImage = ({ src, alt, onClick }) => {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div
      className={`relative group cursor-pointer inline-flex flex-col w-full max-w-[250px] sm:max-w-[400px] rounded-lg overflow-hidden border-2 border-stroke shadow-sm transition-all duration-300 ${isLoading ? "skeleton min-h-[200px] bg-base-300/50" : "bg-base-200/50"}`}
      onClick={onClick}
    >
      <img
        src={src}
        alt={alt}
        className={`w-full h-auto transition-opacity duration-300 ${isLoading ? "opacity-0" : "opacity-100"}`}
        onLoad={() => setIsLoading(false)}
      />
    </div>
  );
};

/**
 * Execution time for a turn. The backend is not consistent about which key it
 * sends — model execution time is the figure worth showing, but only
 * `over_all_time` arrives on some responses, so every known shape is tried
 * rather than silently rendering nothing.
 */
const resolveExecutionTime = (latency) => {
  if (typeof latency === "number") return latency > 0 ? latency : null;
  if (!latency || typeof latency !== "object") return null;
  const candidates = [latency.model_execution_time, latency.execution_time, latency.over_all_time, latency.total_time];
  const found = candidates.find((value) => Number(value) > 0);
  return found === undefined ? null : Number(found);
};

/** The other timings go in the tooltip so the line stays one figure wide. */
const buildLatencyTitle = (latency) => {
  if (!latency || typeof latency !== "object") return undefined;
  const parts = [];
  if (Number(latency.model_execution_time) > 0)
    parts.push(`Model: ${Number(latency.model_execution_time).toFixed(2)}s`);
  if (Number(latency.over_all_time) > 0) parts.push(`Overall: ${Number(latency.over_all_time).toFixed(2)}s`);
  return parts.length ? parts.join(" · ") : undefined;
};

function StreamingMessage({ content, isStreaming }) {
  const displayContent = isStreaming ? content + "\u200B" : content;

  return (
    <div className={mdProseClass.dark}>
      <ReactMarkdown components={mdComponents} remarkPlugins={mdRemarkPlugins}>
        {displayContent}
      </ReactMarkdown>
      {isStreaming && <span className="rg-chat-caret" />}
    </div>
  );
}

function ToolCallItem({ toolCall, isMessageComplete }) {
  const [open, setOpen] = useState(false);

  // Auto-open when streaming content starts arriving during tool call
  useEffect(() => {
    if (toolCall.status === "calling" && toolCall.streamingContent) setOpen(true);
  }, [toolCall.status, toolCall.streamingContent]);

  // Auto-open when result arrives
  useEffect(() => {
    if (toolCall.status === "done") setOpen(true);
  }, [toolCall.status]);

  useEffect(() => {
    if (isMessageComplete) setOpen(false);
  }, [isMessageComplete]);

  let parsedResult = null;
  if (toolCall.result) {
    try {
      parsedResult = JSON.parse(toolCall.result);
    } catch {
      parsedResult = toolCall.result;
    }
  }

  const hasBody = toolCall.status === "done" ? !!toolCall.result : !!toolCall.streamingContent;
  const canToggle = hasBody;

  return (
    <div className="rounded-lg border-2 border-stroke bg-base-200 text-xs overflow-hidden">
      <div
        className={`flex items-center gap-2 px-3 py-1.5 select-none ${canToggle ? "cursor-pointer" : "cursor-default"}`}
        onClick={() => canToggle && setOpen((v) => !v)}
      >
        {toolCall.status === "calling" ? (
          <span className="loading loading-spinner loading-xs text-primary" />
        ) : (
          <Wrench className="h-3.5 w-3.5 text-success shrink-0" />
        )}
        <span className=" font-medium truncate flex-1">{toolCall.name}</span>
        {!canToggle ? (
          <span className="text-base-content/50 italic">calling…</span>
        ) : open ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        )}
      </div>
      {open && hasBody && (
        <div className="border-t-2 border-stroke px-3 py-2 bg-base-100 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
          {toolCall.status === "done" ? (
            // Final tool result
            typeof parsedResult === "object" ? (
              JSON.stringify(parsedResult, null, 2)
            ) : (
              String(parsedResult)
            )
          ) : (
            // Live streaming output while the tool is executing
            <span className="text-base-content/70">{toolCall.streamingContent}</span>
          )}
        </div>
      )}
    </div>
  );
}

function Chat({ params, userMessage, isOrchestralModel = false, searchParams, isEmbedUser, draftPrompt }) {
  const messagesContainerRef = useRef(null);
  const attachScrollListener = useCallback((el) => {
    if (!el) return;
    messagesContainerRef.current = el;
    const onScroll = () => {
      isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_NEAR_BOTTOM_THRESHOLD;
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  const isAtBottomRef = useRef(true);
  const dispatch = useDispatch();
  const inputRef = useRef(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editContent, setEditContent] = useState("");
  const originalEditContentRef = useRef("");
  const [isDragging, setIsDragging] = useState(false);
  const uploadRef = useRef(null);

  // Get published version ID from Redux store
  const publishedVersionId = useCustomSelector(
    (state) => state?.bridgeReducer?.allBridgesMap?.[params?.id]?.published_version_id
  );

  /**
   * The RTLayer channel the playground listens on. It has to match what the backend
   * publishes to exactly, which is `{org}_{bridge}_{version}_{user}` — see
   * modelRouter.py's playground branch. The user id was missing here, so a non-streaming
   * playground run answered on a channel nobody was subscribed to: the request returned
   * 200, the model produced its answer, and the pane stayed empty.
   *
   * Embed sessions keep the id in sessionStorage, a normal login keeps it in the user
   * details; the session value wins because that is the token the API call is made with.
   */
  const userDetailsId = useCustomSelector((state) => state?.userDetailsReducer?.userDetails?.id);
  // Read on every render, not memoized: the embed login writes the session value after this
  // component can already be mounted, and a memo keyed on the redux id would keep the
  // empty first value and subscribe to a channel with no user id on it.
  const currentUserId = getStoredGtwyUserId() || userDetailsId || "";

  const channelIdentifier = useMemo(() => {
    const isPublished = searchParams?.isPublished === "true";
    const versionPart = isPublished ? publishedVersionId : searchParams?.version;
    return (params.org_id + "_" + params?.id + "_" + versionPart + "_" + currentUserId).replace(/ /g, "_");
  }, [params, searchParams, publishedVersionId, currentUserId]);

  // Redux selectors for chat state
  const { messages, finishReasonDescription, starterQuestions, defaultQuestions, bridgeName } = useCustomSelector(
    (state) => {
      const versionData = state?.bridgeReducer?.bridgeVersionMapping?.[params?.id]?.[searchParams?.version];
      const bridgeData = state?.bridgeReducer?.allBridgesMap?.[params?.id];
      const isPublished = searchParams?.isPublished === "true";
      return {
        messages: state?.chatReducer?.messagesByChannel?.[channelIdentifier] || [],
        finishReasonDescription: state?.flowDataReducer?.flowData?.finishReasonsData || [],
        variablesKeyValue:
          state?.variableReducer?.VariableMapping?.[params?.id]?.[searchParams?.version]?.variables || [],
        prompt: versionData?.configuration?.prompt,
        showVariables: state?.appInfoReducer?.embedUserDetails?.showVariables || false,
        starterQuestions: (isPublished ? bridgeData?.starterQuestion : versionData?.starterQuestion) || [],
        // Agent-generated suggestions, saved alongside starterQuestion on the version.
        defaultQuestions: (isPublished ? bridgeData?.defaultQuestions : versionData?.defaultQuestions) || [],
        bridgeName: bridgeData?.name || "",
        modelType: isPublished ? bridgeData?.configuration?.type : versionData?.configuration?.type,
      };
    }
  );

  // Starter questions: use bridge-level configured ones, fall back to defaults
  /** Same letter the update pane shows, so one agent reads as one identity. */
  const agentInitial = useMemo(() => (bridgeName || "Agent").trim().charAt(0).toUpperCase(), [bridgeName]);

  /**
   * Whatever this agent actually has, best first: the questions someone wrote,
   * then the ones generated for it, then a generic set.
   *
   * `IsstarterQuestionEnable` is deliberately not consulted — it governs whether
   * the deployed chatbot greets users with these, not whether the playground can
   * offer them. Agents ship with starterQuestion filled and the toggle off, and
   * gating on it left this card empty for them.
   */
  const displayStarterQuestions = useMemo(() => {
    const clean = (list) => (Array.isArray(list) ? list.filter((q) => typeof q === "string" && q.trim()) : []);
    const configured = clean(starterQuestions);
    if (configured.length) return configured;
    const generated = clean(defaultQuestions);
    return generated.length ? generated : DEFAULT_STARTER_QUESTIONS;
  }, [starterQuestions, defaultQuestions]);

  // Initialize channel and RT layer
  useEffect(() => {
    if (channelIdentifier) {
      dispatch(initializeChatChannel(channelIdentifier));
    }
  }, [channelIdentifier, dispatch]);

  useRtLayerEventHandler(channelIdentifier);

  const SCROLL_NEAR_BOTTOM_THRESHOLD = 50;

  const messagesCount = messages.length;

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      isAtBottomRef.current = true;
    }
  }, [messagesCount]);

  // MutationObserver: fires on every DOM change inside the container (text appended,
  // nodes added). This catches Immer in-place mutations during streaming that
  // never change React refs and would be missed by useEffect dependencies.
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;

    const observer = new MutationObserver(() => {
      if (isAtBottomRef.current) {
        el.scrollTop = el.scrollHeight;
      }
    });

    observer.observe(el, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  const handleResetChatRef = useRef(null);
  const handleResetChat = () => {
    if (channelIdentifier) {
      dispatch(clearChatMessages(channelIdentifier));
      // Clear loading state from send button
      dispatch(setChatLoading(channelIdentifier, false));
    }
    setEditingMessage(null);
    setEditContent("");

    // Focus on input field after reset
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
  };
  handleResetChatRef.current = handleResetChat;
  const handleSaveEdit = (messageId) => {
    if (!editContent.trim()) {
      return;
    }
    if (editContent === originalEditContentRef.current) {
      return;
    }
    if (channelIdentifier) {
      dispatch(editChatMessage(channelIdentifier, messageId, editContent));
    }
    setEditingMessage(null);
    setEditContent("");
    originalEditContentRef.current = "";
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditContent("");
    originalEditContentRef.current = "";
  };

  /** "New thread" lives in the tab bar above this pane, so it asks over an event. */
  useEffect(() => {
    const onNewThread = () => handleResetChatRef.current?.();
    window.addEventListener("gtwy:new-thread", onNewThread);
    return () => window.removeEventListener("gtwy:new-thread", onNewThread);
  }, []);

  // Handle userMessage prop - automatically send message and create Redux entry
  const handleSendMessageRef = useRef(null);

  useEffect(() => {
    if (userMessage && userMessage.trim() !== "") {
      if (handleSendMessageRef.current && inputRef.current) {
        inputRef.current.value = userMessage;
        setTimeout(() => {
          handleSendMessageRef.current(null, true); // Pass forceRun=true
        }, 50);

        // Clear the input field after sending
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.value = "";
          }
        }, 200);
      } else {
        console.warn("[Chat] Missing handleSendMessageRef or inputRef");
      }
    }
  }, [userMessage]);

  // Opens the embedded chatbot panel and sends any necessary data beforehand

  // ----------------- RICH UI ACTIONS -----------------
  const handleRichUIActions = (event) => {
    // Event delegation: find closest element with data-action
    const target = event.target.closest("[data-action]");
    if (!target) return;

    event.preventDefault();

    const actionDataStr = target.getAttribute("data-action");
    const elementId = target.getAttribute("id");
    try {
      const actionPayload = JSON.parse(actionDataStr);
      // 1. Show loading state
      target.classList.add("loading", "loading-spinner", "btn-disabled"); // DaisyUI classes

      // 2. Send to parent
      if (typeof window !== "undefined") {
        window.parent.postMessage(
          {
            type: "GTWY_ACTION",
            payload: actionPayload,
            elementId: elementId,
          },
          "*"
        );
      }
    } catch (e) {
      console.error("Failed to parse action data", e);
    }
  };

  // ----------------- DRAG AND DROP HANDLERS -----------------
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    if (e.dataTransfer?.types?.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    if (uploadRef.current && uploadRef.current.uploadFiles) {
      const files = Array.from(e.dataTransfer.files);
      uploadRef.current.uploadFiles(files);
    }
  }, []);

  const _renderMessageAttachments = (message) => {
    // Check for both image_urls (user images) and llm_urls (assistant images)
    const isAssistant = message?.sender === "assistant" || message?.role === "assistant";
    const hasUserImages = !isAssistant && Array.isArray(message?.image_urls) && message.image_urls.length > 0;
    const hasLlmImages = Array.isArray(message?.llm_urls) && message.llm_urls.length > 0;
    const hasFiles = Array.isArray(message?.files) && message.files.length > 0;
    const hasVideo = Boolean(message?.video_data);
    const hasYoutube = Boolean(message?.youtube_url);

    if (!hasUserImages && !hasLlmImages && !hasFiles && !hasVideo && !hasYoutube) {
      return null;
    }

    return (
      <div className="mt-3 flex flex-col gap-3">
        {/* User images - only show for non-assistant messages */}
        {hasUserImages && (
          <div className="flex flex-wrap gap-2">
            {message.image_urls.map((url, imgIndex) =>
              typeof url === "string" && url ? (
                <Image
                  key={`user-img-${imgIndex}`}
                  src={url}
                  alt={`User Image ${imgIndex + 1}`}
                  width={80}
                  height={80}
                  className="w-20 h-20 object-cover rounded-lg cursor-pointer"
                  onClick={() => window.open(url, "_blank")}
                />
              ) : null
            )}
          </div>
        )}

        {/* LLM/Assistant images */}
        {hasLlmImages && (
          <div className="flex flex-wrap gap-4 mt-1">
            {message.llm_urls.map((urlObj, imgIndex) => {
              const imageUrl = typeof urlObj === "string" ? urlObj : urlObj?.url;
              const isImage = typeof urlObj === "string" || urlObj?.type === "image";

              return imageUrl && isImage ? (
                <ChatImage
                  key={`llm-img-${imgIndex}`}
                  src={imageUrl}
                  alt={`Generated Image ${imgIndex + 1}`}
                  onClick={() => window.open(imageUrl, "_blank")}
                />
              ) : null;
            })}
          </div>
        )}

        {hasVideo && (
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <video
                src={message.video_data?.uri}
                width={160}
                height={120}
                className="w-40 h-30 object-cover rounded-lg cursor-pointer"
                controls
                preload="metadata"
                onClick={() => window.open(message.video_data?.uri, "_blank")}
              />
              <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">Video</div>
            </div>
          </div>
        )}

        {hasYoutube && (
          <div className="bg-base-200 p-3 rounded-lg border-2 border-stroke">
            <div className="flex items-center gap-2 mb-2">
              <PlayIcon size={16} className="text-red-500" />
              <span className="text-sm font-medium">YouTube Video</span>
            </div>
            <a
              data-testid="chat-youtube-link"
              id="chat-youtube-link"
              href={message.youtube_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-acc hover:underline block truncate"
            >
              {message.youtube_url}
            </a>
          </div>
        )}

        {hasFiles && (
          <div className="flex flex-wrap gap-2 bg-base-200 p-2 rounded-md">
            {message.files.map((url, fileIndex) =>
              typeof url === "string" && url ? (
                <a
                  data-testid={`chat-file-link-${fileIndex}`}
                  id={`chat-file-link-${fileIndex}`}
                  key={fileIndex}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 hover:underline"
                >
                  {isWordFileUrl(url) ? <GoogleDocIcon height={20} width={20} /> : <PdfIcon height={20} width={20} />}
                  <span className="text-sm overflow-hidden truncate max-w-[10rem]">
                    {truncate(url.split("/").pop(), 20)}
                  </span>
                </a>
              ) : null
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      data-testid="chat-container"
      id="chat-container"
      className="flex flex-col h-full w-full bg-base-100 relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
    >
      {/* Drag and Drop Overlay */}
      {isDragging && (
        <div
          data-testid="chat-drag-overlay"
          id="chat-drag-overlay"
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="absolute inset-0 bg-base-200/90 border-4 border-dashed border-primary flex items-center justify-center z-50 backdrop-blur-sm"
        >
          <div className="pointer-events-none flex flex-col items-center gap-3 bg-base-100 p-6 rounded-xl shadow-2xl border border-primary/20">
            <span className="loading loading-spinner loading-md text-primary"></span>
            <span className="text-primary font-semibold text-lg">Drop files here to upload to Chat</span>
          </div>
        </div>
      )}
      <div
        data-testid="chat-content-wrapper"
        id="chat-content-wrapper"
        className="flex flex-1 overflow-hidden relative px-4"
      >
        {/* Chat Section */}
        <div
          data-testid="chat-messages-section"
          id="chat-messages-section"
          className="w-full flex-grow min-w-0 relative"
        >
          <div className="sm:p-2 justify-between flex flex-col h-full min-h-0 w-full z-low">
            <div
              data-testid="chat-messages-container"
              id="chat-messages-container"
              ref={attachScrollListener}
              className="rg-chat-scroll flex w-full min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto overflow-x-hidden scrollbar-thumb-blue scrollbar-thumb-rounded scrollbar-track-blue-lighter scrollbar-w-1"
              onClick={handleRichUIActions}
            >
              {/* Empty state: the agent's calling card, then its starter orders. */}
              {messages.length === 0 && (
                <div
                  data-testid="chat-starter-questions"
                  id="chat-starter-questions"
                  className="flex h-full flex-1 items-center justify-center p-2"
                >
                  <div className="rg-chat-card">
                    <div className="rg-chat-card-head">
                      <span className="rg-chat-card-avatar">{agentInitial}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-base-content">
                          {bridgeName || "This agent"}
                        </span>
                        <span className="rg-chat-eyebrow block">standing by</span>
                      </span>
                      <span className="rg-chat-live" aria-hidden="true" />
                    </div>

                    <div className="p-4">
                      {displayStarterQuestions.length > 0 && (
                        <>
                          <div className="rg-chat-eyebrow pb-2.5">Give it an order</div>
                          <div className="flex flex-col gap-1.5">
                            {displayStarterQuestions.slice(0, 4).map((question, i) => (
                              <button
                                key={i}
                                type="button"
                                data-testid={`chat-starter-question-${i}`}
                                id={`chat-starter-question-${i}`}
                                className="rg-chat-starter transition-colors duration-150"
                                onClick={() => {
                                  if (handleSendMessageRef.current && inputRef.current) {
                                    inputRef.current.value = question;
                                    setTimeout(() => handleSendMessageRef.current(null, true), 50);
                                    setTimeout(() => {
                                      if (inputRef.current) inputRef.current.value = "";
                                    }, 200);
                                  }
                                }}
                              >
                                <ChevronRight size={14} className="flex-none opacity-40" />
                                <span className="min-w-0 flex-1">{question}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                      <div className="pt-3 text-[11.5px] leading-relaxed text-soft">
                        Runs against your unsaved prompt, so the live version stays untouched.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {messages.map((message, index) => {
                return (
                  <div
                    data-testid={`chat-message-${index}`}
                    id={`chat-message-${index}`}
                    key={index}
                    className={`show-on-hover rg-chat-row ${message.sender === "user" ? "rg-chat-row-mine mt-2" : ""}`}
                  >
                    <div className={`flex w-full flex-col ${message.sender === "user" ? "items-end" : "items-start"}`}>
                      {/* Shown while the agent is still answering too — the design
                          canvas keeps the avatar and name above the thinking dots,
                          and hiding them left the dots floating unattributed. */}
                      <div className="rg-chat-sender">
                        <span
                          className={`rg-chat-avatar ${message.sender === "user" ? "rg-chat-avatar-mine" : ""}`}
                          aria-hidden="true"
                        >
                          {message.sender === "user" ? "Y" : agentInitial}
                        </span>
                        {/* The agent answers as itself, not as "assistant" — the
                            canvas labels the turn with the ranger's own name. */}
                        <span>
                          {message.sender === "error"
                            ? "error"
                            : message.sender === "user"
                              ? "you"
                              : bridgeName || message.sender}
                        </span>
                        {message.isEdited && <span className="text-warning">(edited)</span>}
                        {!(message.sender === "assistant" && message.isLoading && !message.content) && (
                          <time className="whitespace-nowrap opacity-70">{message.time}</time>
                        )}
                      </div>

                      {message?.sender === "assistant" &&
                        message?.finish_reason &&
                        message.finish_reason !== "completed" &&
                        message.finish_reason !== "no_reason" && (
                          <div className="my-1">
                            <div className="max-w-[30rem] bg-base-200/50 border border-warning/20 rounded-md px-3 py-1.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <AlertIcon size={12} className="text-warning flex-shrink-0" />
                                  <span className="text-xs text-base-content/80 leading-tight">
                                    {finishReasonDescription[message.finish_reason]}
                                  </span>
                                </div>
                                <a
                                  href="https://app.docstar.io/p/finish-reasons?collectionId=inYU67SKiHgW"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-warning/70 hover:text-warning transition-colors flex-shrink-0 ml-2"
                                  title="More details"
                                >
                                  <ExternalLink size={10} />
                                </a>
                              </div>
                            </div>
                          </div>
                        )}
                    </div>

                    {message?.sender === "tools_call" && message?.tools_call_data && (
                      <div className="flex flex-wrap items-center gap-2">
                        {Object.entries(message.tools_call_data).map(([functionName]) => (
                          <span key={functionName} className="rg-chat-trace rg-anim-in" title={functionName}>
                            <Wrench size={12} className="opacity-60" />
                            <span className="truncate">{functionName}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {(message.sender === "user" ||
                      message.sender === "assistant" ||
                      message.sender === "expected" ||
                      message.sender === "error") &&
                      (message?.content ||
                        message?.isLoading ||
                        message?.llm_urls?.length > 0 ||
                        message?.image_urls?.length > 0) && (
                        <div
                          className={`flex gap-2 show-on-hover ${message.sender === "user" ? "justify-end" : "justify-start"} w-full max-w-[720px] min-w-0 ${message?.content?.length > 100 ? "items-end" : "items-center"} relative ${editingMessage === message.id && message.sender === "assistant" ? "w-[500px]" : ""}`}
                        >
                          <div
                            className={`flex flex-col ${message.sender === "assistant" ? "w-full min-w-0" : "w-fit max-w-[78%] shrink-0"}`}
                          >
                            <div
                              data-testid={`playground-ai-response-message-${message.id}`}
                              className={`relative justify-start ${
                                message.sender === "assistant"
                                  ? `${message.content ? "rg-chat-bubble" : ""} !max-w-full`
                                  : message.sender === "error"
                                    ? "w-full overflow-hidden rounded-[14px] border border-error bg-error/10 px-4 py-3 text-sm text-error"
                                    : "rg-chat-bubble rg-chat-bubble-mine !max-w-full whitespace-pre-wrap"
                              } ${isRichUiMessage(message) ? "!bg-transparent !shadow-none !p-0 !border-0" : ""}`}
                            >
                              {/* Edit Mode */}
                              {editingMessage === message.id ? (
                                <div className="w-full">
                                  <textarea
                                    data-testid="chat-edit-textarea"
                                    id="chat-edit-textarea"
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    className="textarea textarea-bordered w-full min-h-[100px] resize-y text-base-content bg-base-100"
                                    placeholder="Edit message content..."
                                  />
                                  <div className="flex gap-2 mt-2">
                                    <button
                                      data-testid="chat-save-edit-button"
                                      id="chat-save-edit-button"
                                      onClick={() => handleSaveEdit(message.id)}
                                      disabled={!editContent.trim() || editContent === originalEditContentRef.current}
                                      className="btn btn-sm btn-success disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      <Save className="h-3 w-3" />
                                      Save
                                    </button>
                                    <button
                                      data-testid="chat-cancel-edit-button"
                                      id="chat-cancel-edit-button"
                                      onClick={handleCancelEdit}
                                      className="btn btn-sm btn-error"
                                    >
                                      <X className="h-3 w-3" />
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                /* Display Mode */
                                <div>
                                  <div
                                    className={`relative group flex flex-col ${message.sender === "user" ? "w-fit" : "w-full"}`}
                                  >
                                    {/* Retried / Fallback block inside bubble at the top */}
                                    {message?.sender === "assistant" && message?.fallback && (
                                      <div className="select-none mb-3 w-full">
                                        <div className="text-primary rounded-lg text-[10px] border border-primary/20 overflow-hidden transition-all duration-200 hover:bg-base-200/90 flex flex-col w-full bg-base-300/10">
                                          <input
                                            autoComplete="off"
                                            id={`retry-${message.id}`}
                                            type="checkbox"
                                            className="peer hidden"
                                          />
                                          <label
                                            htmlFor={`retry-${message.id}`}
                                            className="px-3 py-1.5 cursor-pointer flex items-center gap-1 transition-all duration-200 hover:bg-base-300/20 peer-checked:bg-base-300/30 font-semibold"
                                          >
                                            <span className="opacity-80">↻</span>
                                            <span>Retried with</span>
                                            <span className="text-primary">{message?.modelName}</span>
                                          </label>
                                          <div className="max-h-0 peer-checked:max-h-96 transition-all duration-300 ease-in-out overflow-hidden bg-base-300/10">
                                            <pre className="text-xs text-error/90 whitespace-pre-wrap px-3 py-2.5 leading-relaxed ">
                                              {extractErrorMessage(message.firstAttemptError)}
                                            </pre>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Review phase accordion (shown when agent has a reviewer configured) */}
                                    {message.review_phases?.length > 0 && (
                                      <ReviewPhaseAccordion reviewPhases={message.review_phases} />
                                    )}

                                    {/* Reasoning accordion (shown when model emits reasoning events) */}
                                    {message.reasoning && (
                                      <ReasoningAccordion
                                        reasoning={message.reasoning}
                                        isStreaming={!!(message.isStreaming || message.isLoading)}
                                        messageContent={message.content}
                                      />
                                    )}

                                    {/* Tool calls (tool_call / tool_result events) */}
                                    {message.toolCalls?.length > 0 && (
                                      <div className="flex flex-col gap-1 mb-2">
                                        {message.toolCalls.map((tc) => (
                                          <ToolCallItem
                                            key={tc.call_id}
                                            toolCall={tc}
                                            isMessageComplete={!message.isStreaming && !message.isLoading}
                                          />
                                        ))}
                                      </div>
                                    )}

                                    {/* Loading state for assistant message */}
                                    {message.isLoading && !message.content && !message.toolCalls?.length ? (
                                      <div data-testid="chat-loading-state" className="rg-chat-thinking rg-anim-in">
                                        <span className="rg-chat-dot" />
                                        <span className="rg-chat-dot" />
                                        <span className="rg-chat-dot" />
                                        <span className="rg-chat-sweep" />
                                      </div>
                                    ) : message.isStreaming && message.content ? (
                                      <StreamingMessage content={message.content} isStreaming={message.isStreaming} />
                                    ) : message.sender === "error" ? (
                                      /* Error Message - Display with error styling and icon */
                                      <div className="flex min-w-0 items-start gap-2">
                                        <AlertTriangle className="h-4 w-4 text-error flex-shrink-0 mt-0.5" />
                                        <div className="min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-error font-medium">
                                          {extractErrorMessage(message.content)}
                                        </div>
                                      </div>
                                    ) : (
                                      /* Regular message with markdown */
                                      <div className={message.sender === "assistant" ? mdProseClass.dark : undefined}>
                                        <ReactMarkdown components={mdComponents} remarkPlugins={mdRemarkPlugins}>
                                          {!isRichUiMessage(message)
                                            ? (() => {
                                                const raw = message.content;
                                                return typeof raw === "string"
                                                  ? raw
                                                  : raw != null
                                                    ? JSON.stringify(raw)
                                                    : "";
                                              })()
                                            : ""}
                                        </ReactMarkdown>
                                      </div>
                                    )}

                                    {isRichUiMessage(message) && message?.content && (
                                      <div className="mt-4 richui-container w-full">
                                        {(() => {
                                          let parsedContent = message.content;
                                          if (typeof message.content === "string") {
                                            try {
                                              parsedContent = JSON.parse(message.content);
                                            } catch (e) {
                                              console.error("Failed to parse richui_json content", e);
                                            }
                                          }
                                          return (
                                            <RenderNode
                                              node={parsedContent}
                                              onAction={(action) => {
                                                if (action?.type === "reply" && action?.text) {
                                                  if (handleSendMessageRef.current && inputRef.current) {
                                                    // Set the input field value and triggers send
                                                    inputRef.current.value = action.text;
                                                    setTimeout(() => {
                                                      handleSendMessageRef.current(null, true);
                                                    }, 50);
                                                    // Clear the input field after sending
                                                    setTimeout(() => {
                                                      if (inputRef.current) {
                                                        inputRef.current.value = "";
                                                      }
                                                    }, 200);
                                                  } else {
                                                    console.warn("[Chat] handleSendMessageRef or inputRef is missing", {
                                                      handleSendMessageRef: handleSendMessageRef.current,
                                                      inputRef: inputRef.current,
                                                    });
                                                  }
                                                }
                                              }}
                                            />
                                          );
                                        })()}
                                      </div>
                                    )}

                                    {/* Render message attachments (images, etc.) */}
                                    {_renderMessageAttachments(message)}
                                  </div>
                                </div>
                              )}
                            </div>
                            {/* Action Buttons Toolbar for Assistant Messages (including Metrics) */}
                            {editingMessage !== message.id && message.sender === "assistant" && !message.isLoading && (
                              <div className="flex items-center justify-between gap-1.5 w-full pr-8">
                                <div className="flex items-center gap-1.5">
                                  {/* Message metrics — the canvas prints these as one
                                      mono line under the answer, not as bordered chips. */}
                                  {(message.usage || message.latency) && (
                                    <div className="rg-chat-meta rg-anim-in select-none">
                                      {message.usage?.total_tokens > 0 && (
                                        <span
                                          title={`In: ${message.usage.input_tokens || 0} · Out: ${message.usage.output_tokens || 0}${message.usage.reasoning_tokens > 0 ? ` · Reasoning: ${message.usage.reasoning_tokens}` : ""}${message.usage.cached_tokens > 0 ? ` · Cached: ${message.usage.cached_tokens}` : ""}`}
                                        >
                                          {message.usage.total_tokens.toLocaleString()} tokens
                                        </span>
                                      )}
                                      {resolveExecutionTime(message.latency) !== null && (
                                        <span title={buildLatencyTitle(message.latency)}>
                                          {resolveExecutionTime(message.latency).toFixed(2)}s
                                        </span>
                                      )}
                                      {message.usage?.cost > 0 && <span>${message.usage.cost.toFixed(4)}</span>}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                );
              })}
            </div>

            <div data-testid="chat-input-wrapper" id="chat-input-wrapper" className="border-stroke pt-4 pb-4 w-full">
              <div className="relative flex flex-col gap-4 w-full">
                <div className="flex flex-row gap-2">
                  <ChatTextInput
                    channelIdentifier={channelIdentifier}
                    params={params}
                    isOrchestralModel={isOrchestralModel}
                    inputRef={inputRef}
                    searchParams={searchParams}
                    handleSendMessageRef={handleSendMessageRef}
                    draftPrompt={draftPrompt}
                    uploadRef={uploadRef}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Protected(Chat);
