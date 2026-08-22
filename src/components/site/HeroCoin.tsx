"use client";

import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CircleDollarSign, Move3d, Radio } from "lucide-react";

const INITIAL_ROTATION = { x: 8, y: -18 };
const EDGE_LAYER_COUNT = 21;
const COIN_EDGE_LAYERS = Array.from({ length: EDGE_LAYER_COUNT }, (_, index) => {
  const depth = -0.9 + (index * 1.8) / (EDGE_LAYER_COUNT - 1);
  return (
    <i
      className={`hero-coin__edge${index % 4 === 0 ? " hero-coin__edge--ridge" : ""}`}
      key={index}
      style={{ "--coin-edge-depth": `${depth.toFixed(2)}rem` } as CSSProperties}
    />
  );
});

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function CoinFace({ side }: { side: "front" | "back" }) {
  return (
    <div className={`hero-coin__face hero-coin__face--${side}`}>
      <span className="hero-coin__inner-ring">
        <span className="hero-coin__monogram">
          <i className="hero-coin__bar hero-coin__bar--left" />
          <i className="hero-coin__bar hero-coin__bar--slash" />
          <i className="hero-coin__bar hero-coin__bar--right" />
        </span>
      </span>
    </div>
  );
}

export function HeroCoin() {
  const [rotation, setRotation] = useState(INITIAL_ROTATION);
  const [dragging, setDragging] = useState(false);
  const coinRef = useRef<HTMLElement>(null);
  const rotationRef = useRef(INITIAL_ROTATION);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    rotationX: number;
    rotationY: number;
    moved: boolean;
  } | null>(null);

  const updateRotation = useCallback((next: { x: number; y: number }) => {
    rotationRef.current = next;
    setRotation(next);
  }, []);

  const finishPointerInteraction = useCallback(
    (pointerId: number | null, turnOnTap = false) => {
      const drag = dragRef.current;
      if (!drag || (pointerId !== null && drag.pointerId !== pointerId)) return;

      dragRef.current = null;
      setDragging(false);

      if (turnOnTap && !drag.moved) {
        updateRotation({ x: rotationRef.current.x, y: rotationRef.current.y + 36 });
      }

      const coin = coinRef.current;
      if (coin?.hasPointerCapture(drag.pointerId)) {
        try {
          coin.releasePointerCapture(drag.pointerId);
        } catch {
          // The browser may already have released capture while dispatching cancellation.
        }
      }
    },
    [updateRotation],
  );

  useEffect(() => {
    const coin = coinRef.current;
    const handleWindowPointerUp = (event: globalThis.PointerEvent) => {
      finishPointerInteraction(event.pointerId, true);
    };
    const handleWindowPointerCancel = (event: globalThis.PointerEvent) => {
      finishPointerInteraction(event.pointerId);
    };
    const handleWindowBlur = () => {
      finishPointerInteraction(null);
    };

    window.addEventListener("pointerup", handleWindowPointerUp, true);
    window.addEventListener("pointercancel", handleWindowPointerCancel, true);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("pointerup", handleWindowPointerUp, true);
      window.removeEventListener("pointercancel", handleWindowPointerCancel, true);
      window.removeEventListener("blur", handleWindowBlur);

      const drag = dragRef.current;
      dragRef.current = null;
      if (drag && coin?.hasPointerCapture(drag.pointerId)) {
        try {
          coin.releasePointerCapture(drag.pointerId);
        } catch {
          // Capture can disappear during unmount without a matching pointer event.
        }
      }
    };
  }, [finishPointerInteraction]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (!event.isPrimary || dragRef.current) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.pointerType !== "mouse" && event.cancelable) event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      rotationX: rotationRef.current.x,
      rotationY: rotationRef.current.y,
      moved: false,
    };
    setDragging(true);

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Window listeners still guarantee cleanup if capture is unavailable.
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.cancelable) event.preventDefault();

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 5) drag.moved = true;
    updateRotation({
      x: clamp(drag.rotationX - deltaY * 0.35, -42, 42),
      y: drag.rotationY + deltaX * 0.48,
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const step = event.shiftKey ? 30 : 10;
    if (event.key === "Home") {
      event.preventDefault();
      updateRotation(INITIAL_ROTATION);
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    updateRotation({
      x: clamp(
        rotationRef.current.x + (event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0),
        -42,
        42,
      ),
      y:
        rotationRef.current.y +
        (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0),
    });
  };

  return (
    <figure
      ref={coinRef}
      className="hero-coin"
      data-dragging={dragging || undefined}
      aria-label="Interactive 3D coin representing direct wallet-to-wallet funding"
      aria-describedby="hero-coin-instructions"
      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Home"
      tabIndex={0}
      onDoubleClick={() => updateRotation(INITIAL_ROTATION)}
      onKeyDown={handleKeyDown}
      onLostPointerCapture={(event) => finishPointerInteraction(event.pointerId)}
      onPointerCancel={(event) => finishPointerInteraction(event.pointerId)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finishPointerInteraction(event.pointerId, true)}
    >
      <div className="hero-coin__scene" aria-hidden="true">
        <div
          className="hero-coin__model"
          style={{ transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) rotateZ(-4deg)` }}
        >
          {COIN_EDGE_LAYERS}
          <CoinFace side="front" />
          <CoinFace side="back" />
        </div>
      </div>
      <span className="hero-coin__label hero-coin__label--top">
        <Radio aria-hidden="true" size={12} /> Direct settlement
      </span>
      <span className="hero-coin__label hero-coin__label--bottom">
        <CircleDollarSign aria-hidden="true" size={12} /> No platform cut
      </span>
      <figcaption className="hero-coin__hint" id="hero-coin-instructions">
        <Move3d aria-hidden="true" size={13} />
        <span aria-hidden="true">Drag or swipe to rotate · tap to turn</span>
        <span className="sr-only">
          Drag or swipe to rotate the coin, or tap to turn it. Use the arrow keys to rotate it and press Home to
          reset it.
        </span>
      </figcaption>
    </figure>
  );
}
