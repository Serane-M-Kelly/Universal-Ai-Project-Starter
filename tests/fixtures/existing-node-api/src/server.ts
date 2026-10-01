import { createApplication } from "./app.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const server = createApplication();

server.listen(port, "127.0.0.1", () => {
  console.log(`API disponible sur http://127.0.0.1:${port}`);
});
