import { Hono } from "hono";
import reply from "./translator.js";
import { handle } from "hono/aws-lambda";

const app = new Hono();

app.get("/", (c) => {
	return c.text("Hello Hono!");
});

app.route("/webhook", reply);

// aws handler
export const handler = handle(app);

// bun handler
export default app;
