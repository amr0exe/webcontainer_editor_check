import { useState, useContext } from "react";
import MyContext from "@/context/Context";

export const Inbrowser = () => {
	const { url, iframeRef } = useContext(MyContext);
	const [isEditing, setIsEditing] = useState(false);
	const [chg, setChg] = useState("");

	// for url-bar
	const handleKeyDown = (e) => {
		if (e.key === "Enter") {
			setIsEditing(false);
			iframeRef.current.src = chg;
		} else if (e.key === "Escape") {
			setIsEditing(false);
		}
	};

	return (
		<div className="w-[40%] border-l flex flex-col">
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
						{url}
					</div>
				)}
			</div>

			{/* Iframe Content */}
			<iframe
				ref={iframeRef}
				allow="cross-origin-isolated; microphone; camera"
				className="w-full flex-grow mt-2"
				sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
				credentialless="true"
			/>
		</div>
	);
};
