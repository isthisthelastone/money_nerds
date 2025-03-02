"use client";
/* eslint-disable */

import {useState} from "react";
import {QueryClientProvider, useMutation, useQueryClient} from "@tanstack/react-query";
import {supabase} from "../../../supabaseClient";
import {queryClient, useAuthStore} from "@/shared/web3/wallet-auth";

export const Form = () => {
    const {isL} = useAuthStore();

    return (
        <QueryClientProvider client={queryClient}>
            {isL ? <FormContent/> :
                <div>you must login to be able to post</div>}
        </QueryClientProvider>
    );
};

export function FormContent() {
    const [name, setName] = useState("");
    const [message, setMessage] = useState("");
    const queryClient = useQueryClient();

    // Mutation for inserting data
    const mutation = useMutation({
        mutationFn: async ({
                               name,
                               message,
                               walletAddress,
                           }: {
            name: string;
            message: string;
            walletAddress: string;
        }) => {
            const now = new Date().toISOString();

            // Insert a new post and get the returned data
            const {data: postData, error: insertError} = await supabase
                .from("posts")
                .insert([
                    {
                        username: name,
                        message: message,
                        walletAddress: walletAddress,
                        created_at: now
                    }
                ])
                .select()
                .single();

            if (insertError) throw new Error(insertError.message);

            // Create corresponding entry in post_info
            if (postData) {
                const {error: postInfoError} = await supabase
                    .from("post_info")
                    .insert([
                        {
                            id: postData.id,
                            created_at: postData.created_at,
                            liked_by: []
                        }
                    ]);

                if (postInfoError) throw new Error(postInfoError.message);
            } else {
                throw new Error("Failed to create post: No data returned");
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ["fetchPosts"]});
            setName("");
            setMessage("");
        },
    });

    const handleSubmit = (
        e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        if (e.key === "Enter") {
            e.preventDefault();
            submitPost();
        }
    };

    const submitPost = () => {
        if (name.trim() && message.trim()) {
            const walletAddress = localStorage.getItem("phantomWalletAddress") ?? "no address";

            mutation.mutate(
                {
                    name,
                    message,
                    walletAddress,
                },
                {
                    onSuccess: () => {
                        window.location.reload();
                    },
                }
            );
        }
    };

    const handleSubmitButton = () => {
        submitPost();
    };

    return (
        <form className="flex flex-col gap-4 pt-10">
            <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleSubmit}
                className="resize-none max-w-[35vw] md:max-w-[15vw] min-h-[4vh] bg-gray-50 border border-gray-300 text-gray-900 text-sm focus:ring-0 focus:outline-none rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                placeholder="Enter your name"
                required
            />
            <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleSubmit}
                className="resize-none  md:max-w-[39vw]  md:min-w-[39vw] max-w-[79vw] min-w-[79vw] min-h-[10vh] bg-gray-50 border border-gray-300 text-gray-900 focus:ring-0 focus:outline-none text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                placeholder="Type here to get money"
                required
            />
            <button
                type="button"
                className="max-w-20 self-end font-mono px-4 py-2 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-0 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                onClick={() => handleSubmitButton()}
            >
                Submit
            </button>
        </form>
    );
}