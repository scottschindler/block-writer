import { useState, useEffect, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { getSession, startSession, stopSession, interruptSession, type SessionSnapshot } from "./session";

const IDLE: SessionSnapshot = { state: "idle", durationSec: 0, remainingSec: 0 };

export function useSession() {
  const [session, setSession] = useState<SessionSnapshot>(IDLE);

  const start = useCallback(async (durationSec: number) => {
    const s = await startSession(durationSec);
    setSession(s);
  }, []);

  const stop = useCallback(async () => {
    const s = await stopSession();
    setSession(s);
  }, []);

  const interrupt = useCallback(async (passphrase: string, expectedPassphrase: string) => {
    const s = await interruptSession(passphrase, expectedPassphrase);
    setSession(s);
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const interval = setInterval(async () => {
      const snapshot = await getSession();
      setSession(snapshot);
    }, 500);

    listen("session-completed", () => {
      setSession((prev) => {
        if (prev.state === "active") {
          return { ...prev, state: "completed", remainingSec: 0 };
        }
        return prev;
      });
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      clearInterval(interval);
      unlisten?.();
    };
  }, []);

  return { session, start, stop, interrupt };
}
