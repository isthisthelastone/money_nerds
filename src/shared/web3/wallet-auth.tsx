"use client";
import React, { useState, useEffect } from "react";
import { supabase } from "../../../supabaseClient";

const PhantomWalletButton = () => {
  const [walletAddress, setWalletAddress] = useState<null | string>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");

  const isPhantomInstalled = () => {
    return (
      typeof window !== "undefined" && window.solana && window.solana.isPhantom
    );
  };

  const connectWallet = async () => {
    if (!isPhantomInstalled()) {
      setError(
        "Phantom Wallet is not installed! Please install it from https://phantom.app",
      );
      return;
    }

    setIsConnecting(true);
    setError("");
    try {
      const response = await window.solana?.connect({ onlyIfTrusted: false });
      const publicKey = response?.publicKey.toString();
      setWalletAddress(publicKey ?? "");
      localStorage.setItem("phantomWalletAddress", publicKey ?? '');
    } catch (err) {
      console.error("Error connecting to Phantom Wallet:", err);
      setError("Failed to connect to Phantom Wallet.");
    }
    setIsConnecting(false);
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    localStorage.removeItem("phantomWalletAddress");
  };

  const checkAndAddWallet = async (walletAddress: string) => {
    //eslint-disable-next-line
    const { data: _, error } = await supabase
      .from("users")
      .select("*")
      .eq("wallet_address", walletAddress)
      .single();

    if (error) {
      // Wallet not found, so add it
      //eslint-disable-next-line
      const { data : _, error: insertError } = await supabase
        .from("test")
        .insert([{ wallet_address: walletAddress }]);
      if (insertError) {
        console.error("Error adding new wallet address:", insertError);
        setError("Failed to register new wallet address.");
      }
    }
  };

  useEffect(() => {
    const storedAddress = localStorage.getItem("phantomWalletAddress");
    if (storedAddress) {
      setWalletAddress(storedAddress);
    }
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "10px",
      }}
    >
      {error && <p style={{ color: "red" }}>{error}</p>}
      {!walletAddress ? (
        <button
            //eslint-disable-next-line
          onClick={async () => {
            await connectWallet();
            await checkAndAddWallet(
              localStorage.getItem("phantomWalletAddress") ?? "",
            );
          }}
          disabled={isConnecting}
          className="rounded-lg"
          style={{
            padding: "0px 20px",
            borderRadius: "5px",
            border: "none",
            backgroundColor: "#5c67f2",
            color: "#fff",
            fontSize: "16px",
            cursor: isConnecting ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <img
            src="/Phantom-Logo.svg" // Ensure Phantom logo is in your public folder
            alt="Phantom Logo"
            style={{ width: "150px", height: "75px" }}
          />
        </button>
      ) : (
        <div>
          <p>Connected Wallet: {walletAddress}</p>
          <button
            onClick={disconnectWallet}
            style={{
              padding: "10px 20px",
              borderRadius: "5px",
              border: "none",
              backgroundColor: "#f25c5c",
              color: "#fff",
              fontSize: "16px",
              cursor: "pointer",
            }}
          >
            Disconnect Wallet
          </button>
        </div>
      )}
    </div>
  );
};

export default PhantomWalletButton;
