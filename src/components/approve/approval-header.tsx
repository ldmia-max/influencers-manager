import Image from "next/image";

export function ApprovalHeader() {
  return (
    <header className="border-b bg-white">
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col items-center gap-1">
          <Image
            src="/img/logo.png"
            alt="Los de Marketing"
            width={180}
            height={50}
            className="h-12 w-auto"
            priority
          />
          <span className="text-lg font-semibold text-gray-700">LDM People&apos;s</span>
        </div>
      </div>
    </header>
  );
}
