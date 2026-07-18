import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These render documents server-side and must not be bundled by webpack/turbopack
  // (they rely on Node built-ins and dynamic requires).
  serverExternalPackages: ["@react-pdf/renderer", "docx", "nodemailer"],
};

export default nextConfig;
