import LazyDirectory from "./LazyDirectory";

export const Filetree = ({ files, handleClick, webcontainerInstance }) => {
	return (
		<div>
			{files.map((item) => (
				<div key={item.path} className="ml-2">
					{item.type === "directory" ? (
						item.children === "lazy" ? (
							<LazyDirectory
								path={item.path}
								handleClick={handleClick}
								webcontainerInstance={webcontainerInstance}
							/>
						) : (
							<details>
								<summary className="cursor-pointer">
									{item.name}
								</summary>
								<Filetree
									files={item.children}
									handleClick={handleClick}
									webcontainerInstance={webcontainerInstance}
								/>
							</details>
						)
					) : (
						<p
							onClick={() => handleClick(item.path)}
							className="cursor-pointer font-mono pl-2 hover:underline"
						>
							{item.name}
						</p>
					)}
				</div>
			))}
		</div>
	);
};
