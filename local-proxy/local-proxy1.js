import { WebSocketServer } from "ws";
import express from "express";

const wss = new WebSocketServer({ port: 9000 });
let browserSocket = null; // websocket instance

wss.on("connection", (ws) => {
	console.log("Browser connection via ws...");
	browserSocket = ws;
});

const app = express();
app.use(express.json());

app.use("/proxy", async (req, res) => {
	if (!browserSocket || browserSocket.readyState !== WebSocket.OPEN) {
		return res.status(500).send("Browser not connected");
	}

	const path = req.originalUrl.replace("/proxy", "");
	const requestId = Date.now() + Math.random();

	const message = {
		id: requestId,
		method: req.method,
		path,
		body: req.body,
	};

	browserSocket.send(JSON.stringify(message));

	// wait for resonse from wc
	const onResponse = (msg) => {
		const response = JSON.parse(msg);
		if (response.id === requestId) {
			res.send(response.body);
			browserSocket.off("message", onResponse);
		}
	};

	browserSocket.on("message", onResponse);
});

app.listen(8000, () => console.log("Http server running on port 8000"));
