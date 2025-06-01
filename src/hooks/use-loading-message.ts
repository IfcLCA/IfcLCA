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
];

function buildRandomMessage() {
  const i = Math.floor(Math.random() * introParts.length);
  const a = Math.floor(Math.random() * activityParts.length);
  const e = Math.floor(Math.random() * endingParts.length);
  return `${introParts[i]} ${activityParts[a]}${endingParts[e]}`;
}

export function useLoadingMessage(active: boolean, interval = 3000) {
  const [message, setMessage] = useState(baseMessages[0]);
  const used = useRef(new Set<string>());
  const index = useRef(0);

  useEffect(() => {
    if (!active) {
      used.current.clear();
      index.current = 0;
      return;
    }

    function nextMessage() {
      let msg = "";
      if (index.current < baseMessages.length) {
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
    }

    const id = setInterval(nextMessage, interval);
    // show first message immediately
    nextMessage();

    return () => clearInterval(id);
  }, [active, interval]);

  return message;
}
