import { useState, createContext, useRef } from "react";

const MyContext = createContext("");

export const MyContextProvider = ({ children }) => {
	const iframeRef = useRef(null);

	const [url, setUrl] = useState("");
	const [webcontainerInstance, setWebcontainerInstance] = useState(null);

	return (
		<MyContext.Provider
			value={{
				url,
				setUrl,
				webcontainerInstance,
				setWebcontainerInstance,
				iframeRef,
			}}
		>
			{children}
		</MyContext.Provider>
	);
};

export default MyContext;
