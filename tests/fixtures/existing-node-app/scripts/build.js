import { mkdir, writeFile } from "node:fs/promises";

await mkdir("dist", { recursive: true });
await writeFile("dist/index.js", "export { greet } from '../src/index.js';\n");
