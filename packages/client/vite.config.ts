import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function devShortcuts(): import("vite").Plugin {
  return {
    name: "dev-shortcuts",
    configureServer(server) {
      const _printUrls = server.printUrls.bind(server);
      server.printUrls = () => {
        _printUrls();
        const base = "http://localhost:5173";
        const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
        const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
        const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
        console.log("");
        console.log(`  ${bold("Shortcuts:")}`);
        console.log(
          `  ${dim("Storyteller")}   ${cyan(`${base}/?role=storyteller`)}`,
        );
        console.log(
          `  ${dim("Player       ")}  ${cyan(`${base}/?playerId=player-1`)}`,
        );
        console.log(
          `  ${dim("Custom room  ")}  ${cyan(`${base}/?room=<room>&role=storyteller`)}`,
        );
        console.log("");
      };
    },
  };
}

export default defineConfig({
  plugins: [react(), devShortcuts()],
  build: {
    commonjsOptions: { transformMixedEsModules: true },
  },
  server: {
    port: 5173,
    proxy: {
      "/ws": {
        target: "ws://localhost:8080",
        ws: true,
      },
    },
  },
});
