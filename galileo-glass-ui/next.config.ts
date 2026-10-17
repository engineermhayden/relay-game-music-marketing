import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  compiler: { styledComponents: true },
  serverExternalPackages: ["pg"],
  devIndicators: false,
};
export default config;
