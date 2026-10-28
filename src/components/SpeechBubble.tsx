import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SpeechBubbleProps {
  children: ReactNode;
  /** Where the tail points (towards the speaker). */
  tail?: "left" | "bottom";
  className?: string;
}

/** Comic-style speech bubble for Quenottes. */
const SpeechBubble = ({ children, tail = "left", className }: SpeechBubbleProps) => (
  <div
    className={cn(
      "relative bg-white border-[3px] border-ink rounded-3xl px-4 py-3 shadow-[0_5px_0_hsl(var(--ink)/0.15)]",
      className,
    )}
  >
    {children}
    <span
      aria-hidden
      className={cn(
        "absolute w-4 h-4 bg-white border-ink rotate-45",
        tail === "left"
          ? "-left-[10px] top-1/2 -translate-y-1/2 border-l-[3px] border-b-[3px]"
          : "left-1/2 -bottom-[10px] -translate-x-1/2 border-r-[3px] border-b-[3px]",
      )}
    />
  </div>
);

export default SpeechBubble;
