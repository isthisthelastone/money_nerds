"use client";

import dynamic from "next/dynamic";
import {CircleDollarSign, Radio} from "lucide-react";
import {useEffect, useRef, useState} from "react";

const HeroCoinCanvas = dynamic(
    () => import("./HeroCoinCanvas").then((module) => module.HeroCoinCanvas),
    {ssr: false},
);

export function HeroCoin() {
    const containerRef = useRef<HTMLElement>(null);
    const [canRender, setCanRender] = useState(false);
    const [reduceMotion, setReduceMotion] = useState(true);

    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
        const syncMotionPreference = () => setReduceMotion(mediaQuery.matches);
        syncMotionPreference();
        mediaQuery.addEventListener("change", syncMotionPreference);

        const canvas = document.createElement("canvas");
        const supportsWebGl = Boolean(
            canvas.getContext("webgl2") ?? canvas.getContext("webgl"),
        );

        const target = containerRef.current;
        if (!target || !supportsWebGl) {
            return () => mediaQuery.removeEventListener("change", syncMotionPreference);
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setCanRender(true);
                    observer.disconnect();
                }
            },
            {rootMargin: "180px"},
        );

        observer.observe(target);

        return () => {
            observer.disconnect();
            mediaQuery.removeEventListener("change", syncMotionPreference);
        };
    }, []);

    return (
        <figure
            className="hero-coin"
            ref={containerRef}
            aria-label="A decorative 3D coin representing direct wallet-to-wallet funding"
        >
            <div className="hero-coin__fallback" aria-hidden="true">
                <div className="hero-coin__fallback-disc">
                    <CircleDollarSign size={62} strokeWidth={1.35} />
                </div>
            </div>
            {canRender ? (
                <div className="hero-coin__canvas" aria-hidden="true">
                    <HeroCoinCanvas reduceMotion={reduceMotion} />
                </div>
            ) : null}
            <span className="hero-coin__label hero-coin__label--top">
                <Radio aria-hidden="true" size={12} /> Direct settlement
            </span>
            <span className="hero-coin__label hero-coin__label--bottom">
                <CircleDollarSign aria-hidden="true" size={12} /> No platform cut
            </span>
            <figcaption className="sr-only">
                A decorative coin. Money Nerds donations settle directly between Solana
                wallets.
            </figcaption>
        </figure>
    );
}
