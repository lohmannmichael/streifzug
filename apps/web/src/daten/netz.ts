import { useEffect, useState } from "react";

/** Whether the phone has a network right now (follows the online/offline events). */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const an = () => setOnline(true);
    const aus = () => setOnline(false);
    window.addEventListener("online", an);
    window.addEventListener("offline", aus);
    return () => {
      window.removeEventListener("online", an);
      window.removeEventListener("offline", aus);
    };
  }, []);
  return online;
}
