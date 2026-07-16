import { defineConfig } from "orval";

// Generates a fully-typed Axios client from the backend's committed OpenAPI spec
// (openapi.json at the repo root) into src/api/generated/ — a build artefact,
// committed and never hand-edited. Every call routes through the shared
// customInstance mutator (Bearer token; silent refresh lands in M2). Re-sync the
// spec from ../wharf-backend and run `bun gen:api` after it changes.
export default defineConfig({
  wharf: {
    input: {
      target: "./openapi.json",
    },
    output: {
      mode: "tags-split",
      target: "src/api/generated",
      schemas: "src/api/generated/model",
      client: "axios",
      httpClient: "axios",
      clean: true,
      indexFiles: true,
      override: {
        mutator: {
          path: "src/api/axios-instance.ts",
          name: "customInstance",
        },
      },
    },
  },
});
