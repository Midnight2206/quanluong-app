import { PDFDocument } from "pdf-lib";

/**
 * Ghép nhiều PDF (buffer) thành một file — không dùng PDFKit auto page break.
 * @param {Buffer[]} buffers
 * @returns {Promise<Buffer>}
 */
async function mergePdfBuffers(buffers) {
  if (!buffers?.length) {
    throw new Error("mergePdfBuffers: empty buffers");
  }
  if (buffers.length === 1) {
    return buffers[0];
  }
  const merged = await PDFDocument.create();
  for (const buf of buffers) {
    const src = await PDFDocument.load(buf);
    const copied = await merged.copyPages(src, src.getPageIndices());
    copied.forEach((page) => merged.addPage(page));
  }
  const bytes = await merged.save({ useObjectStreams: false });
  return Buffer.from(bytes);
}

export { mergePdfBuffers };
