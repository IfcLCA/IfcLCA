import { useEffect, useRef, useState } from "react";

const baseMessages = [
  "Creating upload record...",
  "Uploading file bytes...",
  "Parsing IFC with WebAssembly magic...",
  "Extracting geometry and materials...",
  "Checking materials against library...",
  "Finalizing dataset...",
];

const introParts = [
  "Still working on it",
  "Dusting off BIM cobwebs",
  "Crunching some numbers",
  "Digging into your model",
  "Squeezing every byte",
  "Aligning building axes",
  "Hunting missing textures",
  "Coaxing out surfaces",
  "Polishing digital bricks",
  "Counting door knobs",
  "Aggregating wall volumes",
  "Reviewing structural magic",
  "Prodding the parser",
  "Gathering material wisdom",
  "Sweeping up stray polygons",
  "Reinforcing digital beams",
  "Calibrating lasers virtually",
  "Compiling BIM folklore",
  "Untangling section cuts",
  "Inspecting secret passages",
];

const activityParts = [
  "for the final touch",
  "to cross-check materials",
  "with a pinch of patience",
  "to untangle geometry",
  "while we brew more coffee",
  "to optimize polygons",
  "while humming quietly",
  "to map unknown materials",
  "so your team doesn't have to",
  "before sending results",
  "to keep the BIM spirits happy",
  "for maximum accuracy",
  "while double-checking units",
  "to polish those surfaces",
  "to tame rogue meshes",
  "while the servers stretch",
  "for BIM enlightenment",
  "while code gremlins nap",
  "with an extra sprinkle of pixels",
  "while avoiding coffee spills",
];

const endingParts = [
  "...",
  " hang tight!",
  ", almost done!",
  ", just a sec...",
  ". We promise it's worth it!",
  ". The suspense builds!",
  ", nearly there!",
  ", just warming up...",
  ", thanks for waiting!",
  ", keep calm and BIM on!",
  ", uploading vibes engaged!",
  ", prepping data goodness!",
  ", verifying units now...",
  ", making friends with geometry...",
  ", readying final report...",
  ", plotting world domination...",
  ", aligning the stars...",
  ", rewriting BIM history...",
  ", decoding mystical layers...",
  ", sending good vibes your way...",
];

function buildRandomMessage() {
  const i = Math.floor(Math.random() * introParts.length);
  const a = Math.floor(Math.random() * activityParts.length);
  const e = Math.floor(Math.random() * endingParts.length);
  return `${introParts[i]} ${activityParts[a]}${endingParts[e]}`;
}

export function useLoadingMessage(
  active: boolean,
  baseDelay = 3000,
  randomDelay = 1500,
) {
  const [message, setMessage] = useState(baseMessages[0]);
  const used = useRef(new Set<string>());
  const index = useRef(0);
  const showBaseNext = useRef(true);
  const timer = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!active) {
      used.current.clear();
      index.current = 0;
      showBaseNext.current = true;
      if (timer.current) {
        clearTimeout(timer.current);
      }
      return;
    }

    function schedule() {
      const delay =
        showBaseNext.current && index.current < baseMessages.length
          ? baseDelay
          : randomDelay;
      timer.current = setTimeout(() => {
        let msg = "";
        if (showBaseNext.current && index.current < baseMessages.length) {
          msg = baseMessages[index.current];
          index.current += 1;
        } else {
          let attempts = 0;
          do {
            msg = buildRandomMessage();
            attempts += 1;
          } while (used.current.has(msg) && attempts < 50);
          used.current.add(msg);
        }
        setMessage(msg);
        // toggle to show creative message after each base message
        if (index.current >= baseMessages.length) {
          showBaseNext.current = false;
        } else {
          showBaseNext.current = !showBaseNext.current;
        }
        schedule();
      }, delay);
    }

    // Immediately display first base message
    setMessage(baseMessages[0]);
    index.current = 1;
    showBaseNext.current = false;
    schedule();

    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [active, baseDelay, randomDelay]);

  return message;
}
