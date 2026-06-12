const heroScreen = document.getElementById("heroScreen");
const openBookBtn = document.getElementById("openBookBtn");
const bookShell = document.getElementById("bookShell");
const book = document.getElementById("book");
const leftPage = document.getElementById("leftPage");
const rightPage = document.getElementById("rightPage");
const flipSheet = document.getElementById("flipSheet");
const sheetFront = document.getElementById("sheetFront");
const sheetBack = document.getElementById("sheetBack");
const coverBtn = document.getElementById("coverBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const bookProgress = document.getElementById("bookProgress");

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
// Touch devices turn pages by swipe and zoom a photo by tapping it; pointer
// devices turn by clicking a page half and zoom by double-clicking.
const coarsePointer = window.matchMedia("(hover: none) and (pointer: coarse)");
// Keep in sync with the turn animation duration in styles.css.
const TURN_DURATION_MS = 1320;
const COVER_FILE = "Cover.jpg";
const INSIDE_COVER_FILE = "inside cover.JPG";
const MARGIN_PRESETS = {
  bleed: "0px",
  tight: "clamp(4px, 0.55vw, 8px)",
  normal: "clamp(7px, 0.9vw, 12px)",
  wide: "clamp(14px, 1.6vw, 22px)",
};
let spreads = [];
let currentIndex = 0;
let isAnimating = false;
let hasLoaded = false;

function isTouch() {
  return coarsePointer.matches;
}

openBookBtn.addEventListener("click", () => {
  heroScreen.classList.add("hidden");
  bookShell.classList.remove("hidden");

  if (!hasLoaded) {
    loadImages();
  }
});

prevBtn.addEventListener("click", () => navigate(-1));
nextBtn.addEventListener("click", () => navigate(1));
coverBtn.addEventListener("click", () => jumpToCover());

// Page interaction differs by input type so turning and zooming never collide:
//  - pointer (desktop): click a page half to turn; zoom via the per-photo button.
//  - touch (mobile): swipe to turn; tap a photo to zoom it.
let swipeHandled = false;

[
  [leftPage, -1],
  [rightPage, 1],
].forEach(([page, direction]) => {
  page.addEventListener("click", () => {
    if (isTouch()) {
      if (swipeHandled) return; // ignore the click that trails a swipe
      openZoom(page);
    } else {
      navigate(direction);
    }
  });
});

// Touch swipe: drag left to advance, right to go back.
const SWIPE_THRESHOLD = 45;
let touchStartX = null;
let touchStartY = null;

book.addEventListener(
  "touchstart",
  (event) => {
    if (event.touches.length !== 1) return;
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
  },
  { passive: true }
);

book.addEventListener(
  "touchend",
  (event) => {
    if (touchStartX === null) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    touchStartX = null;
    touchStartY = null;

    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
    swipeHandled = true;
    navigate(dx < 0 ? 1 : -1);
    setTimeout(() => {
      swipeHandled = false;
    }, 400);
  },
  { passive: true }
);

document.addEventListener("keydown", (event) => {
  if (bookShell.classList.contains("hidden")) return;

  if (event.key === "Escape" && isZoomOpen()) {
    closeZoom();
    return;
  }

  if (isZoomOpen()) return;

  if (event.key === "ArrowLeft") {
    navigate(-1);
  }

  if (event.key === "ArrowRight") {
    navigate(1);
  }

  if (event.key === "Home") {
    jumpToCover();
  }
});

function navigate(direction) {
  if (isAnimating || spreads.length === 0) return;

  const targetIndex = currentIndex + direction;

  if (targetIndex < 0 || targetIndex >= spreads.length) return;

  if (prefersReducedMotion.matches) {
    currentIndex = targetIndex;
    renderSpread(spreads[currentIndex]);
    updateControls();
    preloadAdjacent();
    return;
  }

  const currentSpread = spreads[currentIndex];
  const targetSpread = spreads[targetIndex];

  prepareTurn(direction, currentSpread, targetSpread);
  playTurn(direction, targetIndex);
}

function progressLabel() {
  if (!spreads.length) return "Preparing spreads";
  return currentIndex === 0 ? `Cover / ${spreads.length}` : `Spread ${currentIndex + 1} / ${spreads.length}`;
}

function updateControls() {
  prevBtn.disabled = isAnimating || currentIndex <= 0;
  nextBtn.disabled = isAnimating || currentIndex >= spreads.length - 1;
  coverBtn.disabled = isAnimating || spreads.length === 0 || currentIndex === 0;
  bookProgress.textContent = progressLabel();
}

function imagePath(file) {
  return `Images/${file.split("/").map(encodeURIComponent).join("/")}`;
}

function isSameFile(a, b) {
  return a?.toLowerCase() === b?.toLowerCase();
}

function blankPage(label = "") {
  return { type: "blank", label };
}

function titlePage() {
  return {
    type: "title",
    eyebrow: "Love Letter to Glasgow",
    title: "Street photography",
    text: "A more tactile prototype for the book itself: slower turns, visible depth, and a gentler sense of the spread settling on the table.",
  };
}

function endpaperPage() {
  return {
    type: "endpaper",
  };
}

function insideCoverPage() {
  return {
    type: "insidecover",
  };
}

function frontMatterPage() {
  return {
    type: "frontmatter",
    eyebrow: "Finding beauty in the ordinary on the streets of Glasgow",
  };
}

function coverPage(file) {
  return {
    type: "cover",
    file,
    title: "Love Letter to Glasgow",
    note: "Fragments from the street",
  };
}

function imagePage(file, options = {}) {
  return {
    type: "image",
    file,
    bleedHalf: options.bleedHalf ?? null,
    overlay: options.overlay ?? null,
    margin: options.margin ?? null,
  };
}

function buildBookIntroSpreads() {
  return [
    {
      left: insideCoverPage(),
      right: coverPage(COVER_FILE),
    },
    {
      left: imagePage(INSIDE_COVER_FILE, {
        bleedHalf: "left",
        overlay: frontMatterPage(),
      }),
      right: imagePage(INSIDE_COVER_FILE, { bleedHalf: "right" }),
    },
  ];
}

function getManualSpreadEntries(manifest) {
  if (Array.isArray(manifest) && manifest.some((entry) => typeof entry === "object" && entry !== null)) {
    return manifest;
  }

  if (!Array.isArray(manifest) && Array.isArray(manifest?.spreads)) {
    return manifest.spreads;
  }

  return null;
}

function normalizeTextDescriptor(descriptor) {
  if (!descriptor || typeof descriptor !== "object") return null;

  return {
    type: descriptor.type ?? "frontmatter",
    eyebrow: descriptor.eyebrow ?? "",
    title: descriptor.title ?? "",
    text: descriptor.text ?? "",
  };
}

function normalizeManualPage(spec, side, defaults = {}) {
  if (spec == null) {
    return blankPage();
  }

  if (typeof spec === "string") {
    return imagePage(spec, {
      margin: defaults.margin,
      overlay: side === "left" ? normalizeTextDescriptor(defaults.overlay) : null,
    });
  }

  if (typeof spec !== "object") {
    return blankPage();
  }

  if (spec.type === "blank") {
    return blankPage(spec.label ?? "");
  }

  if (spec.type === "title" || spec.type === "frontmatter" || spec.type === "endpaper" || spec.type === "insidecover") {
    return {
      type: spec.type,
      eyebrow: spec.eyebrow ?? "",
      title: spec.title ?? "",
      text: spec.text ?? "",
    };
  }

  const file = spec.file ?? spec.image ?? spec.src;

  if (!file) {
    return blankPage(spec.label ?? "");
  }

  return imagePage(file, {
    margin: spec.margin ?? defaults.margin,
    overlay: normalizeTextDescriptor(spec.overlay ?? (side === "left" ? defaults.overlay : null)),
  });
}

function normalizeManualSpread(entry) {
  if (typeof entry === "string") {
    return {
      left: blankPage(),
      right: imagePage(entry),
    };
  }

  if (!entry || typeof entry !== "object") {
    return null;
  }

  if (entry.spread) {
    const spreadSpec = typeof entry.spread === "string" ? { file: entry.spread } : entry.spread;
    const file = spreadSpec.file ?? spreadSpec.image ?? spreadSpec.src;

    if (!file) {
      return null;
    }

    const overlay = normalizeTextDescriptor(spreadSpec.overlay ?? entry.overlay);
    const margin = spreadSpec.margin ?? entry.margin;

    return {
      left: imagePage(file, {
        bleedHalf: "left",
        overlay,
        margin,
      }),
      right: imagePage(file, {
        bleedHalf: "right",
        margin,
      }),
    };
  }

  return {
    left: normalizeManualPage(entry.left, "left", entry),
    right: normalizeManualPage(entry.right, "right", entry),
  };
}

function buildManualSpreads(manifest) {
  const manualEntries = getManualSpreadEntries(manifest) ?? [];
  return buildBookIntroSpreads().concat(manualEntries.map(normalizeManualSpread).filter(Boolean));
}

function buildAutoSpreads(images) {
  const entries = images.map((filename) => ({ filename, ratio: 1 }));
  const metadataPromises = entries.map(
    (entry) =>
      new Promise((resolve) => {
        const img = new Image();
        img.src = imagePath(entry.filename);
        img.onload = () => {
          entry.ratio = img.naturalWidth / img.naturalHeight;
          resolve();
        };
        img.onerror = () => resolve();
      })
  );

  Promise.all(metadataPromises).then(() => {
    const explicitCoverIndex = entries.findIndex((entry) => isSameFile(entry.filename, COVER_FILE));
    const explicitInsideCoverIndex = entries.findIndex((entry) => isSameFile(entry.filename, INSIDE_COVER_FILE));

    if (explicitCoverIndex >= 0) {
      entries.splice(explicitCoverIndex, 1);
    }

    if (explicitInsideCoverIndex >= 0) {
      const adjustedIndex = explicitInsideCoverIndex > explicitCoverIndex && explicitCoverIndex >= 0 ? explicitInsideCoverIndex - 1 : explicitInsideCoverIndex;
      entries.splice(adjustedIndex, 1);
    }

    const nextSpreads = buildBookIntroSpreads();

    if (entries.length > 0) {
      nextSpreads.push({
        left: blankPage(),
        right: imagePage(entries[0].filename),
      });
    }

    for (let index = entries.length > 0 ? 1 : 0; index < entries.length; ) {
      const current = entries[index];
      const next = entries[index + 1];

      if (current.ratio >= 1.45) {
        nextSpreads.push({
          left: imagePage(current.filename, { bleedHalf: "left" }),
          right: imagePage(current.filename, { bleedHalf: "right" }),
        });
        index += 1;
        continue;
      }

      if (next) {
        nextSpreads.push({
          left: imagePage(current.filename),
          right: imagePage(next.filename),
        });
        index += 2;
        continue;
      }

      nextSpreads.push({
        left: blankPage(),
        right: imagePage(current.filename),
      });
      index += 1;
    }

    setSpreads(nextSpreads);
  });
}

function buildSpreads(manifest) {
  const manualEntries = getManualSpreadEntries(manifest);

  if (manualEntries) {
    setSpreads(buildManualSpreads(manifest));
    return;
  }

  const images = Array.isArray(manifest) ? manifest.filter((entry) => typeof entry === "string") : [];
  buildAutoSpreads(images);
}

function setSpreads(list) {
  spreads = list.slice();
  currentIndex = 0;
  hasLoaded = true;
  renderSpread(spreads[currentIndex]);
  updateControls();
  preloadAdjacent();
}

function renderSpread(spread) {
  renderPageFace(leftPage, spread.left, "left");
  renderPageFace(rightPage, spread.right, "right");
  book.dataset.spreadBleed = spread.left?.bleedHalf && spread.right?.bleedHalf ? "true" : "false";
  syncBookState();
}

// Warm the browser cache for nearby spreads so a turn never reveals a load gap.
const preloadedFiles = new Set();

function preloadFile(file) {
  if (!file || preloadedFiles.has(file)) return;
  preloadedFiles.add(file);
  const img = new Image();
  img.src = imagePath(file);
}

function spreadFiles(spread) {
  const files = [];
  for (const page of [spread?.left, spread?.right]) {
    if (page && (page.type === "image" || page.type === "cover") && page.file) {
      files.push(page.file);
    }
  }
  return files;
}

function preloadAdjacent() {
  [currentIndex - 1, currentIndex + 1, currentIndex + 2].forEach((index) => {
    if (index >= 0 && index < spreads.length) {
      spreadFiles(spreads[index]).forEach(preloadFile);
    }
  });
}

function syncBookState() {
  const isClosedCover = currentIndex === 0 && !isAnimating;
  book.classList.toggle("is-closed-cover", isClosedCover);

  if (!isAnimating) {
    book.classList.remove("is-opening-cover");
  }
}

function prepareTurn(direction, currentSpread, targetSpread) {
  isAnimating = true;
  updateControls();

  flipSheet.className = "flip-sheet";
  book.classList.remove("is-turning-next", "is-turning-prev", "is-opening-cover", "is-closed-cover");

  const openingFromCover = direction === 1 && currentIndex === 0;

  if (!openingFromCover) {
    renderPageFace(leftPage, currentSpread.left, "left");
    renderPageFace(rightPage, currentSpread.right, "right");
  }

  if (direction === 1) {
    book.classList.add("is-turning-next");
    flipSheet.classList.add("is-next");

    if (openingFromCover) {
      book.classList.add("is-opening-cover");
      flipSheet.classList.add("is-opening-cover");
      renderPageFace(leftPage, targetSpread.left, "left");
      renderPageFace(rightPage, targetSpread.right, "right");
      renderPageFace(sheetFront, currentSpread.right, "right");
      renderPageFace(sheetBack, targetSpread.left, "left");
    } else {
      renderPageFace(rightPage, targetSpread.right, "right");
      renderPageFace(sheetFront, currentSpread.right, "right");
      renderPageFace(sheetBack, targetSpread.left, "left");
    }
  } else {
    book.classList.add("is-turning-prev");
    flipSheet.classList.add("is-prev");
    renderPageFace(leftPage, targetSpread.left, "left");
    renderPageFace(sheetFront, currentSpread.left, "left");
    renderPageFace(sheetBack, targetSpread.right, "right");
  }

  flipSheet.classList.remove("hidden");
}

function playTurn(direction, targetIndex) {
  const animationClass = direction === 1 ? "animate-next" : "animate-prev";

  requestAnimationFrame(() => {
    flipSheet.classList.add(animationClass);
  });

  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    clearTimeout(safety);
    currentIndex = targetIndex;
    isAnimating = false;
    book.classList.remove("is-turning-next", "is-turning-prev", "is-opening-cover");
    flipSheet.className = "flip-sheet hidden";
    sheetFront.innerHTML = "";
    sheetBack.innerHTML = "";
    renderSpread(spreads[currentIndex]);
    updateControls();
    preloadAdjacent();
  };

  flipSheet.addEventListener("animationend", finish, { once: true });
  // Fallback so the book never stays frozen if animationend is missed
  // (e.g. the tab was backgrounded mid-turn and the animation was paused).
  const safety = setTimeout(finish, TURN_DURATION_MS + 250);
}

function renderPageFace(target, descriptor, side) {
  const pageDescriptor = descriptor ?? blankPage();
  target.dataset.side = side;
  target.dataset.kind = pageDescriptor.type;
  target.dataset.bleed = pageDescriptor.type === "image" && Boolean(pageDescriptor.bleedHalf) ? "true" : "false";
  // Remember the full photo so a half-bleed page can still zoom the whole image.
  if (pageDescriptor.type === "image") {
    target.dataset.file = pageDescriptor.file;
  } else {
    delete target.dataset.file;
  }
  target.innerHTML = "";

  const content = document.createElement("div");
  content.className = `page-content page-content-${pageDescriptor.type}`;

  if (pageDescriptor.type === "image" && pageDescriptor.bleedHalf) {
    content.classList.add("is-bleed");
  }

  if (pageDescriptor.type === "image") {
    const imagePadding = resolveImagePadding(pageDescriptor.margin, pageDescriptor.bleedHalf);

    if (imagePadding) {
      content.style.padding = imagePadding;
    }
  }

  switch (pageDescriptor.type) {
    case "image":
      content.appendChild(createImageFigure(pageDescriptor));
      if (pageDescriptor.overlay) {
        content.appendChild(createImageOverlayBlock(pageDescriptor.overlay));
      }
      break;
    case "title":
    case "endpaper":
    case "frontmatter":
      content.appendChild(createCopyBlock(pageDescriptor));
      break;
    case "insidecover":
      content.appendChild(createInsideCoverBlock());
      break;
    case "cover":
      content.appendChild(createCoverBlock(pageDescriptor));
      break;
    default:
      if (pageDescriptor.label) {
        const label = document.createElement("p");
        label.className = "page-note";
        label.textContent = pageDescriptor.label;
        content.appendChild(label);
      }
  }

  target.appendChild(content);
}

function createInsideCoverBlock() {
  const board = document.createElement("div");
  board.className = "inside-cover-board";
  return board;
}

function createImageFigure(descriptor) {
  const figure = document.createElement("figure");
  figure.className = "page-media";

  if (descriptor.bleedHalf) {
    figure.classList.add("is-bleed", `bleed-${descriptor.bleedHalf}`);
  }

  const img = document.createElement("img");
  img.src = imagePath(descriptor.file);
  img.alt = "Street photograph from Love Letter to Glasgow";
  img.loading = "eager";
  figure.appendChild(img);

  // Quiet zoom affordance for pointer devices (touch users tap the photo itself).
  const zoomBtn = document.createElement("button");
  zoomBtn.type = "button";
  zoomBtn.className = "zoom-btn";
  zoomBtn.setAttribute("aria-label", "Enlarge photograph");
  zoomBtn.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/><path d="M10.5 7.5v6M7.5 10.5h6"/></svg>';
  zoomBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    openZoom(descriptor.file);
  });
  figure.appendChild(zoomBtn);

  return figure;
}

function createCopyBlock(descriptor) {
  const wrapper = document.createElement("div");
  wrapper.className = "page-copy";

  if (descriptor.eyebrow) {
    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = descriptor.eyebrow;
    wrapper.appendChild(eyebrow);
  }

  if (descriptor.title) {
    const title = document.createElement("h2");
    title.textContent = descriptor.title;
    wrapper.appendChild(title);
  }

  if (descriptor.text) {
    const text = document.createElement("p");
    text.textContent = descriptor.text;
    wrapper.appendChild(text);
  }

  return wrapper;
}

function createImageOverlayBlock(descriptor) {
  const wrapper = createCopyBlock(descriptor);
  wrapper.classList.add("page-copy-overlay");
  return wrapper;
}

function toCssLength(value, fallback = null) {
  if (value == null) return fallback;

  if (typeof value === "number") {
    return `${value}px`;
  }

  if (typeof value === "string") {
    return MARGIN_PRESETS[value] ?? value;
  }

  return fallback;
}

function resolveImagePadding(margin, bleedHalf) {
  if (margin == null) return null;

  if (typeof margin !== "object" || Array.isArray(margin)) {
    const size = toCssLength(margin, null);

    if (!size) return null;

    if (bleedHalf === "left") {
      return `${size} 0 ${size} ${size}`;
    }

    if (bleedHalf === "right") {
      return `${size} ${size} ${size} 0`;
    }

    return size;
  }

  const all = toCssLength(margin.all ?? null, null);
  const x = toCssLength(margin.x ?? all, all);
  const y = toCssLength(margin.y ?? all, all);
  const outer = toCssLength(margin.outer ?? x ?? all, x ?? all);
  const inner = toCssLength(margin.inner ?? (bleedHalf ? 0 : x ?? all), bleedHalf ? "0px" : (x ?? all ?? "0px"));
  const top = toCssLength(margin.top ?? y ?? all, y ?? outer ?? "0px");
  const bottom = toCssLength(margin.bottom ?? y ?? all, y ?? outer ?? "0px");

  if (bleedHalf === "left") {
    const left = toCssLength(margin.left ?? outer, outer ?? "0px");
    const right = toCssLength(margin.right ?? inner, inner ?? "0px");
    return `${top} ${right} ${bottom} ${left}`;
  }

  if (bleedHalf === "right") {
    const left = toCssLength(margin.left ?? inner, inner ?? "0px");
    const right = toCssLength(margin.right ?? outer, outer ?? "0px");
    return `${top} ${right} ${bottom} ${left}`;
  }

  const left = toCssLength(margin.left ?? x ?? all, x ?? all ?? "0px");
  const right = toCssLength(margin.right ?? x ?? all, x ?? all ?? "0px");
  return `${top} ${right} ${bottom} ${left}`;
}

function createCoverBlock(descriptor) {
  const wrapper = document.createElement("div");
  wrapper.className = "cover-frame";

  const image = document.createElement("img");
  image.src = imagePath(descriptor.file);
  image.alt = "Cover image for Love Letter to Glasgow";
  wrapper.appendChild(image);

  const grid = document.createElement("div");
  grid.className = "cover-grid";
  wrapper.appendChild(grid);

  const imageFrame = document.createElement("div");
  imageFrame.className = "cover-image-frame";
  wrapper.appendChild(imageFrame);

  const tape = document.createElement("div");
  tape.className = "cover-tape";
  tape.innerHTML = `
    <span class="cover-tape-title">${descriptor.title}</span>
    <span class="cover-tape-note">${descriptor.note}</span>
  `;
  wrapper.appendChild(tape);

  const spineNote = document.createElement("div");
  spineNote.className = "cover-spine-note";
  spineNote.textContent = "For Fern";
  wrapper.appendChild(spineNote);

  const hinge = document.createElement("div");
  hinge.className = "cover-hinge-shadow";
  wrapper.appendChild(hinge);

  const vignette = document.createElement("div");
  vignette.className = "cover-vignette";
  wrapper.appendChild(vignette);

  return wrapper;
}

function jumpToCover() {
  if (isAnimating || spreads.length === 0 || currentIndex === 0) return;

  currentIndex = 0;
  renderSpread(spreads[currentIndex]);
  updateControls();
  preloadAdjacent();
}

// --- Photo zoom ---------------------------------------------------------
// A tapped photo (touch) or the per-photo zoom button (pointer) opens the full
// image full-screen so detail survives the smaller side-by-side mobile spread.
let zoomOverlay = null;
let zoomImg = null;

function ensureZoomOverlay() {
  if (zoomOverlay) return;

  zoomOverlay = document.createElement("div");
  zoomOverlay.className = "zoom-overlay";
  zoomOverlay.setAttribute("role", "dialog");
  zoomOverlay.setAttribute("aria-modal", "true");
  zoomOverlay.setAttribute("aria-label", "Enlarged photograph");
  zoomOverlay.hidden = true;

  zoomImg = document.createElement("img");
  zoomImg.alt = "Enlarged street photograph from Love Letter to Glasgow";
  zoomOverlay.appendChild(zoomImg);

  const close = document.createElement("button");
  close.type = "button";
  close.className = "zoom-close";
  close.setAttribute("aria-label", "Close enlarged photograph");
  close.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6 18 18M18 6 6 18"/></svg>';
  close.addEventListener("click", closeZoom);
  zoomOverlay.appendChild(close);

  zoomOverlay.addEventListener("click", (event) => {
    if (event.target === zoomOverlay) closeZoom();
  });

  document.body.appendChild(zoomOverlay);
}

function openZoom(source) {
  const file = typeof source === "string" ? source : source?.dataset?.file;
  if (!file) return;

  ensureZoomOverlay();
  zoomImg.src = imagePath(file);
  zoomOverlay.hidden = false;
  document.body.classList.add("zoom-locked");
  requestAnimationFrame(() => zoomOverlay.classList.add("is-open"));
}

function closeZoom() {
  if (!isZoomOpen()) return;

  zoomOverlay.classList.remove("is-open");
  document.body.classList.remove("zoom-locked");

  const finish = () => {
    zoomOverlay.hidden = true;
    zoomImg.removeAttribute("src");
  };

  if (prefersReducedMotion.matches) {
    finish();
  } else {
    zoomOverlay.addEventListener("transitionend", finish, { once: true });
  }
}

function isZoomOpen() {
  return Boolean(zoomOverlay) && !zoomOverlay.hidden;
}

function loadImages() {
  updateControls();

  fetch("images.json", { cache: "no-store" })
    .then((response) => response.json())
    .then((images) => buildSpreads(images))
    .catch((error) => {
      console.error("Unable to load images.json:", error);
      setSpreads([
        {
          left: endpaperPage(),
          right: {
            type: "title",
            eyebrow: "Load error",
            title: "Unable to build the book.",
            text: "The page shell is ready, but the image list could not be loaded from images.json.",
          },
        },
      ]);
    });
}

updateControls();
