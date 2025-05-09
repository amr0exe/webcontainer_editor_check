import { useEffect, useRef, useState, useCallback, useContext } from "react";

import { WebContainer } from "@webcontainer/api";
import { Editor } from "@monaco-editor/react";

import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

import MyContext from "./context/Context.jsx";

import { mnt_file } from "./files/file.js";

export default function App() {
	const terminalRef = useRef(null);
	const bootedRef = useRef(false);

	const { url, setUrl } = useContext(MyContext);
	const [files, setFiles] = useState([]);
	const [code, setCode] = useState("");
	const [webcontainerInstance, setWebcontainerInstance] = useState(null);

	const bootWC = useCallback(async () => {
		const webcontainer = await WebContainer.boot({
			coep: "credentialless",
		});
		setWebcontainerInstance(webcontainer);
		bootedRef.current = true;

		await webcontainer.mount(mnt_file);

		// for url
		webcontainer.on("server-ready", (port, url) => {
			setUrl(url);
		});

		// Terminal setup
		const term = new Terminal({ convertEol: true });
		const fitAddon = new FitAddon();
		term.loadAddon(fitAddon);
		term.open(terminalRef.current);
		fitAddon.fit();

		// Spawn shell
		const shell = await webcontainer.spawn("jsh", {
			terminal: {
				cols: term.cols,
				rows: term.rows,
			},
		});

		// Connect shell to terminal
		shell.output.pipeTo(
			new WritableStream({
				write(data) {
					term.write(data);
				},
			}),
		);

		const inputWriter = shell.input.getWriter();
		term.onData((data) => {
			inputWriter.write(data);
		});

		// Resize handling
		window.addEventListener("resize", () => {
			fitAddon.fit();
			shell.resize({
				cols: term.cols,
				rows: term.rows,
			});
		});
	}, [setUrl]);

	const handleClick = async (file) => {
		try {
			const fileContent = await webcontainerInstance.fs.readFile(
				`/${file}`,
				"utf-8",
			);
			// console.log("here it is", fileContent);
			setCode(fileContent);
		} catch (e) {
			console.error("Error reading the file: ", e);
		}
	};

	const startDevServer = async () => {
		// install dependencies
		const installProcess = await webcontainerInstance.spawn("npm", [
			"install",
		]);
		await installProcess.exit;

		// run-the-app
		await webcontainerInstance.spawn("npm", ["start"]);
	};

	// for booting-up webcontainer
	useEffect(() => {
		if (bootedRef.current) return;
		bootWC();
	}, [bootWC]);

	// for fetching-files from VFS
	useEffect(() => {
		if (!webcontainerInstance) return;

		const interval = setInterval(async () => {
			const fileList = await webcontainerInstance.fs.readdir("/");
			setFiles(fileList);
		}, 2000);

		return () => clearInterval(interval);
	}, [webcontainerInstance]);

	// for websocket-proxy soln
	useEffect(() => {
		const socket = new WebSocket("ws://localhost:9000");

		socket.onmessage = async (event) => {
			const { id, method, path, body } = JSON.parse(event.data);

			console.log(method, path, body);
			const options = {
				method,
				headers: { "Content-Type": "application/json" },
				// mode: "no-cors",
			};
			if (method !== "GET") {
				options.body = body ? JSON.stringify(body) : "undefined";
			}

			try {
				const res = await fetch(`${url}${path}`, options);
				// const res = await fetch(
				// 	`http://localhost:3000${path}`,
				// 	options,
				// );
				console.log(`${url}${path}`);
				const res_body = await res.text();
				socket.send(JSON.stringify({ id, res_body }));
			} catch (e) {
				console.log("Error fetching respone: ", e);
			}
		};
	}, [url]);

	return (
		<div className="h-screen flex flex-col">
			<div className="flex flex-1 overflow-hidden">
				{/* File Tree Sidebar */}
				<div className="w-1/4 bg-gray-100 p-4 overflow-auto border-r flex flex-col">
					<div className="flex flex-col">
						<button
							onClick={startDevServer}
							className="px-6 py-2 bg-black text-white rounded-lg mb-4 cursor-pointer"
						>
							Run
						</button>
						<p className="text-xs mb-4">
							{url === "" ? "NO URL" : `${url}`}
						</p>
					</div>
					<div>
						<h1 className="font-bold mb-2 text-2xl border-0 border-b-2">
							Files
						</h1>
						{files.map((file) => (
							<p
								key={file}
								onClick={() => handleClick(file)}
								className="font-mono font-bold cursor-pointer pl-5"
							>
								{file}
							</p>
						))}
					</div>
				</div>

				{/* Editor */}
				<div className="flex-1 bg-white">
					<Editor
						height="75vh"
						width="100%"
						theme="vs-dark"
						defaultLanguage="javascript"
						defaultValue="// write code here"
						value={code}
						onChange={(value) => setCode(value)}
					/>
				</div>
			</div>

			{/* Terminal */}
			<div className="h-[300px] border-t border-gray-300">
				<div
					ref={terminalRef}
					className="w-full h-full bg-black text-white"
				/>
			</div>
		</div>
	);
}
