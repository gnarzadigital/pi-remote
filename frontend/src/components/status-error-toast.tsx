import { usePiBridge } from "@/hooks/use-pi-bridge";

/** Surfaces snapshot.statusError (bridge command failures, "not ready yet"
 * retries) as a transient toast. The bridge client already auto-clears the
 * field after a few seconds; this just renders it while set. */
export function StatusErrorToast() {
  const { snapshot } = usePiBridge();
  if (!snapshot.statusError) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+8px)] z-[90] flex justify-center px-4"
    >
      <div className="max-w-full truncate rounded-full bg-red-600 px-3 py-1.5 text-[12px] font-medium text-white shadow-md">
        {snapshot.statusError}
      </div>
    </div>
  );
}
