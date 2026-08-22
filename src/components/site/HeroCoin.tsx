"use client";

import type { KeyboardEvent, PointerEvent } from "react";
import { useRef, useState } from "react";
import { CircleDollarSign, Move3d, Radio } from "lucide-react";

const INITIAL_ROTATION = { x: 8, y: -18 };

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function HeroCoin() {
  const [rotation, setRotation] = useState(INITIAL_ROTATION);
  const [dragging, setDragging] = useState(false);
  const rotationRef = useRef(INITIAL_ROTATION);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    rotationX: number;
    rotationY: number;
    moved: boolean;
  } | null>(null);

  const updateRotation = (next: { x: number; y: number }) => {
    rotationRef.current = next;
    setRotation(next);
  };

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      rotationX: rotationRef.current.x,
      rotationY: rotationRef.current.y,
      moved: false,
    };
    setDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 5) drag.moved = true;
    updateRotation({
      x: clamp(drag.rotationX - deltaY * 0.35, -42, 42),
      y: drag.rotationY + deltaX * 0.48,
    });
  };

  const finishPointerInteraction = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (!drag.moved) {
      updateRotation({ x: rotationRef.current.x, y: rotationRef.current.y + 36 });
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setDragging(false);
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
      className="hero-coin"
      data-dragging={dragging || undefined}
      aria-label="Interactive 3D coin representing direct wallet-to-wallet funding"
      aria-describedby="hero-coin-instructions"
      tabIndex={0}
      onDoubleClick={() => updateRotation(INITIAL_ROTATION)}
      onKeyDown={handleKeyDown}
      onPointerCancel={finishPointerInteraction}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointerInteraction}
    >
      <div className="hero-coin__scene" aria-hidden="true">
        <div
          className="hero-coin__model"
          style={{ transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) rotateZ(-4deg)` }}
        >
          <div className="hero-coin__face">
            <span className="hero-coin__inner-ring">
              <span className="hero-coin__monogram">
                <i className="hero-coin__bar hero-coin__bar--left" />
                <i className="hero-coin__bar hero-coin__bar--slash" />
                <i className="hero-coin__bar hero-coin__bar--right" />
              </span>
            </span>
          </div>
        </div>
      </div>
      <span className="hero-coin__label hero-coin__label--top">
        <Radio aria-hidden="true" size={12} /> Direct settlement
      </span>
      <span className="hero-coin__label hero-coin__label--bottom">
        <CircleDollarSign aria-hidden="true" size={12} /> No platform cut
      </span>
      <figcaption className="hero-coin__hint" id="hero-coin-instructions">
        <Move3d aria-hidden="true" size={13} /> Drag or swipe to rotate · tap to turn
      </figcaption>
    </figure>
  );
}
