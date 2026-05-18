import { useCallback, useEffect, useRef } from "react";

const POLL_INTERVAL = 60_000;

type InboxHeartbeatOptions = {
    /** Whether polling is enabled (e.g. only when logged in) */
    enabled: boolean;
    /** Fetch the current unread count from server */
    fetchUnreadCount: () => Promise<number>;
    /** Called when count changes with new unread count */
    onUnreadCountChange?: (count: number) => void;
    /** Called when new messages arrive (delta = how many new) */
    onNewMessages?: (delta: number) => void;
};

/**
 * Heartbeat hook that polls inbox unread count every minute.
 * Tracks previously known count to detect genuinely new messages
 * and prevents duplicate toast notifications.
 */
export function useInboxHeartbeat({
    enabled,
    fetchUnreadCount,
    onUnreadCountChange,
    onNewMessages,
}: InboxHeartbeatOptions) {
    const prevCountRef = useRef<number | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const poll = useCallback(async () => {
        try {
            const count = await fetchUnreadCount();
            onUnreadCountChange?.(count);

            if (prevCountRef.current !== null && count > prevCountRef.current) {
                const delta = count - prevCountRef.current;
                onNewMessages?.(delta);
            }

            prevCountRef.current = count;
        } catch {
            // Silently ignore polling errors
        }
    }, [fetchUnreadCount, onUnreadCountChange, onNewMessages]);

    useEffect(() => {
        if (!enabled) {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            prevCountRef.current = null;
            return;
        }

        // Initial fetch
        void poll();

        timerRef.current = setInterval(() => {
            void poll();
        }, POLL_INTERVAL);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [enabled, poll]);
}
