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

export interface LoadingMessageOptions {
  /** Time in ms for each message after the first. */
  interval?: number;
  /** Time in ms the first message should stay visible. */
  firstInterval?: number;
  /** Maximum number of random messages before pausing rotation. */
  maxRandom?: number;
}

export function useLoadingMessage(
  active: boolean,
  {
    interval = 3000,
    firstInterval = 1000,
    maxRandom = 5,
  }: LoadingMessageOptions = {}
) {
  const [message, setMessage] = useState(baseMessages[0]);
  const used = useRef(new Set<string>());
  const index = useRef(0); // base message index
  const randomCount = useRef(0);
  const timer = useRef<NodeJS.Timeout>();
  const start = useRef<number>(0);
  const lastMsg = useRef(baseMessages[0]);

  useEffect(() => {
    if (!active) {
      if (timer.current) clearTimeout(timer.current);
      used.current.clear();
      index.current = 0;
      randomCount.current = 0;
      start.current = 0;
      setMessage(baseMessages[0]);
      lastMsg.current = baseMessages[0];
      return;
    }

    start.current = Date.now();

    function schedule(delay: number) {
      timer.current = setTimeout(() => {
        let msg = lastMsg.current;
        const elapsed = Date.now() - start.current;

        if (index.current < baseMessages.length) {
          msg = baseMessages[index.current];
          index.current += 1;
        } else if (
          randomCount.current < maxRandom ||
          elapsed > (baseMessages.length + maxRandom) * interval
        ) {
          let attempts = 0;
          do {
            msg = buildRandomMessage();
            attempts += 1;
          } while (used.current.has(msg) && attempts < 50);
          used.current.add(msg);
          randomCount.current += 1;
        }

        lastMsg.current = msg;
        setMessage(msg);
        schedule(interval);
      }, delay);
    }

    schedule(firstInterval);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [active, interval, firstInterval, maxRandom]);

  return message;
}
