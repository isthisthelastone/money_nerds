'use client'

import {useEffect, useState} from 'react'
import {useWallet} from '@solana/wallet-adapter-react'
import {supabase} from '../../../supabaseClient'
import {HeartIcon as HeartOutline} from '@heroicons/react/24/outline'
import {HeartIcon as HeartSolid} from '@heroicons/react/24/solid'
import {WalletProvider} from '../providers/WalletProvider'

interface LikeButtonProps {
    postId: number
    initialLikes: number
}

function UnwrappedLikeButton({postId, initialLikes}: LikeButtonProps) {
    const [likes, setLikes] = useState(initialLikes)
    const [isLiked, setIsLiked] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const {publicKey} = useWallet()

    useEffect(() => {
        const checkIfLiked = async () => {
            if (!publicKey) return

            const {data} = await supabase
                .from('post_info')
                .select('liked_by')
                .eq('id', postId)
                .single()
            //eslint-disable-next-line
            if (data?.liked_by?.includes(publicKey.toString())) {
                setIsLiked(true)
            }
        }
        //eslint-disable-next-line
        checkIfLiked()
    }, [postId, publicKey])

    const handleLike = async () => {
        if (!publicKey || isLoading) return

        setIsLoading(true)

        try {
            const userAddress = publicKey.toString()

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
                    liked_by: isLiked ? [] : [userAddress]
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
            onClick={async () => await handleLike()}
            disabled={!publicKey || isLoading}
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


