function buildPreviewDocument(html: string) {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head><meta charset=\"utf-8\"><style>body{font-family:Georgia,serif;padding:1rem;line-height:1.6;color:#17212c}</style></head>",
    "<body>",
    html,
    "</body></html>",
  ].join("");
}

window.addEventListener("DOMContentLoaded", () => {
  const editor = document.querySelector<HTMLTextAreaElement>("[data-body-editor]");
  const preview = document.querySelector<HTMLIFrameElement>(".preview-frame iframe");
  const toolbar = document.querySelector<HTMLElement>('[role="toolbar"][aria-label="Format body"]');
  const mediaButton = document.querySelector<HTMLButtonElement>(".insert-media-btn");
  const mediaDialog = document.getElementById("media-library-dialog") as HTMLDialogElement | null;
  const mediaClose = document.getElementById("media-dialog-close");

  const syncPreview = () => {
    if (!editor || !preview) {
      return;
    }
    preview.srcdoc = buildPreviewDocument(editor.value);
  };

  const wrapSelection = (prefix: string, suffix: string, placeholder: string) => {
    if (!editor) {
      return;
    }

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = editor.value.slice(start, end) || placeholder;
    editor.value = editor.value.slice(0, start) + prefix + selected + suffix + editor.value.slice(end);
    editor.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    editor.focus();
    syncPreview();
  };

  if (editor) {
    syncPreview();
    editor.addEventListener("input", syncPreview);
  }

  toolbar?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const button = target.closest<HTMLElement>("[data-cmd]");
    if (!button) {
      return;
    }

    event.preventDefault();
    const cmd = button.getAttribute("data-cmd");
    if (cmd === "bold") {
      wrapSelection("<strong>", "</strong>", "Bold text");
    } else if (cmd === "italic") {
      wrapSelection("<em>", "</em>", "Italic text");
    } else if (cmd === "insertUnorderedList") {
      wrapSelection("<ul>\n  <li>", "</li>\n</ul>", "List item");
    } else if (cmd === "createLink") {
      const url = window.prompt("Enter URL:");
      if (url) {
        wrapSelection(`<a href="${url.replaceAll("\"", "&quot;")}">`, "</a>", "Link text");
      }
    }
  });

  mediaButton?.addEventListener("click", () => {
    mediaDialog?.showModal();
  });

  mediaClose?.addEventListener("click", () => {
    mediaDialog?.close();
  });
});
