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
	const iframeRef = useRef(null);

	const { url, setUrl } = useContext(MyContext);
	const [files, setFiles] = useState([]);
	const [code, setCode] = useState("");
	const [serverProcess, setServerProcess] = useState(null);
	const [serverRunning, setServerRunning] = useState(false);
	const [webcontainerInstance, setWebcontainerInstance] = useState(null);

	// curl
	const [method, setMethod] = useState("GET");
	const [header, setHeader] = useState("");
	const [data, setData] = useState("");
	const [path, setPath] = useState("/");
	const [resp, setResp] = useState("");
	const [isEditing, setIsEditing] = useState(false);
	const [currentFile, setCurrentFile] = useState("index.js");

	const bootWC = useCallback(async () => {
		const webcontainer = await WebContainer.boot({
			coep: "credentialless",
		});
		setWebcontainerInstance(webcontainer);
		bootedRef.current = true;

		await webcontainer.mount(mnt_file);

		// for url
		webcontainer.on("server-ready", (port, url) => {
			// setUrl(`http://localhost:${port}`);
			setUrl(url);
			iframeRef.current.src = url;
		});

		// Terminal setup
		const term = new Terminal({ convertEol: true });
		const fitAddon = new FitAddon();
		term.loadAddon(fitAddon);
		term.open(terminalRef.current);
		fitAddon.fit();

		// terminal-singleton
		// terminalRef.current._xtermInstance = term;

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
			setCurrentFile(file);
			console.log("current-working file, ", currentFile);
		} catch (e) {
			console.error("Error reading the file: ", e);
		}
	};

	const startDevServer = async () => {
		if (serverRunning && serverProcess) {
			await serverProcess.kill();
			setServerProcess(null);
			setServerRunning(false);

			console.log("dev-server stopped...");
		} else {
			// install dependencies
			const installProcess = await webcontainerInstance.spawn("npm", [
				"install",
			]);
			await installProcess.exit;

			// start dev-server
			const startProcess = await webcontainerInstance.spawn("npm", [
				"start",
			]);
			setServerProcess(startProcess);
			setServerRunning(true);

			console.log("dev-server started...");
		}

		// if (!webcontainerInstance) return;

		// // install dependencies
		// const installProcess = await webcontainerInstance.spawn("npm", [
		// 	"install",
		// ]);
		// await installProcess.exit;

		// // run-the-app
		// await webcontainerInstance.spawn("npm", ["start"]);
		// setServerRunning(true);

		// setServerRunning.exit.then(() => {
		// 	setServerRunning(false);
		// });
	};

	// curl-automation
	const curlAutomate = async () => {
		// accepted method
		// GET POST PUT DELETE
		let commandArgs = [];
		const content_header = header || "Content-Type: application/json";

		switch (method) {
			case "GET":
				commandArgs = [`${url}${path}`];
				break;

			case "POST":
			case "PUT":
				if (!content_header || !data) {
					setResp(
						"Error header and data are required for post/put request.",
					);
					return;
				}
				commandArgs = [
					"-X",
					method,
					"-H",
					content_header,
					"-d",
					data,
					`${url}${path}`,
				];
				break;

			case "DELETE":
				commandArgs = [
					"-X",
					method,
					"-H",
					content_header,
					`${url}${path}`,
				];
				break;

			default:
				setResp("Method not supported, currently!");
				return;
		}

		// const process = await webcontainerInstance.spawn("curl", [`${url}`]);
		const process = await webcontainerInstance.spawn("curl", commandArgs);

		// pipe curl to console
		await process.output.pipeTo(
			new WritableStream({
				write(chunk) {
					setResp((prev) => prev + chunk);
				},
			}),
		);
	};

	// save editor content-to-currentFile
	const saveToFile = async () => {
		if (code === "") {
			console.log("Code is empty");
			return;
		}

		if (webcontainerInstance && currentFile) {
			try {
				await webcontainerInstance.fs.writeFile(
					`/${currentFile}`,
					code,
					"utf-8",
				);
				console.log(`File ${currentFile} updated Successfully!`);
			} catch (e) {
				console.error("Error saving the file: ", e);
			}
		}
	};

	// for url-bar
	const handleKeyDown = (e) => {
		if (e.key === "Enter") {
			setIsEditing(false);
			iframeRef.current.src = url;
		} else if (e.key === "Escape") {
			setIsEditing(false);
		}
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
		<div className="flex flex-col">
			<div className="h-screen flex flex-col">
				<div className="flex flex-1 overflow-hidden">
					{/* File Explorer - 20% */}
					<div className="w-1/5 border-r bg-gray-100 p-4 overflow-auto flex flex-col">
						{/* Run-the-Program */}
						<button
							className="px-6 py-2 bg-black text-white rounded-lg cursor-pointer active:opacity-70 active:scale-95 transition duration-150"
							onClick={startDevServer}
						>
							{serverRunning ? "Stop-Server" : "Run"}
						</button>
						<button
							onClick={saveToFile}
							className="mt-3 px-6 py-2 bg-black text-white rounded-lg cursor-pointer active:opacity-70 active:scale-95 transition duration-150"
						>
							SaveFile
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

					<div className="w-[40%] border-l flex flex-col">
						{/* URL Bar */}
						<div className="w-[80%] h-8 rounded-md border border-gray-400 bg-gray-100 flex items-center px-3 mx-auto mt-2 overflow-hidden">
							{/* <p className="whitespace-nowrap overflow-x-auto text-sm text-gray-700">
								{url}
							</p> */}
							{isEditing ? (
								<input
									type="text"
									value={url}
									onChange={(e) => setUrl(e.target.value)}
									onKeyDown={handleKeyDown}
									onBlur={() => setIsEditing(false)}
									autoFocus
									className="px-2 py-1 w-full"
								/>
							) : (
								<div
									onClick={() => setIsEditing(true)}
									className="cursor-text px-2 py-2 w-10/12 whitespace-nowrap overflow-hidden text-ellipsis hover:overflow-x-auto hover:scrollbar-thin hover:scrollbar-thumb-gray-400"
								>
									{url}
								</div>
							)}
						</div>

						{/* Iframe Content */}
						<iframe
							ref={iframeRef}
							className="w-full flex-grow mt-2"
							sandbox="allow-scripts allow-same-origin"
						/>
					</div>
				</div>

				<div className="flex justify-between items-center px-4 py-2 border-b bg-gray-50"></div>

				{/* Bottom Row: Inputs + Output */}
				<div className="flex font-mono">
					{/* Left: Request Config - 60% */}
					<div className="w-3/5 p-4 space-y-4 ml-5">
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

						<div className="flex items-start space-x-4">
							<label className="font-bold">Path</label>
							<input
								type="text"
								placeholder="path: /api/rate"
								className="border pl-2 py-1 w-60"
								onChange={(e) => setPath(e.target.value)}
							/>

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
					<div className="w-2/5 p-4 bg-gray-50 border-l overflow-auto max-h-[300px]">
						<h3 className="font-bold mb-2">Response Headers</h3>
						<p className="font-mono text-sm whitespace-pre-wrap">
							{resp}
						</p>
					</div>
				</div>
			</div>

			{/* Terminal  */}
			<div className="w-full border-t bg-black text-white mt-10">
				<div
					ref={terminalRef}
					className="w-full p-2 overflow-auto min-h-[200px]"
				/>
			</div>
		</div>
	);
}
