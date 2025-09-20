import { useState, useContext, useEffect } from "react";
import MyContext from "@/context/Context";

export const Inbrowser = () => {
	const { url, iframeRef } = useContext(MyContext);
	const [isEditing, setIsEditing] = useState(false);
	const [chg, setChg] = useState("");
	const [isLoading, setIsLoading] = useState(true);

	// Reset loading when URL changes
	useEffect(() => {
		if (url && iframeRef.current) {
			setIsLoading(true);

			setTimeout(() => {
				if (iframeRef.current) {
					iframeRef.current.src = url
				}
			}, 1000)
		}
	}, [url, iframeRef]);

	const handleKeyDown = (e) => {
		if (e.key === "Enter") {
			setIsEditing(false);
			if (chg && iframeRef.current) {
				setIsLoading(true);
				iframeRef.current.src = chg;
			}
		} else if (e.key === "Escape") {
			setIsEditing(false);
		}
	};

	const handleIframeLoad = () => {
		setIsLoading(false);
		console.log("Iframe content loaded successfully");
	};

	return (
		<div className="w-full h-full border-l flex flex-col">
			{/* URL Bar */}
			<div className="w-[80%] h-8 rounded-md border border-gray-400 bg-gray-100 flex items-center px-3 mx-auto mt-2 overflow-hidden">
				{isEditing ? (
					<input
						type="text"
						value={chg ? chg : url}
						onChange={(e) => setChg(e.target.value)}
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
						{url || "Click 'Run' to start server"}
					</div>
				)}
			</div>

			{/* Iframe Content with Loading State */}
			<div className="w-full flex-grow mt-2 relative">
				{isLoading && url && (
					<div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
						<div className="text-gray-600 font-mono">Loading...</div>
					</div>
				)}

				{!url && (
					<div className="absolute inset-0 bg-gray-50 flex items-center justify-center">
						<div className="text-gray-500 font-mono text-center">
							<p>Server not running</p>
							<p className="text-sm mt-2">Click "Run" to start the development server</p>
						</div>
					</div>
				)}

				<iframe
					ref={iframeRef}
					allow="cross-origin-isolated; microphone; camera"
					className="w-full h-full bg-white"
					sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
					// credentialless="true"
					onLoad={handleIframeLoad}
					onError={(e) => {
						console.error("Iframe error:", e);
						setIsLoading(false);
					}}
				/>
			</div>
		</div>
	);
};
