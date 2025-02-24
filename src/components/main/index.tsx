/* eslint-disable */
'use client'
import {Form} from "@/components";
import {PhantomWalletButton} from "@/shared/web3/wallet-auth";
import {DonateButton} from "@/components/main/DonateButton";
import {LikeButton} from "@/components/main/LikeButton";
import {copyToClipboard} from "@/shared/utils";
import moment from "moment";
import {Canvas} from "@react-three/fiber";
import {OrbitControls, useGLTF} from "@react-three/drei";
import {Suspense} from "react";
import {FallingBanknotes} from "@/components/banknotes";

function Model() {
    const {scene} = useGLTF("/tripo.glb"); // Make sure it's inside `public/` folder

    return <primitive object={scene} scale={4} rotation={[0, Math.PI, 0]}/>; // Scale bigger & flip horizontally
}

export function Component({data}: { data: any[] }) {
    return (
        <main className="flex flex-col items-center justify-start gap-16 min-h-screen w-full px-4">
            {/* Wallet Button */}
            <div className="flex self-end place-self-end justify-self-end pr-[5vw] pt-[5vh]">
                <PhantomWalletButton/>
            </div>
            <FallingBanknotes/>

            <div className="w-full h-[500px]">
                <Canvas camera={{position: [0, 0, 5]}}> {/* Camera closer */}
                    <ambientLight intensity={0.7}/>
                    <directionalLight position={[2, 2, 2]}/>
                    <Suspense fallback={null}>
                        <Model/>
                    </Suspense>
                    <OrbitControls enableZoom={false}/> {/* Prevent scroll zoom */}
                </Canvas>
            </div>


            {/* Title */}
            <h1 className="text-[12vw] text-white ">MONEY NERDS</h1>

            {/* 3D Model Section */}

            {/* Form */}
            <Form/>

            {/* List of Data */}
            <ul className="space-y-[4vh] gap-4 pb-10">
                {data.map((item) => (
                    <li
                        key={item.id}
                        className="font-mono p-4  min-w-[39vw]  bg-gray-50 border border-gray-300 text-gray-900 focus:ring-0 focus:outline-none text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                    >
                        <div className="flex flex-col gap-4">
                            <div className="flex gap-1">
                                <p>{"#" + item.id + ` by `}</p>
                                <div
                                    className="cursor-pointer flex hover:underline"
                                    onClick={() => copyToClipboard(item.walletAddress)}
                                >
                                    <p className="truncate max-w-20">{item.walletAddress}</p>
                                    <p>{item.walletAddress.slice(-5, -1)}</p>
                                </div>
                            </div>
                            <p>under nickname <b>${item.username}</b></p>
                            <p>{item.message}</p>
                            <div className="flex justify-between">
                                <p>{moment(item.createdAt).format('MM/DD/YYYY HH:mm:ss')}</p>
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

        </main>

    );
}