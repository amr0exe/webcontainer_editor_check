// export const Filetree = ({ files, handleClick }) => {
// 	return (
// 		<div>
// 			<h2 className="font-bold text-lg mb-4 border-b pb-2">Files</h2>

// 			{files.map((file) => (
// 				<p
// 					key={file}
// 					onClick={() => handleClick(file)}
// 					className="cursor-pointer font-mono pl-2 hover:underline"
// 				>
// 					{file}
// 				</p>
// 			))}
// 		</div>
// 	);
// };

export const Filetree = ({ files, handleClick }) => {
	return (
		<div>
			{files.map((item) => (
				<div key={item.path} className="ml-2">
					{item.type === "directory" ? (
						<details>
							<summary className="cursor-pointer">
								{item.name}
							</summary>
							<Filetree
								files={item.children}
								handleClick={handleClick}
							/>
						</details>
					) : (
						<p
							onClick={() => handleClick(item.path)}
							className="cursor-poitner font-mono pl-2 hover:underline"
						>
							{item.name}
						</p>
					)}
				</div>
			))}
		</div>
	);
};
