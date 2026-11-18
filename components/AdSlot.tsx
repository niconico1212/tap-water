/**
 * Placeholder for a future ad unit. Renders nothing visible in production until
 * ads are switched on; in development it shows where the slot sits.
 */
export function AdSlot({ id }: { id: string }) {
  if (process.env.NODE_ENV === "production") {
    return <div data-ad-slot={id} hidden />;
  }
  return (
    <div
      data-ad-slot={id}
      className="my-8 rounded-lg border border-dashed border-line px-4 py-6 text-center text-xs text-muted"
    >
      Ad slot: {id}
    </div>
  );
}
