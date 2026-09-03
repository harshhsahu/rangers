import { CopyIcon as CopyIconComponent, CheckIcon as CheckIconComponent } from "@/components/Icons";
import { Check, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import CodeBlock from "./codeBlock/CodeBlock";
import { mdComponentsLight, mdRemarkPlugins } from "@/utils/markdownComponents";

function Canvas({
  OptimizePrompt,
  width = "100%",
  height = "100%",
  messages,
  setMessages,
  handleApplyOptimizedPrompt = () => {},
  label = "prompt",
  onResetThreadId = () => {},
  apiError = false,
}) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const messagesEndRef = useRef(null);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  /** Matches the avatar letter the test pane shows for the same agent. */
  const agentInitial = (label || "p").trim().charAt(0).toUpperCase();
  const [errorMessage, setErrorMessage] = useState("");
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [appliedMessages, setAppliedMessages] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [showActions, setShowActions] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [messages]);

  const handleResetChat = () => {
    setMessages([]);
    setInstruction("");
    setAppliedMessages("");
    setShowActions(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    // Notify parent to reset thread id used by backend session
    onResetThreadId();
  };

  const handleApply = (message) => {
    // Call the apply function with the optimized content
    if (typeof handleApplyOptimizedPrompt === "function") {
      handleApplyOptimizedPrompt(message.optimized);
    }
    setAppliedMessages(message.id);
  };

  // Helper function to check if content is JSON and format it
  const formatMessageContent = (content) => {
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(content);
      // If successful, return formatted JSON with proper indentation
      return {
        isJson: true,
        formatted: JSON.stringify(parsed, null, 2),
      };
    } catch {
      // If not JSON, return original content
      return {
        isJson: false,
        formatted: content,
      };
    }
  };

  const handleCopy = (messageId, content) => {
    let textToCopy = content || "";

    // If content is an object, stringify it
    if (typeof content === "object" && content !== null) {
      try {
        textToCopy = JSON.stringify(content, null, 2);
      } catch {
        textToCopy = String(content);
      }
    }

    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        setCopiedMessageId(messageId);
        setTimeout(() => {
          setCopiedMessageId(null);
        }, 2000);
      })
      .catch((err) => {
        console.error(err);
      });
  };

  const handleSend = async () => {
    if (!instruction.trim()) {
      setErrorMessage("Please enter an instruction.");
      return;
    }

    const userMessage = {
      id: Date.now(),
      sender: "user",
      content: instruction,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => {
      return [...prev, userMessage];
    });
    setInstruction("");
    setErrorMessage("");
    setShowActions(false);
    setLoading(true);
    try {
      const response = await OptimizePrompt(instruction);
      let result;
      if (label === "Schema") {
        result = typeof response.result === "string" ? JSON.parse(response.result) : response.result;
      } else if (label === "prompt") {
        result = typeof response === "string" ? JSON.parse(response) : response;
      }
      let contentString = "";
      if (result && result.updated !== undefined) {
        contentString = typeof result.updated === "string" ? result.updated : JSON.stringify(result.updated, null, 2);
        setShowActions(true);
      } else {
        contentString = "No content returned from optimization.";
        setShowActions(false);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: "assistant",
          content: contentString,
          optimized: result?.updated,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch (err) {
      console.error("OptimizePrompt call failed", err);
      setShowActions(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: "assistant",
          content: "Please enter a prompt first",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
    setLoading(false);
  };

  const hasMessages = safeMessages.length > 0;

  return (
    <div
      data-testid="canvas-container"
      id="canvas-container"
      style={{ width, height }}
      className="rg-chat-pane flex min-h-0 flex-col"
    >
      {/* Messages */}
      <div id="messages" className="rg-chat-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden" ref={scrollRef}>
        {!hasMessages && !loading ? (
          <div
            data-testid="canvas-empty-state"
            id="canvas-empty-state"
            className="flex h-full flex-col items-center justify-center gap-3.5 text-center"
          >
            <span className="rg-chat-card-avatar">{agentInitial}</span>
            <p className="text-[14.5px] text-soft">Start a conversation to optimize your {label}</p>
          </div>
        ) : (
          <div className="rg-chat-stack">
            {safeMessages.map((message, index) => {
              const { isJson, formatted } = formatMessageContent(message.content);
              const isMine = message.sender === "user";
              const showOptimized = showActions && !apiError && !isMine && message.optimized;

              return (
                <div
                  key={message.id || index}
                  ref={index === safeMessages.length - 1 ? messagesEndRef : null}
                  className={`rg-chat-row ${isMine ? "rg-chat-row-mine" : ""}`}
                >
                  <div className="rg-chat-sender">{isMine ? "you" : `${label} helper`}</div>

                  <div className={`rg-chat-bubble ${isMine ? "rg-chat-bubble-mine" : ""}`}>
                    {isJson ? (
                      <CodeBlock>{formatted}</CodeBlock>
                    ) : (
                      <Markdown components={mdComponentsLight} remarkPlugins={mdRemarkPlugins}>
                        {message.content}
                      </Markdown>
                    )}
                  </div>

                  {showOptimized && (
                    <div className="rg-chat-optimized">
                      <div className="rg-chat-optimized-body">
                        {typeof message.optimized === "string"
                          ? message.optimized
                          : JSON.stringify(message.optimized, null, 2)}
                      </div>
                      <div className="rg-chat-optimized-actions">
                        <button
                          type="button"
                          data-testid={`canvas-apply-button-${message.id}`}
                          id={`canvas-apply-button-${message.id}`}
                          className={`rg-chat-apply ${appliedMessages === message.id ? "rg-chat-apply-done" : ""}`}
                          onClick={() => handleApply(message)}
                          disabled={appliedMessages === message.id}
                        >
                          <Check size={13} />
                          {appliedMessages === message.id ? "Applied" : "Apply"}
                        </button>
                        <button
                          type="button"
                          data-testid={`canvas-copy-button-${message.id}`}
                          id={`canvas-copy-button-${message.id}`}
                          className="rg-chat-ghost"
                          onClick={() => handleCopy(message.id, message.optimized)}
                        >
                          {copiedMessageId === message.id ? (
                            <CheckIconComponent size={13} />
                          ) : (
                            <CopyIconComponent size={13} />
                          )}
                          {copiedMessageId === message.id ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div data-testid="canvas-loading-state" id="canvas-loading-state" className="text-[12.5px] text-soft">
                Optimizing…
              </div>
            )}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="rg-chat-composer">
        <div className="flex items-end gap-2.5">
          <textarea
            data-testid="canvas-instruction-textarea"
            id="canvas-instruction-textarea"
            ref={textareaRef}
            className="rg-chat-input"
            placeholder={`how you'd like to improve your ${label}...`}
            value={instruction}
            rows={1}
            onChange={(e) => {
              setInstruction(e.target.value);
              if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
                textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 128)}px`;
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading) {
                if (e.shiftKey) {
                  return;
                }
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            type="button"
            data-testid="canvas-send-button"
            id="canvas-send-button"
            className="rg-chat-send"
            title="Optimize"
            disabled={loading || !instruction.trim()}
            onClick={handleSend}
          >
            {loading ? <span className="loading loading-dots loading-xs" /> : <Sparkles size={15} />}
          </button>
          {hasMessages && (
            <button
              type="button"
              data-testid="canvas-reset-chat-button"
              id="canvas-reset-chat-button"
              className="rg-chat-square"
              title="New thread"
              onMouseDown={handleResetChat}
            >
              <RotateCcw size={15} />
            </button>
          )}
        </div>

        <div className="rg-chat-note">Apply writes the optimized {label} into the editor and saves it.</div>

        {errorMessage && (
          <div data-testid="canvas-error-message" id="canvas-error-message" className="rg-chat-note text-error">
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
}

export default Canvas;
