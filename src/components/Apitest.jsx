import { useState, useContext } from "react";
import MyContext from "../context/Context";

export const Apitest = () => {
	const [method, setMethod] = useState("GET");
	const [header, setHeader] = useState("");
	const [data, setData] = useState("");
	const [path, setPath] = useState("/");
	const [resp, setResp] = useState("");

	const { webcontainerInstance, url } = useContext(MyContext);

	// curl-automation
	const curlAutomate = async () => {
		// clear before req
		setResp("");

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

	return (
		<div className="flex font-mono h-[30vh]">
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

					<label className="block font-bold mb-1">JSON BODY</label>
					<textarea
						className="w-2/5 border p-2 font-mono resize-y min-h-[100px]"
						placeholder={`{\n  "key": "value"\n}`}
						value={data}
						onChange={(e) => setData(e.target.value)}
					/>
				</div>

				<button
					className="px-6 py-2 bg-black text-white rounded-lg mt-2 cursor-pointer active:opacity-30 active:scale-125 transition duration-150"
					onClick={curlAutomate}
				>
					runCurl
				</button>
			</div>

			{/* Right: Output Viewer - 40% */}
			<div className="w-2/5 p-4 bg-gray-50 border-l overflow-auto max-h-[300px]">
				<h3 className="font-bold mb-2">Response Headers</h3>
				<p className="font-mono text-sm whitespace-pre-wrap">{resp}</p>
			</div>
		</div>
	);
};
