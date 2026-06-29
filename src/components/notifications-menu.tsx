"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Bell } from "lucide-react";

import { getMyUnreadNotificationCount } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type IdleWindow = Window &
  typeof globalThis & {
    requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

const NotificationsDropdownSection = dynamic(
  () =>
    import("@/components/notifications-dropdown-section").then(
      (module) => module.NotificationsDropdownSection
    ),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-2 px-2 py-3">
        <div className="h-3 w-32 rounded-full bg-muted" />
        <div className="h-3 w-44 rounded-full bg-muted/80" />
      </div>
    ),
  }
);

export function NotificationsMenu() {
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;

    const loadUnreadCount = () => {
      getMyUnreadNotificationCount()
        .then((count) => {
          if (isMounted) {
            setUnreadCount(count);
          }
        })
        .catch(() => {
          if (isMounted) {
            setUnreadCount(0);
          }
        });
    };

    const idleWindow = window as IdleWindow;
    const idleHandle = idleWindow.requestIdleCallback?.(loadUnreadCount, { timeout: 1500 });
    const timeoutHandle =
      idleHandle === undefined ? window.setTimeout(loadUnreadCount, 350) : undefined;

    return () => {
      isMounted = false;
      if (idleHandle !== undefined) {
        idleWindow.cancelIdleCallback?.(idleHandle);
      }
      if (timeoutHandle !== undefined) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, []);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-lg border border-border/70 bg-card/80 hover:bg-accent"
          aria-label="Open notifications"
          title="Notifications"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-brand-red px-1 text-[10px] font-bold leading-none text-brand-red-foreground ring-2 ring-background">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[min(calc(100vw-2rem),26rem)] rounded-lg p-2" align="end" sideOffset={8}>
        {isOpen ? (
          <NotificationsDropdownSection
            onNavigate={() => setIsOpen(false)}
            onUnreadCountChange={setUnreadCount}
          />
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
