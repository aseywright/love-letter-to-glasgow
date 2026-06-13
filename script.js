const heroScreen = document.getElementById("heroScreen");
const openBookBtn = document.getElementById("openBookBtn");
const bookShell = document.getElementById("bookShell");
const book = document.getElementById("book");
const leftPage = document.getElementById("leftPage");
const rightPage = document.getElementById("rightPage");
const flipSheet = document.getElementById("flipSheet");
const sheetFront = document.getElementById("sheetFront");
const sheetBack = document.getElementById("sheetBack");
const sheetShadeFront = document.getElementById("sheetShadeFront");
const sheetShadeBack = document.getElementById("sheetShadeBack");
const coverBtn = document.getElementById("coverBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const bookProgress = document.getElementById("bookProgress");
const progressFill = document.getElementById("progressFill");
const closedBook = document.querySelector(".closed-book");
const spreadCaption = document.getElementById("spreadCaption");

// One quiet narrative line per on-screen spread, in reading order. Index maps
// 1:1 to the spread sequence: 0 = cover, 1 = inside cover, then each spread of
// the book. Edit freely; set a line to "" to leave that spread pure image.
const NARRATIVE = [
  "I came back in winter, when the city keeps its collar up.",
  "Glasgow doesn't open to strangers — you have to walk it first.",
  "By day it dresses well and walks in step, sure of itself, giving nothing away.",
  "Now and then it forgets to perform — a kid bolts through the spray and the whole place softens.",
  "Mostly it just moves — glass and small change and faces you'll never place.",
  "Dark by four, and still I kept walking, past lit windows and the long way down the hill.",
  "Then a gap opens — a look, a gesture — and the street lets you in.",
  "After that it picks up — everything in motion, and me moving with it.",
  "Now I'm seeing it through glass and rain, soft at the edges, half-dreamed.",
  "Faces surface in the windows, wearing the city like a coat, gone before I look twice.",
  "Then the colour comes up — red coats, red brake lights, a pub door breathing out.",
  "On the bridges, time slips — could be now, could be a hundred winters back.",
  "The ones who've been here longest just stand and smoke, watching it like an old lover.",
  "It keeps its small secrets — a girl in a clearing, bent over something she won't show you.",
  "Mornings, the light comes in low and forgiving, and you see how it's built.",
  "All curves and cuts, light snaking through the bones of the place.",
  "And shadow that pulls at people, takes them in like it's owed them.",
  "By night it turns electric — neon bleeding across glass, dressed-up and a little dangerous.",
  "Everyone's breathing smoke now — vapour, exhaust, the cold making ghosts of us all.",
  "Some of them clock me and don't flinch. This is theirs, and they let me know it.",
  "Between the statues, the living carry on — smaller, realer, harder to cast in bronze.",
  "Minus fourteen and still out — kids up the monuments, old women wrapped against the lot of it.",
  "There's always a man with a pint who's seen it all and forgiven most of it.",
  "The door I came in by, lit now — same city, but it's looking back at me this time.",
  "People start pointing things out — to me, or to no one — and I look up every time.",
  "Glass and a Victorian stroll on one side, two hard men and a scruffy dog on the other. It holds them both.",
  "And someone always shouting the truth at a street that's already heard it.",
  "Everyone threading through it — down the light, through the gaps, never quite still.",
  "Under the bridge at Central, we all wait for the same green light.",
  "Daft hair, a hole in the wall, a queue for something hot — it feeds itself and laughs while it does.",
  "Old names still glowing, art deco and bingo lights, glamour that never quite left.",
  "And the tired ones, heads in hands, grinding it out so the season lands for someone.",
  "Red on red — a fist of balloons, an old woman posting a letter the colour of her coat.",
  "Slow down and it goes painterly — colour on colour, the ordinary worth framing.",
  "It catches fire sometimes, and the whole street stops to watch it burn.",
  "Up close the hard faces go soft — a light, a look, a man made of three exposures.",
  "It hoards strange things — a deer's head, a broken mannequin, a man reading yesterday's news among them.",
  "The Barras in soft greens and reds, light coming through like it's blessing the lot.",
  "Joy and the lack of it in the same window — the way it always is here.",
  "And the jokes it makes on its own — a caveman in a suit, a hand reaching for the sun.",
  "After dark the signs start whispering — open, late, come in — and most nights I do.",
  "Cut clean down the middle by light, and never more at home.",
  "By now I know the faces — the ones looking up, the ones dusted in flour, taking five.",
  "Even the cheap glass turns to colour — orange hair, blue dress, light leaking out of ordinary rooms.",
  "The whole world keeps a shop here — coconuts and garlic and a nod from a stranger who saw me coming.",
  "Two strangers, both worth stopping for — a city full of people I'll love for exactly one frame.",
  "And then it ends like a film — two people mid-stride, the marquee turning over. A love letter, to a city that only opens to the ones who stay out late.",
];

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
let turnTween = null;

function isTouch() {
  return coarsePointer.matches;
}

function openBook() {
  heroScreen.classList.add("hidden");
  bookShell.classList.remove("hidden");

  if (!hasLoaded) {
    loadImages();
  }

  markActive();
}

openBookBtn.addEventListener("click", openBook);

if (closedBook) {
  closedBook.style.cursor = "pointer";
  closedBook.addEventListener("click", openBook);
}

// Quiet the navigation chrome while reading; bring it back on any input.
const IDLE_MS = 3400;
let idleTimer = null;

function scheduleIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!bookShell.classList.contains("hidden")) {
      bookShell.classList.add("is-immersive");
    }
  }, IDLE_MS);
}

function markActive() {
  if (bookShell.classList.contains("hidden")) return;
  bookShell.classList.remove("is-immersive");
  scheduleIdle();
}

["pointermove", "pointerdown", "keydown", "touchstart", "wheel"].forEach((eventName) => {
  window.addEventListener(eventName, markActive, { passive: true });
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

  if (progressFill) {
    const ratio = spreads.length > 1 ? currentIndex / (spreads.length - 1) : 0;
    progressFill.style.width = `${ratio * 100}%`;
  }
}

function imagePath(file) {
  return `Images/${file.split("/").map(encodeURIComponent).join("/")}`;
}

// Display-sized WebP companion (see scripts/make-webp.py); the JPEG stays as the
// <img> fallback and the full-detail zoom source.
function webpPath(file) {
  return imagePath(file.replace(/\.(jpe?g)$/i, ".webp"));
}

// Per-photo alt text: factual one-line descriptions, keyed by image filename.
// Editable — add or refine any line here. Anything missing falls back to a
// generic line.
const ALT = {
  "Cover.jpg": "A man's silhouette in a doorway at night beneath an illuminated 四海樓 Licensed Restaurant sign, a lit staircase behind him.",
  "IMG_E9363.JPG": "A man in a fedora and striped scarf talks on a phone on the pavement, a rolled carpet leaning beside him.",
  "24B06320-A44F-4265-92A2-F1A8B89FCF0C-9337-0000022AB6BD89F8.jpg":
    "Two men in coats walk past the bronze Duke of Wellington statue on horseback, mirrored in a wet puddle on a city square.",
  "IMG_3196.jpg":
    "A taxi driver sits in his cab at night, hand to his face, beside a shop window glowing with a neon 'Sale' sign and Christmas lights.",
  "IMG_3211.jpg": "Blurred figures and shop signage reflected in dark blue night glass.",
  "IMG_7306 (2).jpg": "A double-exposed black-and-white image of fern fronds layered over a faint figure.",
  "Zine2021-05-03 at 1.03.40 pm 88.jpg": "A woman in a long dress stands alone on a grass clearing ringed by dark trees.",
  "Zine2021-05-03 at 1.04.09 pm 74.jpg":
    "A bearded man in glasses sits behind a rain-streaked cafe window, umbrellas and a tenement reflected in the glass.",
  "Zine2021-05-03 at 1.04.21 pm 33.jpg": "An abstract close-up of a face seen through rippled, multicoloured mottled glass.",
  "Zine2021-05-03 at 1.04.27 pm 84.jpg":
    "From behind, a person in a fluffy white coat and beret walks a dusk street past a 'Don't Settle' vending pillar.",
  "Zine2021-05-03 at 4.00.54 pm 20.jpg": "A lone cyclist rides through a long curved tubular covered walkway, city buildings beyond.",
  "Zine2021-05-03 at 4.00.58 pm 29.jpg":
    "From behind, a woman in a long coat walks down a sloping street lined with scaffolding and tenements.",
  "Zine2021-05-03 at 4.01.01 pm 45.jpg": "Abstract view of curving concrete balcony tiers inside an atrium.",
  "Zine2021-05-03 at 4.01.03 pm 12.jpg":
    "A night street with neon tattoo-parlour and convenience-store signs, an orange car parked and a red bus blurring past.",
  "Zine2021-05-03 at 4.01.06 pm 25.jpg": "A silhouetted cyclist rides past the lit Queen Street station entrance at night, a pedestrian nearby.",
  "Zine2021-05-03 at 4.01.08 pm 87.jpg": "A wet city street at night, a figure crossing toward distant headlights below a lit office building.",
  "Zine2021-05-03 at 4.01.21 pm 86.jpg": "A man's face framed in the hatch of a 'Falafel to Go' takeaway, shelves of cans and bags inside.",
  "Zine2021-05-03 at 4.01.25 pm 65.jpg": "From behind, a man in a grey coat faces Central Station and a lit Tim Hortons at night.",
  "Zine2021-05-03 at 4.01.30 pm 110.jpg": "A bespectacled man in a dark coat exhales a large cloud of vapour against a graffitied doorway.",
  "Zine2021-05-03 at 4.10.40 pm 56.jpg": "An older man and a woman pull scarves over their faces against the cold on a grey street.",
  "Zine2021-05-03 at 4.10.53 pm 30.jpg": "A man sits alone at a table behind a cafe window, tenements reflected in the glass.",
  "Zine2021-05-03 at 4.11.05 pm 29.jpg": "A man with a satchel walks past shuttered shopfronts in a shaft of light, graffiti on the wall.",
  "Zine2021-05-03 at 4.11.14 pm 37.jpg": "A small silhouetted figure crosses a sunlit corner between tall stone buildings casting long shadows.",
  "Zine2021-05-03 at 4.11.15 pm 108.jpg": "An older man in a puffer jacket walks past a concrete wall cut by a sharp diagonal shaft of light.",
  "Zine2021-05-03 at 4.11.15 pm 43.jpg": "A busy daytime pavement by columned buildings; two stylish young women pass, one in sunglasses.",
  "Zine2021-05-03 at 4.11.29 pm 5.jpg": "A man in a pale hat and suit, face in shadow, passes the 四海樓 Licensed Restaurant doorway by day.",
  "Zine2021-05-03 at 4.11.34 pm 22.jpg": "An elderly woman in a headscarf and dark coat walks toward the camera through a city crossing, Pizza Hut behind.",
  "Zine2021-05-03 at 4.11.37 pm 100.jpg": "Two silhouetted men, one pointing, before a bright hoarding with a demolition excavator behind.",
  "Zine2021-05-03 at 4.11.37 pm 50.jpg": "A driver's hand rests out the window of a white lorry cab with large wing mirrors, scaffolding behind.",
  "Zine2021-05-03 at 4.11.53 pm 94.jpg": "Through a cafe window, a man and a blond woman sit talking; handwritten 'Joy / Ride' notes on the frame.",
  "Zine2021-05-03 at 4.18.27 pm 88.jpg": "From behind, a person jogs along a lush fern-lined garden path.",
  "Zine2021-05-03 at 4.18.28 pm 109.jpg": "An African grocery stall with bundles of sugar cane and brooms, a man behind the counter.",
  "Zine2021-05-03 at 4.18.30 pm 4.jpg": "Inside the Athol Arms pub, an older man sits with a pint in window light, other drinkers nearby.",
  "Zine2021-05-03 at 4.18.33 pm 48.jpg": "Two hi-vis workers, one pointing up, on a street toward the City Chambers domes at dusk.",
  "Zine2021-05-03 at 4.18.37 pm 26.jpg": "Overhead, a cyclist rides a path beside a zig-zag staircase and river in dappled light.",
  "Zine2021-05-03 at 4.18.52 pm 73.jpg": "A sunlit colonnade throws strong rectangular shadows across paving, a distant figure beyond.",
  "Zine2021-05-03 at 4.18.53 pm 100.jpg": "A street preacher holds an 'Evolution is a Hoax' sign before a crowd of young people outside a station.",
  "Zine2021-05-03 at 4.18.53 pm 54.jpg": "A girl in profile silhouette rides an escalator against the shadow of a large arched window.",
  "Zine2021-05-03 at 4.18.54 pm 54.jpg": "A young tattooed woman in sunglasses sits amid a standing crowd, a heavily tattooed arm in the foreground.",
  "Zine2021-05-03 at 4.18.56 pm 44_01.jpg": "A man holds a bunch of large clear confetti-filled balloons on a street at dusk.",
  "Zine2021-05-03 at 4.23.18 pm 9.jpg": "Two people under a clear umbrella on a rainy lit street by the Rogano sign and a lobster mural.",
  "Zine2021-05-03 at 4.25.23 pm 80.jpg": "A white-haired man reads a newspaper in a cluttered bric-a-brac shop with a deer's head and old Esso sign.",
  "Zine2021-05-03 at 4.25.31 pm 10.jpg": "A bearded man in a tweed coat walks in profile along a granite wall in sharp diagonal light.",
  "Zine2021-05-03 at 4.25.31 pm 94_01.jpg": "A suited man emerges from billowing street steam in a lane, his long shadow on a metal grate.",
  "Zine2021-05-03 at 4.25.32 pm 109.jpg": "A man with wild hair and glasses pushed up talks on a phone outside a 'USA Beauty' barbers, strongly backlit.",
  "Zine2021-05-03 at 4.49.52 pm 63.jpg": "From behind, a man in a black beret and grey coat on a sunlit street, another man beside him.",
  "Zine2021-05-03 at 4.49.52 pm 90.jpg": "A grey-haired man in a tan coat passes a dark graffitied wall pasted with three portrait photos.",
  "Zine2021-05-03 at 4.49.57 pm 35.jpg": "Three firefighters in turnout gear on a street, one pointing, by a KFC frontage.",
  "Zine2021-05-03 at 4.50.02 pm 104_01.jpg": "An abstract figure with orange hair in a blue top seen through textured frosted glass.",
  "Zine2021-05-03 at 4.50.06 pm 27.jpg": "A briefcase-carrying man passes a stencil mural of a suited caveman holding a spear.",
  "DSHD1327.JPG": "A hazy, light-leaked street scene: a grey-haired man in a suit among shoppers past a Nike store and a pink 'Make Glasgow' banner.",
  "IMG_0869 (2).JPG": "A top-down night view of a person walking past Bank of Scotland and St Vincent Street signage, casting a long shadow.",
  "IMG_E3709.JPG": "From behind, a suited man on a phone at a sunlit street corner by a 'Coffee' sign, a black car passing.",
  "IMG_E8133.JPG": "A smiling baker in a hairnet and flour-dusted apron, seen in profile.",
  "IMG_E9063.JPG": "A bearded man in a suit reflected in a shop window, tenements mirrored in the glass.",
  "RNZVE0015.JPG": "A red neon 'Open' sign glowing at the top of a dim, red-lit stairwell.",
  "inside cover.JPG": "A blurred night reflection in shop glass of the photographer raising a camera, shoppers around him.",
  "img003.jpg": "The Glasgow Film Theatre frontage with its lit marquee, a couple passing and a figure heading in.",
  "img005.jpg": "A balloon seller almost hidden behind a huge bunch of colourful character balloons in a sunlit square.",
  "img009.jpg": "An older woman in a red coat posts a letter at a red pillar box, a patchwork bag on her arm.",
  "img030-2.jpg": "A soft out-of-focus street scene framed by a red shopfront edge and a patterned curtain.",
  "img040-2.jpg": "A male mannequin torso with a keyhole in its shoulder sits in a shop window among cardboard boxes.",
  "img070-2.jpg": "A blond woman with a handbag stands among the tall stone columns of a grand portico.",
  "img076-2.jpg": "A pale-haired woman in a long red coat walks toward the camera on a wet street at dusk.",
  "img077.jpg": "An older couple walk arm in arm beneath a lit 'Arcade & Bingo' neon marquee at dusk.",
  "img082_01.jpg": "Two women on a wet night pavement beneath a red subway sign, brake lights and tower blocks beyond.",
  "img083.jpg": "Two people walk onto a foggy stone suspension bridge with a tall triumphal-arch pylon.",
  "img085.jpg": "The Duke of Wellington statue from behind, a traffic cone on its head and someone climbing it, a bus passing.",
  "img127-2.jpg": "A misty river, weir and old mill framed between two blurred stone balusters.",
  "img139-2-2.jpg": "A double-breasted coat on a headless mannequin in a shop window, a domed building reflected.",
  "img235.jpg": "A lone figure walks away down a dim Victorian shopping arcade lit by hanging lamps.",
  "img244.jpg": "A heavy-set man in a coat sharp in the foreground at night, a crowd and street lights blurred behind.",
  "img248.jpg": "From behind, a person in a checked coat under an umbrella on a rainy night street, lights blurred.",
  "img259.jpg": "An older man stands in profile in a square before a robed statue and tenements.",
  "img315.jpg": "An old man stands dwarfed among the massive stone columns of a grand portico.",
  "img366.jpg": "The shadow of a figure cast on a striped construction tarpaulin, a 'Barras' sign behind.",
  "img410.jpg": "A person's shadow falls across a shopfront, forming a cross shape in the daylight.",
  "img521.jpg": "Inside a glasshouse: tall palms under a curved glass roof, a small figure on a path below.",
  "img524.jpg": "Two men stand close to a stone wall with a small scruffy white dog beside them.",
  "img537.jpg": "A person bundled against the cold sits on a park bench in the snow, a pigeon nearby.",
  "img716.jpg": "A person reflected in shop glass layered with arcade reflections, another figure in a red scarf beyond.",
  "img726.jpg": "People walk through a sun-flared stone archway into the Merchant City, reduced to silhouettes.",
  "img840.jpg": "A close-up of bright neon signage with stars and lettering in red, yellow and blue.",
  "img846_01.jpg": "A woman in a pale coat walks a dark night lane lit by neon signs.",
};

function altFor(file) {
  return ALT[file] || "Street photograph from Love Letter to Glasgow, Glasgow 2017–2019";
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
      left: imagePage(INSIDE_COVER_FILE, { bleedHalf: "left" }),
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
  renderCaption(currentIndex);
}

/* --- Narrative caption: a hand-written line (Shadows Into Light) that writes
   itself in beneath the book after each page turn — off the photographs, in the
   dark negative space. Each visual line is uncovered by a soft left-to-right
   mask at handwriting pace. A monotonic token guards every async step so only
   the current page's line is ever live, even across rapid or backwards turns. */
const captionPara = spreadCaption.querySelector("p");
const CAPTION_SETTLE_MS = 260; // brief pause after the page settles before writing

let captionToken = 0;
let captionTimeline = null;
let captionStartTimer = null;
let captionResizeTimer = null;
let currentCaptionLine = "";

function clearCaptionAnims() {
  clearTimeout(captionStartTimer);
  captionStartTimer = null;
  if (captionTimeline) {
    captionTimeline.kill();
    captionTimeline = null;
  }
  if (window.gsap) gsap.killTweensOf([spreadCaption, captionPara]);
}

function renderCaption(index) {
  const line = NARRATIVE[index] || "";
  const token = ++captionToken;
  clearCaptionAnims();
  currentCaptionLine = line;

  if (!line) {
    spreadCaption.hidden = true;
    captionPara.textContent = "";
    return;
  }

  spreadCaption.hidden = false;
  captionPara.textContent = "";

  if (!window.gsap) {
    drawCaption(line, token);
    return;
  }

  // Stay invisible through the settle pause, then write.
  gsap.set(spreadCaption, { opacity: 0 });
  captionStartTimer = setTimeout(() => {
    if (token !== captionToken) return;
    drawCaption(line, token);
  }, CAPTION_SETTLE_MS);
}

function drawCaption(line) {
  if (prefersReducedMotion.matches || !window.gsap) {
    showCaptionStatic(line);
  } else {
    drawCaptionMask(line);
  }
}

function hideCaption() {
  clearCaptionAnims();
  if (window.gsap) {
    gsap.to(spreadCaption, { opacity: 0, duration: 0.28, overwrite: true });
  } else {
    spreadCaption.style.opacity = "0";
  }
}

// Reduced-motion / no-GSAP: just fade the whole line in, no drawing.
function showCaptionStatic(line) {
  captionPara.textContent = line;
  if (window.gsap) {
    gsap.fromTo(spreadCaption, { opacity: 0 }, { opacity: 1, duration: 0.6, overwrite: true });
  } else {
    spreadCaption.style.opacity = "1";
  }
}

// Soft per-line left-to-right reveal of the handwriting.
function drawCaptionMask(line) {
  gsap.set(spreadCaption, { opacity: 1 });

  // Lay the line out as words to discover where it naturally wraps.
  captionPara.textContent = "";
  const words = line.split(" ");
  const wordSpans = words.map((word, i) => {
    const span = document.createElement("span");
    span.className = "cap-word";
    span.textContent = word;
    captionPara.appendChild(span);
    if (i < words.length - 1) captionPara.appendChild(document.createTextNode(" "));
    return span;
  });

  // Group words into visual lines, then re-wrap each line so its mask sweeps
  // across just that line's text.
  const groups = [];
  let lastTop = null;
  wordSpans.forEach((span) => {
    const top = span.offsetTop;
    if (top !== lastTop) {
      groups.push([]);
      lastTop = top;
    }
    groups[groups.length - 1].push(span);
  });

  captionPara.textContent = "";
  const lineDivs = groups.map((group, gi) => {
    const div = document.createElement("div");
    div.className = "cap-line";
    group.forEach((span, i) => {
      div.appendChild(span);
      if (i < group.length - 1) div.appendChild(document.createTextNode(" "));
    });
    captionPara.appendChild(div);
    // A space between line blocks keeps the text correct for copy / screen
    // readers (it does not affect the visual line break).
    if (gi < groups.length - 1) captionPara.appendChild(document.createTextNode(" "));
    return div;
  });

  // Reveal each visual line in turn, left to right, at handwriting pace.
  gsap.set(lineDivs, { "--reveal": 0, opacity: 0.45 });
  const tl = gsap.timeline();
  lineDivs.forEach((div, i) => {
    const chars = div.textContent.length;
    const duration = Math.min(2.4, Math.max(0.45, chars * 0.03));
    tl.to(div, { opacity: 1, duration: duration * 0.5, ease: "none" }, i === 0 ? 0 : ">-0.1");
    tl.to(div, { "--reveal": 1, duration, ease: "none" }, "<");
  });
  captionTimeline = tl;
}

// Reflow the current line on resize / orientation change (debounced), without
// the settle pause — just redraw it for the new width.
function handleCaptionResize() {
  clearTimeout(captionResizeTimer);
  captionResizeTimer = setTimeout(() => {
    if (spreadCaption.hidden || !currentCaptionLine) return;
    ++captionToken;
    clearCaptionAnims();
    drawCaption(currentCaptionLine);
  }, 220);
}

window.addEventListener("resize", handleCaptionResize);
window.addEventListener("orientationchange", handleCaptionResize);

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
  hideCaption();

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
  let settled = false;
  let safety;

  const finish = () => {
    if (settled) return;
    settled = true;
    clearTimeout(safety);

    if (turnTween) {
      turnTween.kill();
      turnTween = null;
    }

    currentIndex = targetIndex;
    isAnimating = false;
    book.classList.remove("is-turning-next", "is-turning-prev", "is-opening-cover");
    flipSheet.className = "flip-sheet hidden";

    if (window.gsap) {
      gsap.set(flipSheet, { clearProps: "transform" });
      gsap.set([sheetShadeFront, sheetShadeBack], { opacity: 0 });
    }

    sheetFront.innerHTML = "";
    sheetBack.innerHTML = "";
    renderSpread(spreads[currentIndex]);
    updateControls();
    preloadAdjacent();
  };

  if (window.gsap) {
    const endRotation = direction === 1 ? -180 : 180;

    gsap.set(flipSheet, {
      rotationY: 0,
      transformOrigin: direction === 1 ? "0% 50%" : "100% 50%",
    });
    gsap.set([sheetShadeFront, sheetShadeBack], { opacity: 0 });

    // Weighted turn: eased lift and settle. The fold shadow swells as the page
    // nears edge-on, then hands off to the back face's shadow as it falls.
    const tl = gsap.timeline({ onComplete: finish });
    tl.to(flipSheet, { rotationY: endRotation, duration: 1.05, ease: "power2.inOut" }, 0);
    tl.to(sheetShadeFront, { opacity: 0.55, duration: 0.52, ease: "power1.in" }, 0);
    tl.set(sheetShadeBack, { opacity: 0.55 }, 0.52);
    tl.to(sheetShadeBack, { opacity: 0, duration: 0.53, ease: "power1.out" }, 0.52);
    turnTween = tl;

    safety = setTimeout(finish, 1500);
  } else {
    const animationClass = direction === 1 ? "animate-next" : "animate-prev";
    requestAnimationFrame(() => {
      flipSheet.classList.add(animationClass);
    });
    flipSheet.addEventListener("animationend", finish, { once: true });
    // Fallback so the book never stays frozen if animationend is missed
    // (e.g. the tab was backgrounded mid-turn and the animation was paused).
    safety = setTimeout(finish, TURN_DURATION_MS + 250);
  }
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

  const picture = document.createElement("picture");
  const source = document.createElement("source");
  source.type = "image/webp";
  source.srcset = webpPath(descriptor.file);
  picture.appendChild(source);

  const img = document.createElement("img");
  img.src = imagePath(descriptor.file);
  img.alt = altFor(descriptor.file);
  img.loading = "eager";
  img.decoding = "async";
  picture.appendChild(img);
  figure.appendChild(picture);

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
  const coverPicture = document.createElement("picture");
  const coverSource = document.createElement("source");
  coverSource.type = "image/webp";
  coverSource.srcset = webpPath(descriptor.file);
  coverPicture.appendChild(coverSource);

  image.src = imagePath(descriptor.file);
  image.alt = altFor(descriptor.file);
  image.decoding = "async";
  coverPicture.appendChild(image);
  wrapper.appendChild(coverPicture);

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
let zoomClose = null;
let zoomReturnFocus = null;

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
  zoomImg.decoding = "async";
  zoomOverlay.appendChild(zoomImg);

  zoomClose = document.createElement("button");
  zoomClose.type = "button";
  zoomClose.className = "zoom-close";
  zoomClose.setAttribute("aria-label", "Close enlarged photograph");
  zoomClose.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6 18 18M18 6 6 18"/></svg>';
  zoomClose.addEventListener("click", closeZoom);
  zoomOverlay.appendChild(zoomClose);

  zoomOverlay.addEventListener("click", (event) => {
    if (event.target === zoomOverlay) closeZoom();
  });

  // Trap Tab within the dialog (the close button is the only stop).
  zoomOverlay.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      zoomClose.focus();
    }
  });

  document.body.appendChild(zoomOverlay);
}

function openZoom(source) {
  const file = typeof source === "string" ? source : source?.dataset?.file;
  if (!file) return;

  ensureZoomOverlay();
  zoomReturnFocus = document.activeElement;
  zoomImg.src = imagePath(file);
  zoomImg.alt = altFor(file);
  zoomOverlay.hidden = false;
  document.body.classList.add("zoom-locked");
  requestAnimationFrame(() => {
    zoomOverlay.classList.add("is-open");
    zoomClose.focus(); // move focus into the dialog
  });
}

function closeZoom() {
  if (!isZoomOpen()) return;

  zoomOverlay.classList.remove("is-open");
  document.body.classList.remove("zoom-locked");

  // Return focus to whatever opened the zoom.
  if (zoomReturnFocus && typeof zoomReturnFocus.focus === "function") {
    zoomReturnFocus.focus();
  }
  zoomReturnFocus = null;

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

function animateLanding() {
  if (!window.gsap || prefersReducedMotion.matches) return;
  if (heroScreen.classList.contains("hidden")) return;

  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
  tl.from(".hero-copy .eyebrow", { y: 14, opacity: 0, duration: 0.7 }, 0.15)
    .from(".hero-copy h1", { y: 22, opacity: 0, duration: 0.85 }, 0.25)
    .from(".hero-copy .subtitle", { y: 14, opacity: 0, duration: 0.7 }, 0.45)
    .from(".hero-actions", { y: 12, opacity: 0, duration: 0.6 }, 0.6)
    .from(".hero-preview", { opacity: 0, scale: 0.96, duration: 1.05, ease: "power2.out" }, 0.3);

  // Safety: never leave the landing faded if the entrance is interrupted.
  setTimeout(() => tl.progress(1), 2800);
}

// Drifting night-glows + the occasional passing headlight, behind the book.
function initAmbient() {
  const layer = document.getElementById("ambient");
  if (!layer || !window.gsap || prefersReducedMotion.matches) return; // static glows otherwise

  const rand = gsap.utils.random;

  layer.querySelectorAll(".orb").forEach((orb) => {
    gsap.to(orb, {
      x: () => rand(-140, 140),
      y: () => rand(-90, 90),
      scale: () => rand(0.82, 1.28),
      duration: () => rand(18, 34),
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
      delay: rand(0, 8),
    });
  });

  const sweep = (streak) => {
    // Roughly one pass in three is a red tail-light; tail-lights always travel
    // the same direction (a car receding), headlights either way.
    const isTail = Math.random() < 0.33;
    streak.classList.toggle("is-tail", isTail);
    const fromLeft = isTail ? true : Math.random() > 0.5;
    const w = window.innerWidth;
    gsap.set(streak, {
      top: rand(12, 88) + "vh",
      x: fromLeft ? -w * 0.4 : w * 1.4,
      scaleX: fromLeft ? 1 : -1,
      opacity: 0,
    });
    const tl = gsap.timeline({
      onComplete: () => gsap.delayedCall(rand(5, 12), () => sweep(streak)),
    });
    const peak = isTail ? rand(0.16, 0.3) : rand(0.22, 0.42);
    const duration = rand(2.6, 4.4);
    tl.to(streak, { x: fromLeft ? w * 1.4 : -w * 0.4, duration, ease: "power1.inOut" }, 0)
      .to(streak, { opacity: peak, duration: duration * 0.35, ease: "power1.in" }, 0)
      .to(streak, { opacity: 0, duration: duration * 0.4, ease: "power1.out" }, duration * 0.6);
  };

  layer.querySelectorAll(".headlight").forEach((streak, i) => {
    gsap.delayedCall(2 + i * 4 + rand(0, 3), () => sweep(streak));
  });
}

updateControls();
animateLanding();
initAmbient();
