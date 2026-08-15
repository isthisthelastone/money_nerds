"use client";

import {useGLTF} from "@react-three/drei";
import {Canvas, useFrame} from "@react-three/fiber";
import {Suspense, useMemo, useRef} from "react";
import type {Group} from "three";

interface HeroCoinCanvasProps {
    reduceMotion: boolean;
}

function CoinModel({reduceMotion}: HeroCoinCanvasProps) {
    const groupRef = useRef<Group>(null);
    const {scene} = useGLTF("/tripo.glb");
    const model = useMemo(() => scene.clone(true), [scene]);

    useFrame((state, delta) => {
        if (!groupRef.current || reduceMotion) return;

        groupRef.current.rotation.y += delta * 0.18;
        groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.35) * 0.06;
    });

    return (
        <group ref={groupRef} rotation={[0.08, Math.PI * 0.92, -0.08]}>
            <primitive object={model} scale={4.25} />
        </group>
    );
}

export function HeroCoinCanvas({reduceMotion}: HeroCoinCanvasProps) {
    return (
        <Canvas
            camera={{position: [0, 0, 5.2], fov: 42}}
            dpr={[1, 1.5]}
            frameloop={reduceMotion ? "demand" : "always"}
            gl={{alpha: true, antialias: true, powerPreference: "high-performance"}}
            performance={{min: 0.6}}
        >
            <ambientLight intensity={1.7} />
            <directionalLight color="#f2eee4" intensity={3.1} position={[3, 4, 5]} />
            <pointLight color="#c7ff42" intensity={24} position={[-3, -1, 3]} />
            <Suspense fallback={null}>
                <CoinModel reduceMotion={reduceMotion} />
            </Suspense>
        </Canvas>
    );
}
