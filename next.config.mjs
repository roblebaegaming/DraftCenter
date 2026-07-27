import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const release = process.env.VERCEL_GIT_COMMIT_SHA
  || process.env.NEXT_PUBLIC_DRAFTCENTER_RELEASE
  || "local";

export default {
  env: {
    NEXT_PUBLIC_DRAFTCENTER_RELEASE: release,
  },
  turbopack: {
    root: projectRoot,
  },
};
