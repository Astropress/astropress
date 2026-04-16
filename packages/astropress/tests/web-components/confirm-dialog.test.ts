// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { ApConfirmDialog } from "../../web-components/confirm-dialog";

// jsdom doesn't implement showModal/close — provide minimal stubs
function stubDialog(dialog: HTMLDialogElement) {
  let open = false;
  dialog.showModal = () => { open = true; dialog.setAttribute("open", ""); };
  dialog.close = () => { open = false; dialog.removeAttribute("open"); };
  Object.defineProperty(dialog, "open", { get: () => open, configurable: true });
}

function makeConfirmDialog() {
  const container = document.createElement("ap-confirm-dialog") as ApConfirmDialog;
  container.innerHTML = `
    <dialog id="confirm-dialog" aria-labelledby="confirm-title">
      <h2 id="confirm-title">Confirm?</h2>
      <p><strong id="dialog-source"></strong> → <strong id="dialog-target"></strong></p>
      <form id="confirm-form" method="post">
        <input type="hidden" name="sourcePath" value="" />
        <button type="submit">Confirm</button>
      </form>
      <button type="button" data-dialog-close>Cancel</button>
    </dialog>
  `;
  const dialog = container.querySelector<HTMLDialogElement>("dialog")!;
  stubDialog(dialog);
  return { container, dialog };
}

function makeTrigger(dialogId: string, attrs: Record<string, string> = {}) {
  const btn = document.createElement("button");
  btn.setAttribute("data-confirm-trigger", "");
  btn.setAttribute("data-dialog-id", dialogId);
  for (const [k, v] of Object.entries(attrs)) {
    btn.setAttribute(k, v);
  }
  btn.textContent = "Delete";
  return btn;
}

describe("ApConfirmDialog", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("is registered as a custom element", () => {
    expect(customElements.get("ap-confirm-dialog")).toBeDefined();
  });

  it("opens the dialog when a matching trigger is clicked", () => {
    const { container, dialog } = makeConfirmDialog();
    const trigger = makeTrigger("confirm-dialog");
    document.body.appendChild(container);
    document.body.appendChild(trigger);

    trigger.click();
    expect(dialog.getAttribute("open")).toBe("");
  });

  it("does not open for a trigger targeting a different dialog id", () => {
    const { container, dialog } = makeConfirmDialog();
    const trigger = makeTrigger("other-dialog");
    document.body.appendChild(container);
    document.body.appendChild(trigger);

    trigger.click();
    expect(dialog.getAttribute("open")).toBeNull();
  });

  it("sets text content on named elements from data-text-* attributes", () => {
    const { container, dialog } = makeConfirmDialog();
    const trigger = makeTrigger("confirm-dialog", {
      "data-text-dialog-source": "/old-path",
      "data-text-dialog-target": "/new-path",
    });
    document.body.appendChild(container);
    document.body.appendChild(trigger);

    trigger.click();
    expect(dialog.querySelector("#dialog-source")!.textContent).toBe("/old-path");
    expect(dialog.querySelector("#dialog-target")!.textContent).toBe("/new-path");
  });

  it("sets form input values from data-field-name + data-field-value attributes", () => {
    const { container, dialog } = makeConfirmDialog();
    const trigger = makeTrigger("confirm-dialog", {
      "data-field-name": "sourcePath",
      "data-field-value": "/old-path",
    });
    document.body.appendChild(container);
    document.body.appendChild(trigger);

    trigger.click();
    expect(dialog.querySelector<HTMLInputElement>('input[name="sourcePath"]')!.value).toBe("/old-path");
  });

  it("closes the dialog when the close button is clicked", () => {
    const { container, dialog } = makeConfirmDialog();
    const trigger = makeTrigger("confirm-dialog");
    document.body.appendChild(container);
    document.body.appendChild(trigger);

    trigger.click(); // open
    expect(dialog.getAttribute("open")).toBe("");

    dialog.querySelector<HTMLButtonElement>("[data-dialog-close]")!.click(); // close
    expect(dialog.getAttribute("open")).toBeNull();
  });

  it("stops handling clicks after disconnectedCallback", () => {
    const { container, dialog } = makeConfirmDialog();
    const trigger = makeTrigger("confirm-dialog");
    document.body.appendChild(container);
    document.body.appendChild(trigger);

    document.body.removeChild(container);
    trigger.click();

    // Dialog should not have opened since the listener was removed
    expect(dialog.getAttribute("open")).toBeNull();
  });
});
