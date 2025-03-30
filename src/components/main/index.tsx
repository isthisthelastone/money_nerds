"use client";
/* eslint-disable */

import {Suspense, useRef, useState} from "react";
import {Canvas, useFrame} from "@react-three/fiber";
import {OrbitControls, useGLTF} from "@react-three/drei";
import moment from "moment";
import {QueryClientProvider} from "@tanstack/react-query";
import {PhantomWalletButton, queryClient} from "@/shared/web3/wallet-auth";
import {DonateButton} from "@/components/main/DonateButton";
import {LikeButton} from "@/components/main/LikeButton";
import {ServiceDonateButton} from "@/components/main/service-support";
import {copyToClipboard} from "@/shared/utils";
import {CommentSection} from "./CommentSection";
import {Form} from "@/components";

// =======================
// MAIN PAGE COMPONENT
// =======================
export function Component({data}: { data: any[] }) {
    return (
        // Provide the QueryClient at the top level, so posts/comments can use it
        <QueryClientProvider client={queryClient}>
            <div className="w-full h-screen overflow-auto">
                <main className="flex flex-col gap-4 min-h-screen w-full px-4 md:px-20 py-5 overflow-y-auto">
                    <div className="flex justify-end">
                        <PhantomWalletButton/>
                    </div>

                    <h1 className="text-5xl md:text-[8vw] text-center text-white">MONEY NERDS</h1>

                    <div className="flex flex-col lg:flex-row items-center justify-center gap-10">
                        <CoinFlipper/>
                        <div
                            className="flex flex-col font-mono p-4 gap-4 bg-gray-50 border border-gray-300 rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600 w-full max-w-md">
                            <p className="text-3xl text-center font-thin">Donate</p>
                            <img
                                className="mx-auto"
                                src="/pepe-pepe-logo.svg"
                                width={120}
                                height={160}
                                alt="Icon"
                            />
                            <p className="text-center text-sm">
                                We don't take any commissions from user donations. Fully transparent, see our wallet
                                transactions below.
                            </p>
                            <ServiceDonateButton/>
                            <a
                                href="https://solscan.io/account/BqzLRNsHraeahvfppDs9QmRDdYx3gUYt69pgA6UR9GQg"
                                className="text-center text-sm break-words hover:underline"
                            >
                                https://solscan.io/account/BqzLRNsHraeahvfppDs9QmRDdYx3gUYt69pgA6UR9GQg
                            </a>
                        </div>
                    </div>

                    {/* Existing form for creating new posts */}
                    <Form/>

                    {/* Post list */}
                    <ul className="flex flex-col gap-4 pb-10">
                        {data.map((item: {
                            donated: Record<string, number>;
                            id: number;
                            walletAddress: string;
                            likes: number;
                            createdAt: string;
                            username: string;
                            message: string;
                        }) => (
                            <PostCard key={item.id} item={item}/>
                        ))}
                    </ul>
                </main>
            </div>
        </QueryClientProvider>
    );
}

// =======================
// POST CARD COMPONENT
// =======================
function PostCard({
                      item
                  }: {
    item: {
        donated: Record<string, number>;
        id: number;
        walletAddress: string;
        likes: number;
        createdAt: string;
        username: string;
        message: string;
    };
}) {
    // Calculate total donations
    const totalDonations = Object.values(item.donated).length
        ? Object.values(item.donated).reduce((acc: number, val: number) => acc + val, 0)
        : 0;

    return (
        <li className="font-mono p-4 bg-gray-50 border border-gray-300 rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600">
            <div className="flex flex-col gap-2">
                <div className="flex gap-1">
                    <p>{`#${item.id} by`}</p>
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
                <div className="flex flex-col md:flex-row md:justify-between gap-2 text-sm">
                    <p>{moment(item.createdAt).format("MM/DD/YYYY HH:mm:ss")}</p>
                    <p>Likes: {item.likes}</p>
                    <p>Donations: {totalDonations} SOL</p>
                </div>
                <div className="flex flex-col md:flex-row md:justify-between gap-2">
                    <DonateButton postId={item.id} recipientAddress={item.walletAddress}/>
                    <LikeButton postId={item.id} initialLikes={item.likes}/>
                </div>
            </div>

            {/* Embedded comment section under each post */}
            <CommentSection postId={item.id}/>
        </li>
    );
}

// =======================
// COIN FLIPPER / 3D MODEL
// =======================
function CoinFlipper() {
    const [rotationY, setRotationY] = useState(Math.PI);
    const [isFlipping, setIsFlipping] = useState(false);
    const [result, setResult] = useState<"" | "Heads" | "Tails">("");

    const flipCoin = () => {
        if (isFlipping) return;
        setIsFlipping(true);

        const isHeads = Math.random() > 0.5;
        const finalResult = isHeads ? "Tails" : "Heads";
        const finalOffset = isHeads ? 0 : Math.PI;

        const flips = 3;
        const endRotation =
            rotationY + flips * 2 * Math.PI + (finalOffset - (rotationY % (2 * Math.PI)));

        const flipDuration = 1.5;
        const startRotation = rotationY;
        const startTime = performance.now();

        const animateFlip = (time: number) => {
            const elapsed = (time - startTime) / 1000;
            const progress = Math.min(elapsed / flipDuration, 1);
            // Example ease-out
            const easedProgress = 1 - Math.pow(1 - progress, 4);
            const currentRotation =
                startRotation + (endRotation - startRotation) * easedProgress;

            setRotationY(currentRotation);

            if (progress < 1) {
                requestAnimationFrame(animateFlip);
            } else {
                setRotationY(endRotation);
                setIsFlipping(false);
                setResult(finalResult);
            }
        };

        requestAnimationFrame(animateFlip);
    };

    return (
        <div className="flex flex-col items-center w-full max-w-lg">
            <button
                className="p-2 my-4 rounded-lg w-full md:w-1/2 bg-blue-500 hover:bg-blue-600 text-white font-mono"
                disabled={isFlipping}
                onClick={flipCoin}
            >
                {isFlipping ? "Flipping..." : "Flip Coin"}
            </button>
            {result && (
                <p className="text-lg font-bold text-white bg-gradient-to-b from-blue-900 to-indigo-900 rounded-xl shadow-lg px-4 py-2">
                    {result}
                </p>
            )}
            <Canvas
                camera={{position: [0, 0, 5]}}
                style={{width: "100%", height: 350}}
                onWheel={(e) => e.stopPropagation()}
            >
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

function CoinModel({rotationY}: { rotationY: number }) {
    const {scene} = useGLTF("/tripo.glb");
    const coinRef = useRef<any>(null);

    useFrame(() => {
        if (coinRef.current) {
            coinRef.current.rotation.y = rotationY;
        }
    });

    return (
        <primitive ref={coinRef} object={scene} scale={4.5} rotation={[0, Math.PI, 0]}/>
    );
}