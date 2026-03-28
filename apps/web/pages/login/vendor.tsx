import { useEffect } from "react";
import { useRouter } from "next/router";

export default function VendorLoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login?mode=vendor");
  }, [router]);

  return null;
}
