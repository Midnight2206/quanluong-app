/**
 * Liên hệ Midnight Studio — footer landing.
 * Icon: SVG thương hiệu rút gọn, chỉ dùng cạnh link kênh chính thức.
 */

function PhoneIcon({ className }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <rect width="48" height="48" rx="12" fill="hsl(var(--muted))" />
      <path
        fill="none"
        stroke="hsl(var(--foreground))"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M30.5 27.2c-.8-.4-1.7-.2-2.3.3l-1.3 1.1c-.3.2-.7.3-1 .1-1.2-.5-2.7-1.5-3.9-2.8-1.2-1.2-2.1-2.6-2.6-3.8-.1-.4 0-.7.2-1l1.2-1.4c.5-.6.6-1.5.3-2.2l-1.5-3.2c-.4-.9-1.5-1.3-2.4-1l-2 .7c-.9.3-1.5 1.2-1.5 2.2 0 .4.1 1 .2 1.6.6 3.2 2.3 6.3 4.8 8.8s5.8 4.3 9.1 5c.6.1 1.2.2 1.7.2 1 0 1.9-.6 2.2-1.5l.8-2.1c.3-1-.1-2-1-2.5l-3-1.5z"
      />
    </svg>
  );
}

/** Zalo — nền xanh thương hiệu + chữ Z. */
function ZaloIcon({ className }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <rect width="48" height="48" rx="12" fill="#0068FF" />
      <path
        fill="#fff"
        d="M15 15.5h18v3.2L22.2 29H33v3.5H15v-3.2L25.8 18.9H15v-3.4z"
      />
    </svg>
  );
}

/** Facebook — nền xanh + chữ f. */
function FacebookIcon({ className }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <rect width="48" height="48" rx="12" fill="#1877F2" />
      <path
        fill="#fff"
        d="M29.6 26.3h3.9l.8-5h-4.7v-2.8c0-1.4.5-2.5 2.6-2.5H34V11.5c-.5-.1-2-.3-3.8-.3-3.8 0-6.4 2.2-6.4 6.4v3.7h-4.2v5h4.2V38h5.8V26.3z"
      />
    </svg>
  );
}

/** Gmail — phong bì đa màu quen thuộc. */
function GmailIcon({ className }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <rect width="48" height="48" rx="12" fill="#fff" />
      <path fill="#EA4335" d="M10 15.5 24 26l14-10.5V13H10v2.5z" />
      <path fill="#4285F4" d="M34 15.5v17H38V13l-4 2.5z" />
      <path fill="#34A853" d="M10 15.5 14 18.5V32.5H10V15.5z" />
      <path fill="#C5221F" d="M14 18.5 24 26l10-7.5V32.5H14V18.5z" />
      <path fill="#FBBC04" d="M10 15.5 14 18.5 10 21.2V15.5z" />
    </svg>
  );
}

export const MIDNIGHT_CONTACT = {
  phone: {
    label: "Điện thoại",
    value: "0386.206.503",
    href: "tel:+84386206503",
    Icon: PhoneIcon,
  },
  zalo: {
    label: "Zalo",
    value: "0386.206.503",
    href: "https://zalo.me/0386206503",
    Icon: ZaloIcon,
  },
  facebook: {
    label: "Facebook",
    value: "tran.van.khanh",
    href: "https://www.facebook.com/tran.van.khanh.749250",
    Icon: FacebookIcon,
  },
  gmail: {
    label: "Gmail",
    value: "midnight.tvk.96@gmail.com",
    href: "mailto:midnight.tvk.96@gmail.com",
    Icon: GmailIcon,
  },
};

export { MIDNIGHT_ABOUT_VI as MIDNIGHT_ABOUT } from "./midnightLandingCopy.js";
