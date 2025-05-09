import express from "express";
import httpProxy from "http-proxy-middleware";
const app = express();

const URL = "http://localhost:3000";

app.use(
	"/",
	httpProxy.createProxyMiddleware({
		target: URL,
		changeOrigin: true,
		secure: false,
		logLevel: "debug",
	}),
);

app.listen("3000", () => console.log("proxy running on :3000"));
