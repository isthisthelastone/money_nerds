'use client'

import {useEffect, useState} from 'react'
import {supabase} from '../../../supabaseClient'
import {HeartIcon as HeartOutline} from '@heroicons/react/24/outline'
import {HeartIcon as HeartSolid} from '@heroicons/react/24/solid'
import {SolanaWalletProvider as WalletProvider} from '../providers/WalletProvider'

interface LikeButtonProps {
    postId: number
    initialLikes: number
}

function UnwrappedLikeButton({postId, initialLikes}: LikeButtonProps) {
    const [likes, setLikes] = useState(initialLikes)
    const [isLiked, setIsLiked] = useState(false)
    const [isLoading, setIsLoading] = useState(false)


    useEffect(() => {
        const checkIfLiked = async () => {
            const userAddress = localStorage.getItem("phantomWalletAddress");
            if (!userAddress) return;

            const {data} = await supabase
                .from('post_info')
                .select('liked_by')
                .eq('id', postId)
                .single()

            if (!data) return;

            if (data.liked_by?.includes(userAddress)) {
                setIsLiked(true)
            }
        }
        checkIfLiked()
    }, [postId])

    const handleLike = async () => {
        if (isLiked) return;
        setIsLoading(true);

        try {
            const userAddress = localStorage.getItem("phantomWalletAddress");
            if (!userAddress) return;

            // Get current liked_by array
            const {data: currentData} = await supabase
                .from('post_info')
                .select('liked_by')
                .eq('id', postId)
                .single()

            const currentLikedBy: string[] = currentData?.liked_by as string[] || [];
            if (currentLikedBy.includes(userAddress)) {
                setIsLiked(true);
                return;
            }

            // Start transaction
            const {error: error1} = await supabase
                .from('posts')
                .update({likes: likes + 1})
                .eq('id', postId)

            if (error1) throw error1

            const {error: error2} = await supabase
                .from('post_info')
                //@ts-expect-error valid types
                .upsert({
                    id: postId,
                    liked_by: [...currentLikedBy, userAddress]
                }, {
                    onConflict: 'id',
                    defaultToNull: false
                })

            if (error2) throw error2

            setLikes(prev => prev + 1)
            setIsLiked(true)

        } catch (error) {
            console.error('Error liking post:', error)
        } finally {
            setIsLoading(false)
        }

    }


    return (
        <button
            //eslint-disable-next-line
            onClick={handleLike}
            disabled={isLiked || isLoading}
            className={`flex items-center space-x-1 ${
                isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'
            } transition-opacity duration-200 ease-in-out disabled:cursor-not-allowed`}
        >
            {isLiked ? (
                <HeartSolid className="h-5 w-5 text-red-500"/>
            ) : (
                <HeartOutline className="h-5 w-5 text-gray-400"/>
            )}
            <span className="text-sm text-gray-400">
        {likes}
    </span>
        </button>
    )
}

export function LikeButton(props: LikeButtonProps) {
    return (
        <WalletProvider>
            <UnwrappedLikeButton {...props} />
        </WalletProvider>
    )
}


