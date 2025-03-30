import {useAuthStore} from "@/shared/web3/wallet-auth";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {useState} from "react";
import {supabase} from "../../../supabaseClient";
import moment from "moment/moment";
import {PostgrestError} from "@supabase/supabase-js";

export interface Comment {

    id: number,
    created_at: string,
    likes: string[],
    image: string,
    user_id: string,
    content: string,
    user_nickname: string

}

export const CommentSection = ({postId}: { postId: number }) => {
    const {isL} = useAuthStore();
    const queryClient = useQueryClient();
    const [showAll, setShowAll] = useState(false);
    const [newComment, setNewComment] = useState("");
    const [nickname, setNickname] = useState("");

    // Fetch comments from the "comments" table using React Query (v5 style)
    const {
        data: comments = [],
        isLoading,
        isError,
        error
    } = useQuery({
        queryKey: ["comments", postId],
        queryFn: async () => {
            const {data, error}: { data: Comment[] | null, error: PostgrestError | null } = await supabase
                .from("comments")
                .select("*")
                .eq("post_id", postId)
                .order("created_at", {ascending: false});
            if (error) throw error;
            return data || [];
        }
    });

    // Mutation for posting a new comment
    const postCommentMutation = useMutation({
        mutationFn: async (content: string) => {
            const walletAddress = localStorage.getItem("phantomWalletAddress") ?? "no address";
            const now = new Date().toISOString();
            const {error} = await supabase
                .from("comments")
                .insert([
                    {
                        post_id: postId,
                        user_id: walletAddress,
                        content,
                        created_at: now,
                        user_nickname: nickname
                    }
                ]);
            if (error) throw error;
        },
        onSuccess: () => {
            // Refresh comments after posting
            //eslint-disable-next-line
            queryClient.invalidateQueries({queryKey: ["comments", postId]});
            setNewComment("");
        }
    });

    const handlePostComment = () => {
        if (!newComment.trim()) return;
        postCommentMutation.mutate(newComment.trim());
    };

    if (isLoading) {
        return <p className="mt-2 text-sm text-gray-500">Loading comments...</p>;
    }
    if (isError) {
        return <p className="mt-2 text-sm text-red-500">Error: {String(error)}</p>;
    }

    // Show first 5 unless "Show all" is toggled
    const displayedComments = showAll ? comments : comments.slice(0, 5);

    return (
        <div className="mt-4">
            {/* COMMENTS LIST */}
            {displayedComments.map((comment: Comment) => (
                <div
                    key={comment.id}
                    className="border-t border-gray-200 mt-2 pt-2 text-sm dark:border-gray-600"
                >
                    <p className="text-xs italic mb-1">
                        {comment.user_nickname ?? "Anonymous"} —{" "}
                        {moment(comment.created_at).format("MM/DD/YYYY HH:mm")}
                    </p>
                    <p>{comment.content}</p>
                </div>
            ))}

            {/* "Show all comments" button if there's more than 5 */}
            {comments.length > 5 && (
                <div className="flex justify-center mt-2">
                    <button
                        onClick={() => setShowAll((prev) => !prev)}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        {showAll ? "Show less" : "Show all comments"}
                    </button>
                </div>
            )}

            {/* COMMENT INPUT (only if logged in) */}
            {isL ? (
                <div className="mt-4 flex flex-col gap-2">
                    <input
                        className=" w-[40%] p-2 border border-gray-300 rounded-md text-black focus:ring-indigo-500 focus:border-indigo-500 dark:text-white dark:bg-gray-800 dark:border-gray-500"
                        type="text"
                        placeholder="Write a nickname"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                    />
                    <input
                        className="p-2 border border-gray-300 rounded-md text-black focus:ring-indigo-500 focus:border-indigo-500 dark:text-white dark:bg-gray-800 dark:border-gray-500"
                        type="text"
                        placeholder="Write a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                    />
                    <button
                        onClick={handlePostComment}
                        className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        Post Comment
                    </button>
                </div>
            ) : (
                <div className="mt-4 text-sm text-gray-500 dark:text-gray-300">
                    You must log in to comment.
                </div>
            )}
        </div>
    );
}