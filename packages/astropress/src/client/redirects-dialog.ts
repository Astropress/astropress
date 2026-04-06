window.addEventListener("DOMContentLoaded", () => {
  const dialog = document.getElementById("confirm-dialog") as HTMLDialogElement | null;
  const source = document.getElementById("dialog-source");
  const target = document.getElementById("dialog-target");
  const form = document.getElementById("confirm-form") as HTMLFormElement | null;

  document.querySelectorAll<HTMLElement>("[data-confirm-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!dialog || !source || !target || !form) {
        return;
      }

      const sourcePath = button.getAttribute("data-source-path") || "";
      source.textContent = sourcePath;
      target.textContent = button.getAttribute("data-target-path") || "";

      const sourcePathField = form.querySelector<HTMLInputElement>('input[name="sourcePath"]');
      if (sourcePathField) {
        sourcePathField.value = sourcePath;
      }

      dialog.showModal();
    });
  });

  document.querySelectorAll<HTMLElement>('[data-dialog-close="#confirm-dialog"]').forEach((button) => {
    button.addEventListener("click", () => {
      dialog?.close();
    });
  });
});
