import { Archive, GripVertical, Pin } from "lucide-react";
import { useRef, useState } from "react";
import { formatRelativeTimeShort, formatSessionName } from "@/lib/session-utils";
import type { PiSession } from "@/lib/types";
import { cn, hapticTap } from "@/lib/utils";

const ACTION_W = 72;
const SWIPE_THRESHOLD = 36;

type Props = {
  session: PiSession;
  active: boolean;
  pinned: boolean;
  unread: boolean;
  foreign: boolean;
  onSelect: (session: PiSession) => void;
  onTogglePin: (session: PiSession) => void;
  onArchive: (session: PiSession) => void;
  onRename?: (session: PiSession) => void;
};

export function SessionListRow({
  session,
  active,
  pinned,
  unread,
  foreign,
  onSelect,
  onTogglePin,
  onArchive,
  onRename,
}: Props) {
  const name = formatSessionName(session.name);
  const time = formatRelativeTimeShort(session.mtime);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startOffset = useRef(0);
  const longPressRef = useRef<number | null>(null);

  const open = offset >= SWIPE_THRESHOLD;
  const snapOpen = () => setOffset(ACTION_W);
  const snapClosed = () => setOffset(0);

  const onTouchStart = (e: React.TouchEvent) => {
    if (foreign) return;
    startX.current = e.touches[0].clientX;
    startOffset.current = offset;
    setDragging(true);
    longPressRef.current = window.setTimeout(() => {
      hapticTap();
      onRename?.(session);
    }, 520);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (foreign) return;
    if (longPressRef.current != null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
    const dx = startX.current - e.touches[0].clientX;
    const next = Math.max(0, Math.min(ACTION_W, startOffset.current + dx));
    setOffset(next);
  };

  const onTouchEnd = () => {
    if (longPressRef.current != null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
    setDragging(false);
    if (offset >= SWIPE_THRESHOLD) snapOpen();
    else snapClosed();
  };

  return (
    <div className="session-row-outer relative w-full overflow-hidden">
      <div
        className={cn(
          "session-row-actions absolute inset-y-0 right-0 flex w-[72px] items-center justify-end gap-0.5 pr-1 md:hidden",
          !open && "pointer-events-none opacity-0"
        )}
        aria-hidden={!open}
      >
        <button
          type="button"
          aria-label={pinned ? "Unpin" : "Pin"}
          className="flex size-8 items-center justify-center rounded-md text-concrete hover:bg-mist hover:text-graphite"
          onClick={() => {
            hapticTap();
            onTogglePin(session);
            snapClosed();
          }}
        >
          <Pin className={cn("size-3.5", pinned && "fill-current text-graphite")} />
        </button>
        <button
          type="button"
          aria-label="Archive"
          className="flex size-8 items-center justify-center rounded-md text-concrete hover:bg-mist hover:text-graphite"
          onClick={() => {
            hapticTap();
            onArchive(session);
            snapClosed();
          }}
        >
          <Archive className="size-3.5" />
        </button>
      </div>

      <div
        className={cn(
          "session-row-slide group relative flex min-h-[28px] items-center gap-1.5 rounded-md px-2 py-[5px]",
          active && "bg-[var(--session-row-active)]",
          foreign && "opacity-45",
          !foreign && !active && "hover:bg-[var(--session-row-hover)]",
          dragging ? "transition-none" : "transition-transform duration-200 ease-out"
        )}
        style={{ transform: `translateX(-${offset}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onContextMenu={(e) => {
          if (foreign || !onRename) return;
          e.preventDefault();
          hapticTap();
          onRename(session);
        }}
      >
        {pinned ? (
          <Pin
            className="size-3 shrink-0 fill-red-500 text-red-500"
            aria-label="Pinned"
            strokeWidth={2}
          />
        ) : active ? (
          <GripVertical className="size-3.5 shrink-0 text-concrete opacity-70" aria-hidden />
        ) : (
          <span className="size-3.5 shrink-0" aria-hidden />
        )}

        <button
          type="button"
          disabled={foreign}
          className="min-w-0 flex-1 truncate text-left session-list-name text-graphite disabled:cursor-default"
          onClick={() => {
            if (open) {
              snapClosed();
              return;
            }
            onSelect(session);
          }}
        >
          {unread ? (
            <span className="mr-1.5 inline-block size-1.5 translate-y-[-1px] rounded-full bg-sky-500" />
          ) : null}
          <span className={cn(unread && "font-medium")}>{name}</span>
        </button>

        <div className="hidden shrink-0 items-center gap-0.5 md:group-hover:flex">
          {!foreign ? (
            <>
              <button
                type="button"
                aria-label={pinned ? "Unpin" : "Pin"}
                className="flex size-7 items-center justify-center rounded-md text-concrete hover:bg-mist hover:text-graphite"
                onClick={() => {
                  hapticTap();
                  onTogglePin(session);
                }}
              >
                <Pin className={cn("size-3.5", pinned && "fill-current text-graphite")} />
              </button>
              <button
                type="button"
                aria-label="Archive"
                className="flex size-7 items-center justify-center rounded-md text-concrete hover:bg-mist hover:text-graphite"
                onClick={() => {
                  hapticTap();
                  onArchive(session);
                }}
              >
                <Archive className="size-3.5" />
              </button>
            </>
          ) : null}
        </div>

        <span
          className={cn(
            "session-list-time shrink-0 tabular-nums text-concrete md:group-hover:hidden",
            unread && "text-graphite/70"
          )}
        >
          {time}
        </span>
      </div>
    </div>
  );
}
