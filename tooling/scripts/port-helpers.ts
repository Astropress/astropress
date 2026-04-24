import net from "node:net";

async function canBindPort(port: number): Promise<boolean> {
	return new Promise<boolean>((resolve) => {
		const server = net.createServer();
		server.once("error", () => resolve(false));
		server.listen(port, "127.0.0.1", () => {
			server.close(() => resolve(true));
		});
	});
}

export async function findAvailablePort(
	preferredPort: number,
	label: string,
	maxAttempts = 100,
): Promise<number> {
	for (
		let port = preferredPort;
		port < preferredPort + maxAttempts;
		port += 1
	) {
		if (await canBindPort(port)) return port;
	}

	const finalPort = preferredPort + maxAttempts - 1;
	throw new Error(
		`Unable to find an available ${label} port in range 127.0.0.1:${preferredPort}-${finalPort}`,
	);
}
