const slides = Array.from(document.querySelectorAll(".slide"));
const counter = document.getElementById("slideCounter");
const pagination = document.getElementById("pagination");
const prevButton = document.getElementById("prevButton");
const nextButton = document.getElementById("nextButton");
const hoverCard = document.getElementById("termHoverCard");
const hoverCardLabel = document.getElementById("hoverCardLabel");
const hoverCardTitle = document.getElementById("hoverCardTitle");
const hoverCardFormula = document.getElementById("hoverCardFormula");
const hoverCardDescription = document.getElementById("hoverCardDescription");
const modal = document.getElementById("termModal");
const closeModalButton = document.getElementById("closeModalButton");
const modalTitle = document.getElementById("modalTitle");
const modalFormula = document.getElementById("modalFormula");
const modalDescription = document.getElementById("modalDescription");
const modalDetail = document.getElementById("modalDetail");
const modalLabel = document.getElementById("modalLabel");
const termButtons = Array.from(document.querySelectorAll(".term-button"));

function renderFormulaSlot(element, tex, displayMode = false) {
  if (!(element instanceof Element)) {
    return;
  }

  if (typeof window.renderMathContent === "function") {
    window.renderMathContent(element, tex, { displayMode });
    return;
  }

  element.textContent = tex;
}

const termDetails = {
  Lo: {
    label: "Outgoing Radiance",
    title: "出射辐亮度",
    formulaTex: "L_o(x,\\omega_o)",
    description: "它表示表面点 x 沿着观察方向 omega_o 射向相机的光强，是我们最终真正看见的结果。",
    detail:
      "当路径追踪器为像素求值时，本质上就是在估计这一项。屏幕上的明暗与颜色，最终都落在这个出射辐亮度上。",
  },
  Le: {
    label: "Emitted Radiance",
    title: "自发光项",
    formulaTex: "L_e(x,\\omega_o)",
    description: "它描述物体本身是否会发光，例如灯泡表面、发光材质或天空盒对外辐射的能量。",
    detail:
      "如果一个表面不主动发光，这一项通常为 0。它让渲染方程既能描述普通物体，也能描述光源本身。",
  },
  Integral: {
    label: "Hemisphere Integral",
    title: "半球积分",
    formulaTex: "\\int_{\\Omega}",
    description: "积分符号表示我们需要把表面上方半球中所有可能的入射方向都考虑进去，再把它们的贡献累加。",
    detail:
      "真实世界中的光来自连续方向集合，所以这是一个积分问题。数值渲染通常用采样近似它，而不是逐方向精确求完。",
  },
  fr: {
    label: "BRDF",
    title: "双向反射分布函数",
    formulaTex: "f_r(x,\\omega_i,\\omega_o)",
    description: "BRDF 描述材质如何把来自 omega_i 的入射光，重新分配到 omega_o 这个出射方向。",
    detail:
      "它决定了表面是偏漫反射、镜面反射，还是更复杂的粗糙金属效果。PBR 材质建模的大量工作都围绕这一项展开。",
  },
  Li: {
    label: "Incoming Radiance",
    title: "入射辐亮度",
    formulaTex: "L_i(x,\\omega_i)",
    description: "它表示从某个入射方向 omega_i 抵达点 x 的光能量，可能来自灯光、环境光或其他表面的反弹。",
    detail:
      "如果场景里阴影遮挡了这个方向，或者该方向没有光源贡献，那么这一项就会变弱甚至消失。",
  },
  Cosine: {
    label: "Foreshortening",
    title: "余弦项",
    formulaTex: "(n \\cdot \\omega_i)",
    description: "法线 n 与入射方向的点积表示入射角影响，越正对表面的光贡献越大，越斜射的光贡献越小。",
    detail:
      "这体现了投影面积变化，也就是经典的 Lambert 余弦规律。它保证了能量从几何角度被正确缩放。",
  },
  Measure: {
    label: "Solid Angle Measure",
    title: "立体角微分",
    formulaTex: "d\\omega_i",
    description: "它说明积分是在方向空间上进行，累加单位是一个个极小的立体角区域。",
    detail:
      "虽然它不显眼，但它决定了积分的数学语义，也提醒我们采样时要考虑概率密度与测度的一致性。",
  },
};

let currentSlide = 0;
let wheelLocked = false;
let lastFocusedTrigger = null;
let hoverAnchor = null;

function getScrollablePanel(target) {
  if (!(target instanceof Element)) {
    return null;
  }

  const panel = target.closest(".slide-panel");
  return panel instanceof HTMLElement ? panel : null;
}

function panelHasVerticalOverflow(panel) {
  if (!(panel instanceof HTMLElement)) {
    return false;
  }

  return panel.scrollHeight - panel.clientHeight > 1;
}

function renderPagination() {
  pagination.innerHTML = "";

  slides.forEach((_, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = index === currentSlide ? "is-current" : "";
    dot.setAttribute("aria-label", `跳转到第 ${index + 1} 页`);
    dot.setAttribute("aria-current", index === currentSlide ? "true" : "false");
    dot.addEventListener("click", () => goToSlide(index));
    pagination.appendChild(dot);
  });
}

function updateSlides() {
  slides.forEach((slide, index) => {
    slide.classList.toggle("is-active", index === currentSlide);
  });

  hideHoverCard();
  counter.textContent = `${String(currentSlide + 1).padStart(2, "0")} / ${String(
    slides.length
  ).padStart(2, "0")}`;

  renderPagination();
}

function goToSlide(index) {
  currentSlide = (index + slides.length) % slides.length;
  updateSlides();
}

function stepSlide(direction) {
  goToSlide(currentSlide + direction);
}

function canScrollCurrentPanel(target, deltaY) {
  const panel = getScrollablePanel(target);
  if (!panel || !panelHasVerticalOverflow(panel)) {
    return false;
  }

  const maxScrollTop = panel.scrollHeight - panel.clientHeight;
  if (maxScrollTop <= 1) {
    return false;
  }

  if (deltaY > 0) {
    return panel.scrollTop < maxScrollTop - 1;
  }

  if (deltaY < 0) {
    return panel.scrollTop > 1;
  }

  return false;
}

function positionHoverCard(target) {
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const rect = target.getBoundingClientRect();
  const viewportPadding = 12;
  const offset = 14;
  const cardWidth = hoverCard.offsetWidth;
  const cardHeight = hoverCard.offsetHeight;
  let left = rect.left + rect.width / 2 - cardWidth / 2;
  let top = rect.top - cardHeight - offset;

  left = Math.min(Math.max(left, viewportPadding), window.innerWidth - cardWidth - viewportPadding);

  if (top < viewportPadding) {
    top = rect.bottom + offset;
  }

  top = Math.min(top, window.innerHeight - cardHeight - viewportPadding);

  hoverCard.style.left = `${left}px`;
  hoverCard.style.top = `${top}px`;
}

function showHoverCard(termKey, target) {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    return;
  }

  const detail = termDetails[termKey];
  if (!detail || !(target instanceof HTMLElement)) {
    return;
  }

  hoverAnchor = target;
  hoverCardLabel.textContent = detail.label;
  hoverCardTitle.textContent = detail.title;
  renderFormulaSlot(hoverCardFormula, detail.formulaTex);
  hoverCardDescription.textContent = detail.description;
  hoverCard.classList.add("is-visible");
  hoverCard.setAttribute("aria-hidden", "false");
  positionHoverCard(target);
}

function hideHoverCard() {
  hoverAnchor = null;
  hoverCard.classList.remove("is-visible");
  hoverCard.setAttribute("aria-hidden", "true");
}

function openModal(termKey) {
  const detail = termDetails[termKey];
  if (!detail) {
    return;
  }

  hideHoverCard();
  lastFocusedTrigger = document.activeElement;
  modalLabel.textContent = detail.label;
  modalTitle.textContent = detail.title;
  renderFormulaSlot(modalFormula, detail.formulaTex);
  modalDescription.textContent = detail.description;
  modalDetail.textContent = detail.detail;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  closeModalButton.focus();
}

function closeModal() {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");

  if (lastFocusedTrigger instanceof HTMLElement) {
    lastFocusedTrigger.focus();
  }
}

prevButton.addEventListener("click", () => stepSlide(-1));
nextButton.addEventListener("click", () => stepSlide(1));

termButtons.forEach((button) => {
  button.addEventListener("mouseenter", () => {
    showHoverCard(button.dataset.term, button);
  });

  button.addEventListener("mouseleave", hideHoverCard);

  button.addEventListener("focus", () => {
    showHoverCard(button.dataset.term, button);
  });

  button.addEventListener("blur", hideHoverCard);

  button.addEventListener("click", () => {
    openModal(button.dataset.term);
  });
});

closeModalButton.addEventListener("click", closeModal);

modal.addEventListener("click", (event) => {
  const closeTarget = event.target.closest("[data-close-modal]");
  if (closeTarget) {
    closeModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modal.classList.contains("is-open")) {
    closeModal();
    return;
  }

  if (modal.classList.contains("is-open")) {
    return;
  }

  if (event.key === "ArrowRight" || event.key === "PageDown") {
    stepSlide(1);
  }

  if (event.key === "ArrowLeft" || event.key === "PageUp") {
    stepSlide(-1);
  }
});

window.addEventListener(
  "wheel",
  (event) => {
    const activePanel = getScrollablePanel(event.target);
    const wheelInsideScrollablePanel = panelHasVerticalOverflow(activePanel);

    if (
      modal.classList.contains("is-open") ||
      wheelLocked ||
      Math.abs(event.deltaY) < 18 ||
      canScrollCurrentPanel(event.target, event.deltaY)
    ) {
      return;
    }

    if (wheelInsideScrollablePanel && !event.shiftKey) {
      return;
    }

    wheelLocked = true;
    stepSlide(event.deltaY > 0 ? 1 : -1);

    window.setTimeout(() => {
      wheelLocked = false;
    }, 650);
  },
  { passive: true }
);

let touchStartY = 0;

window.addEventListener("resize", () => {
  if (hoverAnchor) {
    positionHoverCard(hoverAnchor);
  }
});

document.addEventListener("scroll", () => {
  if (hoverAnchor) {
    hideHoverCard();
  }
}, true);

window.addEventListener(
  "touchstart",
  (event) => {
    touchStartY = event.changedTouches[0].clientY;
  },
  { passive: true }
);

window.addEventListener(
  "touchend",
  (event) => {
    if (modal.classList.contains("is-open")) {
      return;
    }

    const touchEndY = event.changedTouches[0].clientY;
    const delta = touchStartY - touchEndY;

    if (Math.abs(delta) < 50) {
      return;
    }

    stepSlide(delta > 0 ? 1 : -1);
  },
  { passive: true }
);

updateSlides();
