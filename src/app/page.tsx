/* eslint-disable */

import "../styles/global.css";
import {supabase} from "../../supabaseClient";
import {Component} from "@/components";

export const revalidate = 0; // This disables caching entirely

async function fetchData() {
    const {data, error} = await supabase
        .from("posts")
        .select("*")
        .order("created_at", {ascending: false});

    if (error) {
        throw new Error(error.message);
    }
    return data;
}

// Server Component: Fetches data from Supabase
export default async function HomePage() {
    const data = await fetchData();

    return <Component data={data || []}/>;
}
