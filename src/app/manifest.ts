import type {MetadataRoute} from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Money Nerds — Ask. Share. Fund.",
        short_name: "Money Nerds",
        description:
            "A wallet-native public board for direct Solana support with zero platform commission.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#090b09",
        theme_color: "#c7ff42",
        orientation: "portrait-primary",
        categories: ["social", "finance", "community"],
        icons: [
            {
                src: "/icon.svg",
                sizes: "any",
                type: "image/svg+xml",
                purpose: "any",
            },
        ],
    };
}
