import { useState, createContext } from "react";

const MyContext = createContext("");

export const MyContextProvider = ({ children }) => {
	const [url, setUrl] = useState("");

	return (
		<MyContext.Provider value={{ url, setUrl }}>
			{children}
		</MyContext.Provider>
	);
};

export default MyContext;
