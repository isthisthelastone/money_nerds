/* eslint-disable */
'use client'
import {Form} from "@/components";
import {PhantomWalletButton} from "@/shared/web3/wallet-auth";
import {DonateButton} from "@/components/main/DonateButton";
import {LikeButton} from "@/components/main/LikeButton";
import {copyToClipboard} from "@/shared/utils";
import moment from "moment";
import {Canvas, useFrame} from "@react-three/fiber";
import {OrbitControls, useGLTF} from "@react-three/drei";
import {Suspense, useRef, useState} from "react";

/**
 * Your main component: wallet button, flipping coin, form, and data list.
 */
export function Component({data}: { data: any[] }) {
    return (
        <main className="flex flex-col items-center justify-start gap-1 min-h-screen w-full px-4">
            {/* Wallet Button */}
            <div className="flex self-end place-self-end justify-self-end pr-[5vw] pt-[5vh]">
                <PhantomWalletButton/>
            </div>

            <div className="flex flex-col gap-16">
                {/* Title */}
                <h1 className="text-[12vw] pt-10 text-center text-white">MONEY NERDS</h1>

                {/* 3D Coin Flip Section */}
                <CoinFlipper/>

                {/* Form */}
                <Form/>

                {/* List of Data */}
                <ul className="space-y-[4vh] gap-4 pb-10">
                    {data.map((item) => (
                        <li
                            key={item.id}
                            className="font-mono p-4 min-w-[39vw] bg-gray-50 border border-gray-300
                         text-gray-900 focus:ring-0 focus:outline-none text-sm rounded-lg
                         focus:ring-blue-500 focus:border-blue-500 block w-full
                         dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400
                         dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                        >
                            <div className="flex flex-col gap-4">
                                <div className="flex gap-1">
                                    <p>{"#" + item.id + " by "}</p>
                                    <div
                                        className="cursor-pointer flex hover:underline"
                                        onClick={() => copyToClipboard(item.walletAddress)}
                                    >
                                        <p className="truncate max-w-20">{item.walletAddress}</p>
                                        <p>{item.walletAddress.slice(-5, -1)}</p>
                                    </div>
                                </div>
                                <p>
                                    under nickname <b>{item.username}</b>
                                </p>
                                <p>{item.message}</p>
                                <div className="flex justify-between">
                                    <p>{moment(item.createdAt).format("MM/DD/YYYY HH:mm:ss")}</p>
                                    <p>Likes: {item.likes}</p>
                                    <p>Donations: {item.donated_sum}</p>
                                </div>
                                <div className="flex justify-between">
                                    <DonateButton recipientAddress={item.walletAddress}/>
                                    <LikeButton postId={item.id} initialLikes={item.likes}/>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </main>
    );
}

/**
 * CoinModel is rendered INSIDE the <Canvas>.
 * All R3F hooks (useFrame, useGLTF) must be here.
 */
function CoinModel({rotationY}: { rotationY: number }) {
    const {scene} = useGLTF("/tripo.glb");
    const coinRef = useRef<unknown>(null!);

    // Per-frame rotation update
    useFrame(() => {
        if (coinRef.current) {
            //@ts-expect-error valid type
            coinRef.current.rotation.y = rotationY;
        }
    });

    return (
        <primitive
            ref={coinRef}
            object={scene}
            scale={3}
            rotation={[0, Math.PI, 0]} // Adjust if needed so 0 = Heads, π = Tails
        />
    );
}

/**
 * CoinFlipper: flipping logic/state (isFlipping, result, rotationY).
 * Renders the <Canvas> with <CoinModel>.
 */
function CoinFlipper() {
    const [rotationY, setRotationY] = useState(Math.PI);
    const [isFlipping, setIsFlipping] = useState(false);
    const [result, setResult] = useState<"" | "Heads" | "Tails">("");

    const flipCoin = () => {
        if (isFlipping) return;
        setIsFlipping(true);

        // Decide heads or tails
        const isHeads = Math.random() > 0.5;
        const finalResult = isHeads ? "Tails" : "Heads";

        // Confirm which angles display heads/tails for your model
        const headsAngle = 0;         // model shows heads at 0
        const tailsAngle = Math.PI;   // model shows tails at π

        // # of full flips (3 => 3 spins or 3 * 360deg)
        const flips = 3;
        const fullSpins = flips * 2 * Math.PI; // 3 spins => 6π
        const finalOffset = isHeads ? headsAngle : tailsAngle;

        // If you're currently at, e.g., rotationY=1.2 rad, you'll add the full spins
        // plus the difference to line up exactly at headsAngle or tailsAngle.
        const endRotation =
            rotationY +
            fullSpins +
            (finalOffset - (rotationY % (2 * Math.PI)));

        // Animate for 1.5 seconds
        const flipDuration = 1.5;
        const startRotation = rotationY;
        const startTime = performance.now();

        const animateFlip = (time: number) => {
            const elapsed = (time - startTime) / 1000;
            const progress = Math.min(elapsed / flipDuration, 1);

            // "ease-out" function
            const easedProgress = 1 - Math.pow(1 - progress, 4);
            const currentRotation =
                startRotation + (endRotation - startRotation) * easedProgress;

            setRotationY(currentRotation);

            if (progress < 1) {
                requestAnimationFrame(animateFlip);
            } else {
                // Snap to final angle to avoid float rounding
                setRotationY(endRotation);
                setIsFlipping(false);
                setResult(finalResult);
            }
        };

        requestAnimationFrame(animateFlip);
    };

    return (
        <div className="w-full h-[500px]">
            {/* Flip button and result */}
            <div className="flex flex-col gap-5 w-full justify-center items-center font-mono">
                <button
                    onClick={flipCoin}
                    disabled={isFlipping}
                    className="p-1 mt-4 rounded-lg w-[50vw] items-center gap-2
                     bg-blue-500 hover:bg-blue-600 text-center justify-center
                     text-white"
                >
                    {isFlipping ? "Flipping..." : "Flip Coin"}
                </button>

                {result && !isFlipping && (
                    <p
                        className="font-mono mt-2 text-lg flex flex-col items-center justify-center
                       bg-gradient-to-b from-blue-900 to-indigo-900 rounded-xl shadow-lg
                       w-full max-w-[50vw] mx-auto text-white"
                    >
                        {result}
                    </p>
                )}
            </div>

            {/* The 3D canvas */}
            <Canvas camera={{position: [0, 0, 5]}}>
                <ambientLight intensity={0.7}/>
                <directionalLight position={[2, 2, 2]}/>
                <Suspense fallback={null}>
                    <CoinModel rotationY={rotationY}/>
                </Suspense>
                <OrbitControls enableZoom={false}/>
            </Canvas>
        </div>
    );
}
