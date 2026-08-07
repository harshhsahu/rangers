"use client";

import React from "react";
import { useParams } from "next/navigation";
export const runtime = "edge";

const WebhookPage = () => {
  useParams();
  return <div className="w-full h-screen flex flex-col " id="alert-embed-parent"></div>;
};

export default WebhookPage;
