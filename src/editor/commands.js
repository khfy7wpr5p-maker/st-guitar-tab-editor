export function assertKnownEvent(eventById, sourceEventId) {
  const event = eventById.get(sourceEventId);
  if (!event) throw new Error(`Unknown or stale source event identity: ${sourceEventId}`);
  return event;
}
