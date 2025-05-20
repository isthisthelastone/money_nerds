 

import "../styles/global.css";
import {supabase} from "../../supabaseClient";
import {Component} from "@/components";

export const revalidate = 0; // This disables caching entirely


const PAGE_SIZE = 10;

export default async function HomePage({
                                           searchParams,
                                       }: {
    searchParams: { page?: string };
}) {
    const page = Number(searchParams.page ?? "1");
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const {data, count, error} = await supabase
        .from("posts")
        .select("*", {count: "exact"}) // count нужен, чтобы знать, сколько всего страниц
        .range(from, to)
        .order("created_at", {ascending: false});

    if (error) throw new Error(error.message);

    return (
        <Component
            data={data ?? []}
            page={page}
            totalPages={Math.ceil((count ?? 0) / PAGE_SIZE)}
        />
    );
}
