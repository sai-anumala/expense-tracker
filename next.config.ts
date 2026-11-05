import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Accounts page became All Transactions; keep old links working.
  async redirects() {
    return [{ source: "/accounts", destination: "/transactions", permanent: false }];
  },
};

export default nextConfig;
