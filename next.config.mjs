/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    // Embeddable forms may be iframed by any club website.
    return [{ source: "/embed/:path*", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }] }];
  },
};
export default nextConfig;
