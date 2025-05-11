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

	// curl
	const [method, setMethod] = useState("GET");
	const [header, setHeader] = useState("");
	const [data, setData] = useState("");
	const [resp, setResp] = useState("");

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

	// curl-automation
	const curlAutomate = async () => {
		// accepted method
		// GET POST PUT DELETE
		const process = await webcontainerInstance.spawn("curl", [`${url}`]);

		// pipe curl to console
		await process.output.pipeTo(
			new WritableStream({
				write(chunk) {
					setResp(chunk);
				},
			}),
		);
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

	return (
		<div className="h-screen flex flex-col">
			<div className="flex flex-1 overflow-hidden">
				{/* File Explorer - 20% */}
				<div className="w-1/5 border-r bg-gray-100 p-4 overflow-auto flex flex-col">
					{/* Run-the-Program */}
					<button
						className="px-6 py-2 bg-black text-white rounded-lg cursor-pointer active:opacity-70 active:scale-95 transition duration-150"
						onClick={startDevServer}
					>
						Run
					</button>

					{/* URL */}
					<p className="text-xs font-mono text-gray-700 text-center my-5">
						{url ? url : "NO URL"}
					</p>

					<h2 className="font-bold text-lg mb-4 border-b pb-2">
						Files
					</h2>
					{files.map((file) => (
						<p
							key={file}
							onClick={() => handleClick(file)}
							className="cursor-pointer font-mono pl-2 hover:underline"
						>
							{file}
						</p>
					))}
				</div>

				{/* Editor - 40% */}
				<div className="w-[40%] bg-white">
					<Editor
						height="100%"
						width="100%"
						theme="vs-dark"
						defaultLanguage="javascript"
						defaultValue="// write code here"
						value={code}
						onChange={(value) => setCode(value)}
					/>
				</div>

				{/* Terminal - 40% */}
				<div className="w-[40%] border-l bg-black text-white">
					<div
						ref={terminalRef}
						className="w-full h-full p-2 overflow-auto"
					/>
				</div>
			</div>

			<div className="flex justify-between items-center px-4 py-2 border-b bg-gray-50"></div>

			{/* Bottom Row: Inputs + Output */}
			<div className="flex font-mono">
				{/* Left: Request Config - 60% */}
				<div className="w-3/5 p-4 space-y-4">
					<div className="flex items-center space-x-4">
						<label className="font-bold">METHOD</label>
						<select
							value={method}
							onChange={(e) => setMethod(e.target.value)}
							className="border pl-2 pr-6 py-1 uppercase"
						>
							<option value="GET">GET</option>
							<option value="POST">POST</option>
							<option value="PUT">PUT</option>
							<option value="DELETE">DELETE</option>
						</select>

						<label className="font-bold">HEADERS</label>
						<input
							type="text"
							placeholder="Content-Type: application/json"
							className="border pl-2 py-1 w-96"
							value={header}
							onChange={(e) => setHeader(e.target.value)}
						/>
					</div>

					<div>
						<label className="block font-bold mb-1">
							JSON BODY
						</label>
						<textarea
							className="w-2/5 border p-2 font-mono resize-y min-h-[100px]"
							placeholder={`{\n  "key": "value"\n}`}
							value={data}
							onChange={(e) => setData(e.target.value)}
						/>
					</div>

					<button
						className="px-6 py-2 bg-black text-white rounded-lg mt-2 cursor-pointer active:opacity-70 active:scale-95 transition duration-150"
						onClick={curlAutomate}
					>
						runCurl
					</button>
				</div>

				{/* Right: Output Viewer - 40% */}
				<div className="w-2/5 p-4 bg-gray-50 border-l overflow-auto">
					<h3 className="font-bold mb-2">Response Headers</h3>
					<p className="font-mono text-sm whitespace-pre-wrap">
						{resp}
					</p>
				</div>
			</div>
		</div>
	);
}
