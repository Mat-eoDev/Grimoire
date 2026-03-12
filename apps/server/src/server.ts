import { app } from "./app.js";
import { env } from "./env.js";

app.listen(env.port, () => {
  console.log(`API NewMJ disponible sur http://localhost:${env.port}`);
});
