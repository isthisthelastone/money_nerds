// FallingBanknotes.tsx
import React, {Suspense, useEffect, useRef, useState} from 'react';
import {Canvas, useFrame} from '@react-three/fiber';
import {useGLTF} from '@react-three/drei';
import * as THREE from 'three';

interface BanknoteProps {
    stopScrollY: number;
}

function Banknote({stopScrollY}: BanknoteProps) {
    const {scene} = useGLTF('/banknote.glb') as unknown as { scene: THREE.Group };
    const ref = useRef<THREE.Group>(null);
    const [scrollY, setScrollY] = useState(0);

    useEffect(() => {
        const handleScroll = () => {
            setScrollY(window.scrollY);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useFrame(() => {
        if (!ref.current) return;

        // Smoothly interpolate position to avoid jitter
        const progress = Math.min(scrollY / stopScrollY, 1);
        const targetY = 5 - 10 * progress; // Moves from y = 5 down to -5 smoothly
        ref.current.position.y = THREE.MathUtils.lerp(ref.current.position.y, targetY, 0.1); // Smooth transition

        // Smooth rotation
        ref.current.rotation.z = THREE.MathUtils.lerp(ref.current.rotation.z, progress * Math.PI * 0.2, 0.1);
    });

    return (
        <primitive
            ref={ref}
            object={scene}
            position={[0, 5, 0]} // Centered
            scale={[1.2, 1.2, 1.2]} // Adjusted size for visibility
        />
    );
}

export function FallingBanknotes() {
    const stopScrollY = 300;

    return (
        <div className="flex w-full h-[30vh] overflow-visible">
            <Canvas
                className="flex  pointer-events-none" // Made it 2x smaller
                camera={{position: [0, 0, 10]}}
            >
                <ambientLight intensity={0.8}/>
                <directionalLight position={[2, 5, 2]}/>
                <Suspense fallback={null}>
                    <Banknote stopScrollY={stopScrollY}/>
                </Suspense>
            </Canvas>
        </div>
    );
}