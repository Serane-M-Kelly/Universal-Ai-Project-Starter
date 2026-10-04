import { createServer } from "node:http";
import { creneauxLibres } from "./creneaux.js";
const token = process.env.API_TOKEN;
const database = process.env.DATABASE_URL; // Rendez-vous conservés dans PostgreSQL.
createServer((req, res) => {
  if (req.headers.authorization !== `Bearer ${token}`) return res.writeHead(401).end();
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ creneaux: creneauxLibres(["09:00", "10:00"], ["09:00"]), database: Boolean(database) }));
}).listen(Number(process.env.PORT ?? 3000));
