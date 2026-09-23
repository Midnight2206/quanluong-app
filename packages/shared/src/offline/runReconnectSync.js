const OUTBOX_PARTIAL_FLUSH_MSG =
  "Không gửi hết thao tác lên máy chủ. Kiểm tra mạng và thử lại.";

export async function runReconnectSync({
  flushOutbox,
  invalidate,
  refetchActive,
  prefetchBoot,
}) {
  const flushResult = await flushOutbox();
  if (flushResult?.failed > 0) {
    throw new Error(OUTBOX_PARTIAL_FLUSH_MSG);
  }
  invalidate();
  await refetchActive();
  await prefetchBoot();
}
