function renderMathContent(element, tex, options = {}) {
  if (!(element instanceof Element) || !window.katex) {
    return;
  }

  const { displayMode = false } = options;

  element.textContent = "";
  window.katex.render(tex, element, {
    displayMode,
    throwOnError: false,
    strict: "ignore",
  });
}

function renderStaticMath(root = document.body) {
  if (!root || typeof window.renderMathInElement !== "function") {
    return;
  }

  window.renderMathInElement(root, {
    delimiters: [
      { left: "\\[", right: "\\]", display: true },
      { left: "\\(", right: "\\)", display: false },
    ],
    throwOnError: false,
    strict: "ignore",
  });
}

function updateMathScrollState(root = document) {
  if (!root) {
    return;
  }

  const mathDisplays = root.querySelectorAll(".math-display");

  mathDisplays.forEach((display) => {
    if (!(display instanceof HTMLElement)) {
      return;
    }

    const isScrollable = display.scrollWidth - display.clientWidth > 8;
    display.classList.toggle("is-scrollable", isScrollable);
  });
}

function bindMathScroll(root = document) {
  if (!root) {
    return;
  }

  const mathDisplays = root.querySelectorAll(".math-display");

  mathDisplays.forEach((display) => {
    if (!(display instanceof HTMLElement) || display.dataset.mathScrollBound === "true") {
      return;
    }

    display.dataset.mathScrollBound = "true";

    display.addEventListener(
      "wheel",
      (event) => {
        const hasHorizontalOverflow = display.scrollWidth - display.clientWidth > 8;
        const mostlyVerticalWheel = Math.abs(event.deltaY) > Math.abs(event.deltaX);

        if (!hasHorizontalOverflow || !mostlyVerticalWheel) {
          return;
        }

        display.scrollLeft += event.deltaY;
        event.preventDefault();
      },
      { passive: false }
    );
  });
}

window.renderMathContent = renderMathContent;
window.renderStaticMath = renderStaticMath;
window.updateMathScrollState = updateMathScrollState;
window.bindMathScroll = bindMathScroll;

document.addEventListener("DOMContentLoaded", () => {
  renderStaticMath();
  bindMathScroll();
  updateMathScrollState();
});

window.addEventListener("resize", () => {
  updateMathScrollState();
});
