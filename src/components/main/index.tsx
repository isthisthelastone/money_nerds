/* eslint-disable */
import { Form } from "@/components";
import {PhantomWalletButton} from "@/shared/web3/wallet-auth";

export function Component({ data }: { data: any[] }) {




  return (
    <main className="flex flex-col items-center justify-start gap-16 min-h-screen w-full px-4">
      <div className="flex self-end place-self-end justify-self-end pr-[5vw] pt-[5vh]">
        <PhantomWalletButton />

      </div>
      <h1 className="text-[12vw] text-white pt-[20vh]">MONEY NERDS</h1>

      {/* Form for Client-side Interaction */}
      <Form />
      {/* Render List of Data */}
      <ul className="space-y-[4vh] gap-4 pb-10">
        {data.map((item) =>
          !Array.isArray(item.message) ? (
            <li
              key={item.id}
              className="font-mono p-4  min-w-[39vw]  bg-gray-50 border border-gray-300 text-gray-900 focus:ring-0 focus:outline-none text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            >
              <div className="flex flex-col gap-4  ">
                <p>
                  {"#" +
                    item.id +
                    ` by ${item.walletAddress} under nickname ${item.name}`}
                </p>
                <p>{item.message}</p>
                <p>{item.created_at}</p>
              </div>
            </li>
          ) : (
            item.message.map((i: string) => (
              <li
                key={item.id + i}
                className="font-mono p-4  min-w-[39vw]  bg-gray-50 border border-gray-300 text-gray-900 focus:ring-0 focus:outline-none text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              >
                <div className="flex flex-col gap-4  ">
                  <p>
                    {"#" +
                      item.id +
                      ` by ${item.walletAddress} under nickname ${item.name}`}
                  </p>
                  <p>{i}</p>
                  <p>{item.created_at}</p>
                </div>
              </li>
            ))
          ),
        )}
      </ul>
    </main>
  );
}
