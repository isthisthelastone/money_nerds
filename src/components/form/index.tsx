"use client";
/* eslint-disable */

import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "../../../supabaseClient";

export const Form = () => {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <FormContent />
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
      message: string; // we assume this is a single string
      walletAddress: string;
    }) => {
      // 1) Check if there’s a row with this walletAddress
      const { data, error: selectError } = await supabase
        .from("test")
        .select("id, name, message, walletAddress")
        .eq("walletAddress", walletAddress);

      if (selectError) throw new Error(selectError.message);

      // 2) If found → append to existing message array
      if (data && data.length > 0) {
        const existingRow = data[0];
        // Make sure we have an array; if `existingRow.message` is null or undefined, start fresh
        const updatedMessages = existingRow.message
          ? [...existingRow.message, message]
          : [message];

        // Update that row
        const { error: updateError } = await supabase
          .from("test")
          .update({
            message: updatedMessages,
            // Optionally update the name if you want to store a new name as well:
            // name,
          })
          .eq("walletAddress", walletAddress);

        if (updateError) throw new Error(updateError.message);
      } else {
        // 3) If no row found → create a new row with an array that contains the message
        const { error: insertError } = await supabase.from("test").insert([
          {
            name,
            message: [message], // message array with one element
            walletAddress,
          },
        ]);

        if (insertError) throw new Error(insertError.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fetchData"] });
      setName("");
      setMessage("");
    },
  });

  const handleSubmit = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (name.trim() && message.trim()) {
        mutation.mutate(
          {
            name,
            message,
            walletAddress:
              localStorage.getItem("phantomWalletAddress") ?? "no adress",
          },
          {
            onSuccess: () => {
              // Refresh the page after successful mutation
              window.location.reload();
            },
          },
        );
      }
    }
  };

  const handleSubmitButton = () => {
    if (name.trim() && message.trim()) {
      mutation.mutate(
        {
          name,
          message,
          walletAddress:
            localStorage.getItem("phantomWalletAddress") ?? "no adress",
        },
        {
          onSuccess: () => {
            // Refresh the page after successful mutation
            window.location.reload();
          },
        },
      );
    }
  };

  return (
    <form className="flex flex-col gap-4">
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
        className=" max-w-20  self-end font-mono px-4 py-2  bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-0 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
        onClick={() => handleSubmitButton()}
      >
        Submit
      </button>
    </form>
  );
}
