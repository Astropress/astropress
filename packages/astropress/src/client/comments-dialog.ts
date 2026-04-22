window.addEventListener("DOMContentLoaded", () => {
	const dialog = document.getElementById(
		"reject-dialog",
	) as HTMLDialogElement | null;
	const author = document.getElementById("reject-author");
	const route = document.getElementById("reject-route");
	const form = document.getElementById("reject-form") as HTMLFormElement | null;

	for (const button of document.querySelectorAll<HTMLElement>(
		"[data-confirm-reject]",
	)) {
		button.addEventListener("click", () => {
			if (!dialog || !author || !route || !form) {
				return;
			}

			author.textContent = button.getAttribute("data-author") || "";
			route.textContent = button.getAttribute("data-route") || "";

			const commentIdField = form.querySelector<HTMLInputElement>(
				'input[name="commentId"]',
			);
			if (commentIdField) {
				commentIdField.value = button.getAttribute("data-comment-id") || "";
			}

			dialog.showModal();
		});
	}

	for (const button of document.querySelectorAll<HTMLElement>(
		'[data-dialog-close="#reject-dialog"]',
	)) {
		button.addEventListener("click", () => {
			dialog?.close();
		});
	}
});
