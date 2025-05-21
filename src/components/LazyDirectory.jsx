import { useState } from "react";
import { Filetree } from "./Filetree";

const LazyDirectory = ({ path, handleClick, webcontainerInstance }) => {
	// Separate state for this directory's contents
	const [contents, setContents] = useState(null);
	const [isOpen, setIsOpen] = useState(false);

	const toggleOpen = async (e) => {
		if (e.target.open && contents === null) {
			// Fetch contents when opened for the first time
			const items = await webcontainerInstance.fs.readdir(path, {
				withFileTypes: true,
			});
			const tree = items.map((item) => {
				const fullPath = `${path}${item.name}${item._type === 2 ? "/" : ""}`;
				if (item._type === 2) {
					// Mark all subdirectories as lazy-loaded
					return {
						name: item.name,
						path: fullPath,
						type: "directory",
						children: "lazy",
					};
				} else {
					return {
						name: item.name,
						path: fullPath,
						type: "file",
					};
				}
			});
			console.log("Content: ", contents);
			setContents(tree);
		}
		console.log("expanded:", e.target.open);
		setIsOpen(e.target.open);
	};

	const displayName = path.split("/").filter(Boolean).pop() || "Unknown";

	return (
		<details onToggle={toggleOpen}>
			<summary className="cursor-pointer">{displayName}</summary>
			{isOpen && contents && (
				<Filetree
					files={contents}
					handleClick={handleClick}
					webcontainerInstance={webcontainerInstance}
				/>
			)}
		</details>
	);
};

export default LazyDirectory;
