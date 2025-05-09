export const mnt_file = {
	"package.json": {
		file: {
			contents: JSON.stringify(
				{
					name: "webcontainer-express",
					type: "module",
					main: "index.js",
					scripts: {
						start: "node index.js",
					},
					dependencies: {
						express: "^4.18.2",
						cors: "^2.8.5",
					},
				},
				null,
				2,
			),
		},
	},
	"index.js": {
		file: {
			contents: `
import express from 'express';
import cors from 'cors';

const app = express();
const port = 3000;

// Allow all origins
app.use(cors({ origin: 'http://localhost:5173' }));

app.options("*", cors())

app.get('/', (req, res) => {
  res.send('Hello from Express inside WebContainer!');
});

app.listen(port, '0.0.0.0', () => {
  console.log(\`Server is running at http://localhost:\${port}\`);
});
      `.trim(),
		},
	},
};
