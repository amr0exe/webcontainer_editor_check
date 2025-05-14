export const Filetree = ({ files, handleClick }) => {
	return (
		<div>
			<h2 className="font-bold text-lg mb-4 border-b pb-2">Files</h2>

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
	);
};
