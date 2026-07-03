import Image from "next/image";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div
      className="grid h-[100dvh] grid-rows-[1fr_auto_1fr] items-center justify-items-center overflow-hidden px-8"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex flex-col items-center justify-end gap-6 self-end pb-10">
        <Image
          src="/brand/amperity-logo.svg"
          alt="Amperity"
          width={148}
          height={30}
          priority
          className="logo-on-light"
        />
        <Image
          src="/brand/amperity-logo-light.svg"
          alt=""
          aria-hidden
          width={148}
          height={30}
          priority
          className="logo-on-dark"
        />
        <div className="text-center">
          <h1 className="num-display text-[28px] font-medium tracking-tight">
            BRIDGE
          </h1>
          <p className="eyebrow mt-1">The fifth seat</p>
        </div>
      </div>

      <LoginForm />

      <p className="self-end pb-8 text-center text-[10.5px] leading-relaxed text-ink3">
        Four seats. Nothing here says who holds them.
      </p>
    </div>
  );
}
