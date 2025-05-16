import { useEffect, useRef, useState, useCallback, useContext } from "react";

import { WebContainer } from "@webcontainer/api";
import { Editor } from "@monaco-editor/react";

import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

import MyContext from "./context/Context.jsx";
import { Filetree } from "./components/Filetree.jsx";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";

import { mnt_file } from "./files/file.js";
import { Apitest } from "./components/Apitest.jsx";
import { Inbrowser } from "./components/Inbrowser.jsx";

export default function App() {
	const terminalRef = useRef(null);
	const bootedRef = useRef(false);
	const bootingRef = useRef(false);

	const [files, setFiles] = useState([]);
	const [code, setCode] = useState("");
	const [serverProcess, setServerProcess] = useState(null);
	const [serverRunning, setServerRunning] = useState(false);
	const [currentFile, setCurrentFile] = useState("index.js");

	const {
		url,
		setUrl,
		webcontainerInstance,
		setWebcontainerInstance,
		iframeRef,
	} = useContext(MyContext);

	const bootWC = useCallback(async () => {
		if (bootedRef.current || bootingRef.current || webcontainerInstance) {
			console.log("container hit again to boot...");
			return;
		}

		bootingRef.current = true;

		const webcontainer = await WebContainer.boot({
			coep: "credentialless",
		});
		setWebcontainerInstance(webcontainer);
		bootedRef.current = true;
		bootingRef.current = false;

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
	}, [
		setUrl,
		iframeRef,
		setWebcontainerInstance,
		bootingRef,
		webcontainerInstance,
	]);

	const handleClick = async (filePath) => {
		try {
			const fileContent = await webcontainerInstance.fs.readFile(
				filePath,
				"utf-8",
			);
			// console.log("here it is", fileContent);
			setCode(fileContent);
			setCurrentFile(filePath);
			console.log("current-working file, ", filePath);
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
					currentFile,
					code,
					"utf-8",
				);
				console.log(`File ${currentFile} updated Successfully!`);
			} catch (e) {
				console.error("Error saving the file: ", e);
			}
		}
	};

	const readDirectoryTree = useCallback(
		async (path = "/") => {
			const items = await webcontainerInstance.fs.readdir(path, {
				withFileTypes: true,
			});
			const tree = [];
			// console.log("Before items: ", items);

			for (const item of items) {
				const fullPath = `${path}${item.name}${item._type === 2 ? "/" : ""}`;
				if (item._type === 2) {
					tree.push({
						name: item.name,
						path: fullPath,
						type: "directory",
						children: await readDirectoryTree(fullPath),
					});
				} else {
					tree.push({
						name: item.name,
						path: fullPath,
						type: "file",
					});
				}
			}

			// console.log(tree);
			return tree;
		},
		[webcontainerInstance],
	);

	const isDir = useCallback(
		async (path) => {
			try {
				const entries = await webcontainerInstance.fs.readdir(path, {
					withFileTypes: true,
				});
				return Array.isArray(entries);
			} catch (err) {
				return false;
			}
		},
		[webcontainerInstance],
	);

	const setupRecursiveWatchers = useCallback(
		async (path = "/") => {
			const watchers = [];

			// file guard
			if (!(await isDir(path))) {
				console.log("its a file");
				return [];
			}
			console.log("path here: ", path);

			if (path.includes("node_modules")) {
				console.log("its a node_modules folder...");
				return [];
			}

			const items = await webcontainerInstance.fs.readdir(path, {
				withFileTypes: true,
			});

			// Watch current directory
			const watcher = await webcontainerInstance.fs.watch(
				path,
				async (e, f) => {
					console.log(`Watched event: ${e} on file: ${f}`);
					const tree = await readDirectoryTree("/");
					setFiles(tree);

					// If a new directory is created, watch it
					if (e === "rename") {
						const fullPath = `${path}${f}`;
						console.log("fullPath: ", fullPath);

						if (await isDir(fullPath)) {
							const newWatchers = await setupRecursiveWatchers(
								`${fullPath}/`,
							);
							watchers.push(...newWatchers);
						}
					}
				},
			);

			watchers.push(watcher);

			// Recurse into subdirectories
			for (const item of items) {
				if (item._type === 2) {
					console.log(`${path}${item.name}`);
					// directory
					const subWatchers = await setupRecursiveWatchers(
						`${path}${item.name}/`,
					);
					watchers.push(...subWatchers);
				}
			}

			return watchers;
		},
		[readDirectoryTree, webcontainerInstance, isDir],
	);

	// for booting-up webcontainer
	useEffect(() => {
		if (bootedRef.current || webcontainerInstance) return;
		bootWC();
	}, [bootWC, webcontainerInstance]);

	// for fetching-files from VFS
	useEffect(() => {
		if (!webcontainerInstance) return;

		// initial VFS load
		const fetchTree = async () => {
			const tree = await readDirectoryTree("/");
			setFiles(tree);
		};
		fetchTree();

		// // watch the VFS
		// const setUpTerm = async () => {
		// 	const watcher = await webcontainerInstance.fs.watch(
		// 		"/",
		// 		async (e, p) => {
		// 			console.log(
		// 				`WAtched watched!!!! event: ${e} on path: ${p}`,
		// 			);

		// 			const tree = await readDirectoryTree("/");
		// 			setFiles(tree);
		// 		},
		// 	);

		// 	return () => {
		// 		watcher.close();
		// 	};
		// };
		// setUpTerm();

		let watchers = [];
		const setupWatchers = async () => {
			watchers = await setupRecursiveWatchers("/");
		};

		setupWatchers();

		return () => {
			watchers.forEach((w) => w.close());
		};
	}, [webcontainerInstance, readDirectoryTree, setupRecursiveWatchers]);

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

						<Filetree files={files} handleClick={handleClick} />
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

					{/* Inbrowser */}
					<Inbrowser />
				</div>

				<div className="flex justify-between items-center px-4 py-2 border-b bg-gray-50"></div>

				{/* Terminal  */}
				<div className="w-full border-t bg-black text-white mt-3 ">
					<div ref={terminalRef} className="p-2 h-[300px]" />
				</div>
			</div>

			{/* Apitest */}
			<Sheet>
				<SheetTrigger asChild>
					<button className="w-1/3 mt-5 mx-auto px-6 py-6 font-bold text-2xl font-mono bg-black text-white rounded-lg cursor-pointer active:opacity-70 active:scale-95 transition duration-150">
						ApiTest
					</button>
				</SheetTrigger>
				<SheetContent side="bottom">
					<SheetHeader>
						<p className="font-mono text-center font-bold">
							Test your apis here...
						</p>
					</SheetHeader>
					<Apitest />
				</SheetContent>
			</Sheet>
		</div>
	);
}
