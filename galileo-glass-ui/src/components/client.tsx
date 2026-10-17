"use client";
import dynamic from "next/dynamic";
const Observatory = dynamic(() => import("./observatory"), {
  ssr: false,
  loading: () => (
    <div className="boot">
      <img src="/orbit.svg" width="64" height="64" alt="" />
      <p>Opening the observatory…</p>
    </div>
  ),
});
export default function Client() {
  return <Observatory />;
}
