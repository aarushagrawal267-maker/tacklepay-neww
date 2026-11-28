import type { NextConfig } from "next";

// Sites allowed to show the app in an iframe, e.g. `https://huggingface.co` for the public demo, whose Space
// page embeds the app. Read at build time. Unset (the default), no site may frame it. Only plain https
// origins are kept, so the value can't smuggle other directives into the header.
const FRAME_ANCESTORS = (process.env.TPI_FRAME_ANCESTORS ?? "")
  .split(/\s+/)
  .filter((o) => /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(o));

// Sent with every page and API answer. A payments app must not be framed by another site (a hidden
// iframe over the PIN pad is the classic clickjacking trick), must not have its responses MIME-sniffed,
// and only needs the camera (for scanning), on its own origin.
const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: `frame-ancestors ${FRAME_ANCESTORS.length ? `'self' ${FRAME_ANCESTORS.join(" ")}` : "'none'"}; base-uri 'self'; form-action 'self'; object-src 'none'`,
  },
  // X-Frame-Options can't name another site, so it is left out when TPI_FRAME_ANCESTORS allows one.
  ...(FRAME_ANCESTORS.length ? [] : [{ key: "X-Frame-Options", value: "DENY" }]),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // Lets other devices on your Wi-Fi (and 127.0.0.1) load the dev server, so two phones can pay each other.
  allowedDevOrigins: ["127.0.0.1", "192.168.*.*", "10.*.*.*", "172.*.*.*"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
