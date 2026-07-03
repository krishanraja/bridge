import Image from "next/image";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div
      className="flex h-[100dvh] flex-col items-center overflow-hidden px-7"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 14vh)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 28px)",
      }}
    >
      <div className="flex flex-1 flex-col items-center justify-start gap-7">
        <div className="flex flex-col items-center gap-7">
          <Image
            src="/brand/amperity-logo.svg"
            alt="Amperity"
            width={190}
            height={39}
            priority
            className="logo-on-light"
          />
          <Image
            src="/brand/amperity-logo-light.svg"
            alt=""
            aria-hidden
            width={190}
            height={39}
            priority
            className="logo-on-dark"
          />
          <div className="text-center">
            <h1 className="num-display text-[50px] font-medium leading-none tracking-tight">
              BRIDGE
            </h1>
            <p className="eyebrow mt-2">For the leadership table</p>
          </div>
        </div>

        <LoginForm />
      </div>

      <p className="text-center text-[13px] leading-relaxed text-ink3">
        Four seats. Nothing here says who holds them.
      </p>
    </div>
  );
}
