/** Tên thương hiệu thống nhất cho `<title>`, OG và Twitter. */
export const QUANLUONG_SITE_NAME = "Quân lương";

/**
 * Metadata chuẩn cho một trang: segment `title` khớp template root `Quân lương - %s`;
 * OG/Twitter nhận title đầy đủ.
 *
 * @param {{ title: string; description: string; robots?: import("next").Metadata["robots"] }} opts
 * @returns {import("next").Metadata}
 */
export function quanLuongPageMeta(opts) {
  const docTitle = `${QUANLUONG_SITE_NAME} - ${opts.title}`;
  /** @type {import("next").Metadata} */
  const out = {
    title: opts.title,
    description: opts.description,
    openGraph: {
      title: docTitle,
      description: opts.description,
      locale: "vi_VN",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: docTitle,
      description: opts.description,
    },
  };
  if (opts.robots != null) {
    out.robots = opts.robots;
  }
  return out;
}
