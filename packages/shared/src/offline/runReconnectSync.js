export async function runReconnectSync({
  flushOutbox,
  invalidate,
  refetchActive,
  prefetchBoot,
}) {
  await flushOutbox();
  invalidate();
  await refetchActive();
  await prefetchBoot();
}
