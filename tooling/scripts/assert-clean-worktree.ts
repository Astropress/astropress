import { execFileSync } from "node:child_process";

function main() {
	const status = execFileSync("git", ["status", "--porcelain"], {
		cwd: process.cwd(),
		encoding: "utf8",
	}).trim();

	if (status.length > 0) {
		console.error("worktree is dirty after verification:\n");
		console.error(status);
		process.exit(1);
	}

	console.log("worktree is clean.");
}

main();
